/* ============================================================
   brief.mjs — '오늘의 안심 브리핑' 을 하루 한 번 미리 만들어 둔다.

   promote.mjs → ai_simplify.mjs 로 채워진 data/feed.json 의 진짜 소식 중,
   '오늘 해운대 어르신이 꼭 챙기실 것' 3가지를 AI 가 골라 한 줄씩 쉬운 말로
   요약하고 '왜 중요한지'를 붙여 feed.brief 에 적습니다.

   ※ 앱 실행 중에는 AI 를 부르지 않습니다. 매일 도는 파이프라인(GitHub
     Actions)에서 미리 만들어 두므로, 어르신 기기에서는 비용도 지연도 없이
     그날의 브리핑이 바로 뜹니다. 키가 없으면 조용히 건너뛰어(있던 브리핑은
     그대로 두어) 앱이 늘 동작하게 합니다.

   실행:  node tools/brief.mjs   (.env 의 OPENAI_API_KEY 사용)
   ============================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED = path.join(ROOT, 'data', 'feed.json');

/* .env 직접 파싱(ai_simplify.mjs 와 같은 이유 — --env-file 오독 회피) */
try {
  const envRaw = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of envRaw.split(/\r\n|\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env 없으면 셸 환경변수만 */ }

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_KEY = process.env.OPENAI_API_KEY;

const KST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/* 어르신 삶에 바로 와닿는 갈래를 먼저 봅니다(안전·건강·복지가 핵심). */
const PRIORITY = { 안전: 5, 건강: 5, 복지: 5, 교통: 3, 생활: 3, 교육: 2, 행사: 2, 문화: 1, 관광: 1 };

async function pickTop(cands) {
  const list = cands.map((c, i) =>
    `${i}) [${c.cat}] ${c.title} — ${String(c.aiSimplified || c.body || '').slice(0, 120)}`
  ).join('\n');

  const prompt = `당신은 부산 해운대 어르신(65세 이상)을 돕는 편집자입니다.
아래는 오늘 기준 최근 공공기관 소식 목록입니다. 이 가운데 '오늘 어르신이 꼭 챙기시면 좋은 것' 3가지만 고르세요.
고르는 기준: ① 안전·건강·복지처럼 생활에 바로 도움이 되는 것 ② 신청·마감·행사처럼 때를 놓치면 아쉬운 것 ③ 어르신이 실제로 할 수 있는 일이 있는 것.
행정 내부 공고나 어르신과 무관한 것은 고르지 마세요.

각 항목에 대해:
- plain: 어르신이 한 번에 알아들을 한 문장(존댓말). 숫자·날짜·기관명은 목록에 있는 그대로만 쓰고 절대 지어내지 않습니다.
- why: 왜 챙기면 좋은지 아주 짧게(한 구절).

반드시 아래 JSON 형식으로만 답하세요:
{"picks":[{"i":번호,"plain":"...","why":"..."}]}

목록:
${list}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('AI 응답이 JSON 이 아님: ' + raw.slice(0, 120)); }
  return Array.isArray(parsed.picks) ? parsed.picks : [];
}

async function main() {
  const feed = JSON.parse(await fs.readFile(FEED, 'utf8'));

  if (!API_KEY) {
    console.log('OPENAI_API_KEY 없음 — 브리핑은 건너뜁니다(기존 브리핑 유지).');
    return;
  }

  // 후보: 최근 30일 안, 어르신 관련 갈래, 날짜 있는 것. 우선순위·최신순으로 상위 24건.
  const cutoff = new Date(Date.now() - 30 * 864e5 + 9 * 3600e3).toISOString().slice(0, 10);
  const cands = (feed.notices || [])
    .filter(n => n.title && n.date && n.date >= cutoff && PRIORITY[n.cat])
    .sort((a, b) => (PRIORITY[b.cat] - PRIORITY[a.cat]) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 24);

  if (cands.length < 3) {
    console.log(`후보가 ${cands.length}건뿐이라 브리핑을 만들지 않습니다(기존 유지).`);
    return;
  }

  let picks;
  try { picks = await pickTop(cands); }
  catch (e) { console.warn('브리핑 생성 실패(기존 유지):', e.message); return; }

  const items = picks
    .map(p => {
      const c = cands[p.i];
      if (!c || !p.plain) return null;
      return {
        title: c.title,
        plain: String(p.plain).trim(),
        why: String(p.why || '').trim(),
        cat: c.cat,
        source: c.source,
        sourceUrl: c.sourceUrl || null
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  if (items.length < 1) { console.warn('고른 항목이 없어 브리핑을 갱신하지 않습니다.'); return; }

  feed.brief = { date: KST(), items };
  await fs.writeFile(FEED, JSON.stringify(feed, null, 2), 'utf8');
  console.log(`오늘의 안심 브리핑: ${items.length}건 작성 (${KST()})`);
  items.forEach(it => console.log(' •', it.plain.slice(0, 50)));
}

main().catch(e => { console.error(e); process.exit(1); });
