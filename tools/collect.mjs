/* ============================================================
   collect.mjs — 해운대구청·주민센터 게시판을 지켜보다 '새 글만' 집어 온다.

   흐름:  목록 확인(304면 스킵) → 새 uid 만 골라 → 상세 수집 → pending.json 적재
   다음:  node tools/build_feed.mjs 가 선별·AI변환·검수를 거쳐 feed.json 을 만든다.

   실행:  node tools/collect.mjs            (주기가 된 소스만)
          node tools/collect.mjs --all      (주기 무시하고 전부)

   ※ 지킬 것: robots.txt·이용약관, 요청 간격 2초, 동시요청 1,
     원문 URL·게시일·출처 보관, 전문 복제 금지(요지+링크).
     공식 제휴(RSS/API)가 가능하면 그쪽이 우선입니다.
   ============================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 윈도우에서 URL 경로를 그대로 쓰면 'C:\C:\...%EC%95%B1' 처럼 깨집니다
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools', 'sources.json');
const STATE = path.join(ROOT, 'data', 'state.json');
const PENDING = path.join(ROOT, 'data', 'pending.json');
const ALL = process.argv.includes('--all');

const sha1 = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 응답 없는 기관 서버 하나 때문에 전체 수집이 멈추면 안 됩니다.
   10초 안에 응답이 없으면 그 기관만 건너뜁니다. */
const TIMEOUT_MS = 10000;
async function fetchSafe(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
const readJson = async (p, dflt) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return dflt; } };

/* ── HTML 도우미 (의존성 없이 최소한만. 정교하게 하려면 cheerio 권장) ── */
const abs = (base, href) => { try { return new URL(href, base).toString(); } catch { return null; } };
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

/* 목록에서 상세 링크 + '링크에 적힌 글 제목' 을 함께 뽑는다.
   상세 페이지의 <title> 은 대개 "공지사항의 상세보기 < 새소식 < 구청" 이라 쓸모가 없다.
   목록의 링크 글자가 진짜 제목이다. */
