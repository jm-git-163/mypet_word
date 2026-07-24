/* ============================================================
   ai_simplify.mjs — 실제로 모은 공지사항에 'AI 쉬운말' 한 줄을 얹는다.

   collect.mjs → promote.mjs 가 만든 data/feed.json(진짜 21개 기관 글)은
   그대로 둔 채, 각 글에 aiSimplified 필드 하나만 "더합니다".
   원문(title/body/sourceUrl)은 절대 건드리지 않습니다 — 사실이 달라지면
   안 되므로, 언제나 원문 링크로 대조할 수 있게 남겨 둡니다.

   실행:  1) .env 에 OPENAI_API_KEY=본인키 를 적어 둡니다(채팅에 붙여넣지 않기)
          2) node --env-file=.env tools/ai_simplify.mjs
          (환경변수 LIMIT 로 이번에 변환할 건수를 조절합니다. 기본 30건)

   비용 안내: 건당 아주 짧은 요청 1회, 저렴한 모델(gpt-4o-mini)을 씁니다.
   LIMIT=30 이면 이번 한 번 실행에 대략 원 단위 소액이 듭니다.
   ============================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED = path.join(ROOT, 'data', 'feed.json');

/* .env 를 직접 읽어 채웁니다 — Node의 --env-file 플래그가 이 파일의
   줄바꿈(CRLF)과 한글 주석이 섞인 조합에서 값을 잘못 읽어들이는 경우가
   실제로 확인되어(키가 멀쩡한데도 엉뚱한 값을 읽음), 직접 파싱한 값을
   우선으로 둡니다. */
try {
  const envRaw = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of envRaw.split(/\r\n|\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env 가 없으면 셸 환경변수만 씁니다 */ }

const LIMIT = Number(process.env.LIMIT || 30);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY 가 없습니다. .env 에 넣고 --env-file=.env 로 실행하세요.');
  process.exit(1);
}

/* 딱딱한 공문을 어르신 눈높이 한두 문장으로 — 사실은 절대 지어내지 않습니다 */
async function simplifyOne(n) {
  const prompt = `당신은 부산 해운대 어르신(65세 이상)에게 공공기관 공지를 아주 쉽게 설명하는 편집자입니다.
아래 '원문'을 어르신이 한 번에 알아들을 수 있게 한두 문장으로 바꾸세요.
규칙: 숫자·날짜·자격조건·기관명은 원문 그대로 옮기고 절대 지어내지 않습니다.
원문에 없는 정보는 추가하지 않습니다. 존댓말로 씁니다.
결과는 다른 말 없이 문장만 출력하세요(따옴표·JSON 없이).

제목: ${n.title}
원문: ${String(n.body || '').slice(0, 500)}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      // 한글은 영어보다 토큰을 훨씬 많이 씁니다(음절 하나가 토큰 여러 개로
      // 쪼개지는 경우가 흔함). 200으로는 "한두 문장"도 중간에 잘려
      // 끊긴 채로 나온 적이 있어 여유 있게 올립니다.
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  if (j.choices?.[0]?.finish_reason === 'length') {
    console.warn('  ⚠ 문장이 중간에 잘렸을 수 있음(max_tokens 한도 도달):', n.title.slice(0, 30));
  }
  return (j.choices?.[0]?.message?.content || '').trim();
}

async function main() {
  const feed = JSON.parse(await fs.readFile(FEED, 'utf8'));
  // 아직 AI 요약이 없는 것부터, 최신순으로 LIMIT 건만
  const targets = feed.notices.filter(n => !n.aiSimplified).slice(0, LIMIT);
  if (!targets.length) { console.log('새로 변환할 글이 없습니다(이미 다 되어 있음).'); return; }

  let done = 0, failed = 0;
  for (const n of targets) {
    try {
      n.aiSimplified = await simplifyOne(n);
      n.aiSimplifiedAt = new Date().toISOString().slice(0, 10);
      done++;
    } catch (e) {
      failed++;
      console.warn('변환 실패:', n.title.slice(0, 30), '—', e.message);
    }
    await new Promise(r => setTimeout(r, 300));   // API 쪽에 예의 있는 간격
  }

  await fs.writeFile(FEED, JSON.stringify(feed, null, 2), 'utf8');
  console.log(`AI 쉬운말 변환: 성공 ${done}건 · 실패 ${failed}건 (전체 ${feed.notices.length}건 중)`);
}

main().catch(e => { console.error(e); process.exit(1); });