function extractLinks(html, baseUrl, pattern) {
  // href 안의 & 는 실제 HTML에 거의 항상 &amp; 로 이스케이프되어 있습니다.
  // linkPattern에 '&wr_id=' 처럼 그냥 & 를 썼다가는 영원히 안 걸립니다.
  const safePattern = pattern.replace(/&/g, '(?:&|&amp;)');
  const re = new RegExp(`<a[^>]*href=["']([^"']*${safePattern}[^"']*)["'][^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
  const seen = new Set(), out = [];
  let m;
  while ((m = re.exec(html))) {
    const u = abs(baseUrl, m[1].replace(/&amp;/g, '&'));
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, text: strip(m[2]).replace(/^(새글|NEW|첨부파일)\s*/i, '').slice(0, 120) });
  }
  // 게시글 주소에는 대개 긴 일련번호가 붙는다. 그런 링크가 충분하면 메뉴 링크는 버린다.
  const withId = out.filter(l => /\d{4,}/.test(l.url));
  return withId.length >= 3 ? withId : out;
}

/* 어떤 기관은 목록에 주소를 적지 않고 onclick="btnView(2352)" 처럼
   번호만 넘긴다(미술관이 그렇다). 그 번호를 뽑아 상세 주소를 만들어 준다.
   이렇게 해 두지 않으면 그 기관 소식은 영영 들어오지 않는다. */
function extractByOnclick(html, src) {
  const re = new RegExp(src.idPattern, 'g');
  const out = [], seen = new Set();
  // 번호가 들어 있는 행(tr)에서 제목까지 같이 집는다
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const inner = row[1];
    const hit = new RegExp(src.idPattern).exec(inner);
    if (!hit) continue;
    const id = hit[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const cells = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => strip(c[1]));
    const title = cells.sort((a, b) => b.length - a.length)[0] || '';
    out.push({ url: src.detailUrl.replace('{id}', id), text: title.slice(0, 120) });
  }
  if (out.length) return out;
  // 표가 아니면 번호만이라도 모은다
  let m;
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ url: src.detailUrl.replace('{id}', m[1]), text: '' });
  }
  return out;
}

/* 메뉴·머리말·꼬리말처럼 본문이 아닌 덩어리는 걸러 낸다 */
const NAV_HINT = /(^|[^a-z])(gnb|lnb|snb|nav|menu|header|footer|sitemap|breadcrumb|quick|banner|skip)([^a-z]|$)/i;

/* 상세에서 제목·본문·게시일·첨부를 뽑는다.
   본문은 '글자는 많고 링크는 적은' 덩어리를 고른다(메뉴는 링크투성이라 걸러진다). */
function extractDetail(html, url, listTitle) {
  let best = { score: 0, text: '' };
  for (const m of html.matchAll(/<(div|td|article|section)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2] || '', inner = m[3];
    if (NAV_HINT.test(attrs)) continue;
    const text = strip(inner);
    if (text.length < 80) continue;
    const links = (inner.match(/<a\b/gi) || []).length;
    const score = text.length / (1 + links * 45);      // 링크가 많을수록 감점
    if (score > best.score) best = { score, text };
  }
  const body = (best.text || strip(html)).slice(0, 4000);

  // 제목: 목록 링크 글자 우선 → 본문 h1/h2 → 페이지 title(마지막 수단)
  const h = strip(html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] || '');
  const pageTitle = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s*[<|｜].*$/, '').trim();
  const title = (listTitle && listTitle.length > 3 ? listTitle : (h.length > 3 ? h : pageTitle)).slice(0, 120);

  // 게시일: '작성일/등록일' 뒤의 날짜를 먼저 찾는다(아무 날짜나 잡으면 엉뚱한 값이 들어간다)
  const DATE = '(20\\d{2})[.\\-/\\s]+(\\d{1,2})[.\\-/\\s]+(\\d{1,2})';
  const d = (body.match(new RegExp('(?:작성일|등록일|게시일|작성일자)[^0-9]{0,12}' + DATE)) ||
    html.match(new RegExp('(?:작성일|등록일|게시일)[^0-9]{0,12}' + DATE)) ||
    body.match(new RegExp(DATE)) || []).slice(1);
  const publishedAt = d.length === 3 ? `${d[0]}-${d[1].padStart(2, '0')}-${d[2].padStart(2, '0')}` : null;
  const attachments = [...html.matchAll(/href=["']([^"']*(?:download|fileDown|\.pdf|\.hwp)[^"']*)["']/gi)]
    .map(m => abs(url, m[1].replace(/&amp;/g, '&'))).filter(Boolean).slice(0, 5);
  return { title, body, publishedAt, attachments };
}

/* ── 소스 하나 확인 ── */
async function checkSource(src, state, agent) {
  const st = state[src.id] || (state[src.id] = { etag: null, lastMod: null, lastCheck: null, seen: [], fails: 0 });

  // 주기 확인
  if (!ALL && st.lastCheck) {
    const due = new Date(st.lastCheck).getTime() + (src.cadenceMin || 360) * 60000;
    if (Date.now() < due) return [];
  }
  if (!src.listUrl || src.listUrl === 'TODO') return [];

  const headers = { 'User-Agent': agent.userAgent };
  if (st.etag) headers['If-None-Match'] = st.etag;
  if (st.lastMod) headers['If-Modified-Since'] = st.lastMod;

  let res;
  try { res = await fetchSafe(src.listUrl, { headers }); }
  catch (e) { st.fails++; console.warn(`✗ ${src.name}: ${e.message}`); return []; }

  st.lastCheck = new Date().toISOString();
  if (res.status === 304) { st.fails = 0; console.log(`· ${src.name}: 변경 없음`); return []; }
  if (!res.ok) { st.fails++; console.warn(`✗ ${src.name}: HTTP ${res.status}`); return []; }
  st.fails = 0;
  st.etag = res.headers.get('etag') || st.etag;
  st.lastMod = res.headers.get('last-modified') || st.lastMod;

  const html = await res.text();
  let links = src.idPattern
    ? extractByOnclick(html, src)
    : extractLinks(html, src.listUrl, src.linkPattern || 'view');

  /* 부산 전체 17개 구·군을 한 게시판에서 같이 다루는 기관이 있습니다(자원봉사센터 등).
     그대로 받으면 해운대 앱에 다른 구 소식이 섞여 들어갑니다.
     제목에 이 낱말이 있는 글만 골라 받습니다. */
  if (src.titleFilter) {
    const re = new RegExp(src.titleFilter);
    links = links.filter(l => re.test(l.text));
  }

  /* 게시판 첫 쪽만 보면 열 몇 건에서 끊깁니다.
     동 소식지처럼 자주 올라오는 글은 이틀만 지나도 둘째 쪽으로 밀려나
     "우리 동네 소식이 왜 없지?" 가 됩니다. 정해진 쪽수만큼 더 넘겨 봅니다. */
  const pages = Math.max(1, src.pages || 1);
  const pageParam = src.pageParam || 'startPage';
  for (let p = 2; p <= pages; p++) {
    const u = new URL(src.listUrl);
    u.searchParams.set(pageParam, String(p));
    await sleep(agent.minDelayMs || 2000);
    try {
      const r2 = await fetchSafe(u.href, { headers: { 'User-Agent': agent.userAgent } });
      if (!r2.ok) break;
      const h2 = await r2.text();
      const more = src.idPattern
        ? extractByOnclick(h2, src)
        : extractLinks(h2, u.href, src.linkPattern || 'view');
      const have = new Set(links.map(l => l.url));
      let added = more.filter(l => !have.has(l.url));
      if (!added.length) break;                       // 같은 쪽이 되풀이되면 멈춥니다
      // 필터는 여기서 적용합니다 — 이 쪽에 해운대 글이 마침 없다고
      // 다음 쪽까지 안 보면 뒤쪽 쪽의 해운대 글을 놓칩니다.
      if (src.titleFilter) {
        const re = new RegExp(src.titleFilter);
        added = added.filter(l => re.test(l.text));
      }
      links.push(...added);
    } catch (e) { break; }
  }

  const seen = new Set(st.seen);
  const fresh = links.filter(l => !seen.has(sha1(l.url))).slice(0, agent.maxDetailPerRun || 20);
  if (!fresh.length) { console.log(`· ${src.name}: 새 글 없음 (링크 ${links.length})`); return []; }

  const items = [];
  for (const link of fresh) {
    const url = link.url;
    await sleep(agent.minDelayMs || 2000);            // 예의 있는 간격
    try {
      const r = await fetchSafe(url, { headers: { 'User-Agent': agent.userAgent } });
      if (!r.ok) continue;
      const d = extractDetail(await r.text(), url, link.text);
      if (!d.title || d.body.length < 40) continue;
      items.push({
        uid: sha1(url), source: src.name, sourceId: src.id, sourceUrl: url,
        trust: src.trust, region: src.region, topics: src.topics || [],
        rawTitle: d.title, rawBody: d.body,
        publishedAt: d.publishedAt || new Date().toISOString().slice(0, 10),
        attachments: d.attachments,
        collectedAt: new Date().toISOString(),
        stage: 'collected'          // collected → filtered → simplified → approved
      });
      seen.add(sha1(url));
    } catch (e) { console.warn(`  상세 실패: ${url} (${e.message})`); }
  }
  st.seen = [...seen].slice(-500);                     // 최근 500개만 기억
  console.log(`＋ ${src.name}: 새 글 ${items.length}건`);
  return items;
}

/* ── 실행 ── */
async function main() {
  const reg = JSON.parse(await fs.readFile(SRC, 'utf8'));
  const agent = reg._agent || {};
  const state = await readJson(STATE, {});
  const pending = await readJson(PENDING, []);
  const known = new Set(pending.map(p => p.uid));

  let added = 0;
  for (const src of reg.sources.filter(s => s.enabled && s.type === 'html-board')) {
    const items = await checkSource(src, state, agent);
    for (const it of items) if (!known.has(it.uid)) { pending.push(it); known.add(it.uid); added++; }
  }

  await fs.mkdir(path.dirname(STATE), { recursive: true });
  await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8');
  await fs.writeFile(PENDING, JSON.stringify(pending, null, 2), 'utf8');
  console.log(`\n수집 완료: 새 글 ${added}건 → data/pending.json (총 ${pending.length}건 대기)`);
  console.log('다음: node tools/build_feed.mjs  (선별·AI 쉬운말 변환 → 검수 → feed.json)');
}

main().catch(e => { console.error(e); process.exit(1); });
