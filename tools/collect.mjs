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
   정해진 시간 안에 응답이 없으면 그 기관만 건너뜁니다.
   ※ 실제로 겪은 문제: 처음엔 10초로 뒀는데, GitHub Actions(해외 서버)에서
   .go.kr 사이트(haeundae.go.kr·busan.go.kr 등 여러 곳)에 접속하면
   10초를 자꾸 넘겨 "타임아웃"으로 계속 건너뛰어졌습니다(제 컴퓨터에서
   테스트할 땐 멀쩡했던 것과 대조적 — 국내/국외 접속 경로 차이로 보임).
   한 기관만의 문제가 아니라 .go.kr 전반의 문제라, 기본값 자체를
   넉넉하게 올립니다(정말 응답이 없는 서버는 25초여도 여전히 걸러집니다). */
const TIMEOUT_MS = 25000;
async function fetchSafe(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || TIMEOUT_MS);
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
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#40;/g, '(').replace(/&#41;/g, ')')
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

    // 벡스코 행사일정처럼 '상세보기 진행중 회의 <진짜제목> <날짜> <장소>'가
    // 한 <a> 안에 뭉쳐 있는 카드형 목록이 있습니다. class="subject"/"date"
    // 처럼 이름 붙은 칸이 있으면 그걸 진짜 제목·날짜로 우선 씁니다.
    const subjectM = m[2].match(/class=["'][^"']*\bsubject\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const cardDateM = m[2].match(/class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const text = subjectM
      ? strip(subjectM[1]).slice(0, 120)
      // title="...<진짜 꺾쇠>..." 처럼 속성값 안에 이스케이프 안 된 '>'가
      // 있으면(문법적으로는 틀렸지만 실제 사이트에 종종 있습니다) 태그가
      // 그 자리에서 끝난 것으로 잘못 잘려, 앞에 '">' 부스러기가 붙어
      // 나올 수 있습니다. 그런 부스러기만 앞에서 잘라 냅니다.
      : strip(m[2]).replace(/^["'>\s]+(?=\S)/, '').replace(/^(새글|NEW|첨부파일)\s*/i, '').slice(0, 120);

    // 목록 표에 '부서 | 2026.07.23' 처럼 진짜 게시일이 같은 줄에 있는 경우가
    // 많습니다. 사진 한 장뿐인 글은 상세 페이지에서 날짜를 못 찾아 '오늘'로
    // 잘못 찍히므로, 같은 줄(같은 <tr>) 안에서 날짜를 먼저 찾아 둡니다.
    const rowStart = html.lastIndexOf('<tr', m.index);
    const rowEnd = html.indexOf('</tr>', m.index);
    const row = (rowStart >= 0 && rowEnd > rowStart) ? html.slice(rowStart, rowEnd) : '';
    // row를 그대로(태그 안 지운 채) 날짜를 찾으면 href 안의 검색기간
    // 파라미터(예: srchBeginDt=2025-07-24)처럼 화면에 안 보이는 값까지
    // 걸려, 모든 글이 똑같은 엉뚱한 날짜로 찍히는 사고가 납니다.
    // 반드시 태그를 지운 '보이는 글자'에서만 찾습니다.
    const dateSrc = cardDateM ? strip(cardDateM[1]) : strip(row);
    const dateM = dateSrc.match(/(20\d{2})[.\-](\d{1,2})[.\-](\d{1,2})/);
    const listDate = dateM ? `${dateM[1]}-${dateM[2].padStart(2, '0')}-${dateM[3].padStart(2, '0')}` : null;
    out.push({ url: u, text, listDate });
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

/* 요즘 관공서·기관 사이트에 흔히 붙는 'AI 챗봇 안내' 위젯 글은
   짧고 링크가 없어(점수 계산상) 진짜 본문보다 높은 점수를 받아 버립니다
   (실제로 벡스코 상세 페이지가 이 위젯 글만 본문으로 잘못 골랐던 적이 있습니다).
   본문 후보에서 아예 빼서, 실제 본문이 있으면 그쪽이 뽑히게 합니다. */
const WIDGET_HINT = /챗봇\s*사용\s*가이드|AI가\s*생성한\s*답변은\s*부정확|챗봇에게\s*물어보세요/;

/* 상세에서 제목·본문·게시일·첨부를 뽑는다.
   본문은 '글자는 많고 링크는 적은' 덩어리를 고른다(메뉴는 링크투성이라 걸러진다). */
function extractDetail(html, url, listTitle) {
  let best = { score: 0, text: '' };
  for (const m of html.matchAll(/<(div|td|article|section)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2] || '', inner = m[3];
    if (NAV_HINT.test(attrs)) continue;
    const text = strip(inner);
    if (text.length < 80) continue;
    if (WIDGET_HINT.test(text)) continue;
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

  /* 동 소식지는 대부분 '스캔한 사진 한 장'입니다(텍스트가 아니라 글자를 못 뽑습니다).
     대신 그 사진은 로그인 없이 그냥 열리는 정적 파일이라, 사진 자체를 카드에
     보여 드리면 어르신이 정부 사이트를 헤매지 않고 바로 소식지를 보실 수 있습니다. */
  const image = (html.match(/<img[^>]*src=["']([^"']*\/upload_data\/[^"']*\.(?:jpg|jpeg|png)[^"']*)["']/i) || [])[1];
  const imageUrl = image ? abs(url, image.replace(/&amp;/g, '&')) : null;

  return { title, body, publishedAt, attachments, imageUrl };
}

/* 벡스코 행사 상세 페이지는 대부분 '글자 설명'란이 비어 있습니다
   (포스터 이미지만 올리고 글은 안 씀). 그러면 일반 본문 고르기가
   챗봇 안내·꼬리말 같은 엉뚱한 덩어리를 집어 옵니다.
   대신 이 페이지에 항상 있는 장소·시간·주최·관람료 칸을 직접 읽어
   짧지만 정확한 본문을 만듭니다. */
function extractBexcoDetail(html) {
  const pick = re => (html.match(re) || [])[1];
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const date = clean(pick(/<span class="date">([\s\S]*?)<\/span>/));
  const time = clean(pick(/<span class="time">([\s\S]*?)<\/span>/));
  const place = clean(pick(/class="place[^"]*"[^>]*>([\s\S]*?)<\/a>/));
  const org = clean(pick(/<em class="ltit">주최\/주관<\/em><span class="ltxt">([\s\S]*?)<\/span>/));
  const fee = clean(pick(/<em class="ltit">관람료<\/em><span class="ltxt">([\s\S]*?)<\/span>/));
  const desc = clean(strip(pick(/<div class="EventViewtxt">([\s\S]*?)<\/div>\s*<\/div>/) || ''));
  if (!date && !place) return null;   // 이 틀이 아니면(다른 페이지 구조) 포기하고 일반 방식에 맡깁니다
  const parts = [];
  if (date) parts.push(`기간: ${date.replace(/\s*~\s*/, ' ~ ')}`);
  if (time) parts.push(`시간: ${time.replace(/\s*~\s*/, ' ~ ')}`);
  if (place) parts.push(`장소: ${place}`);
  if (org) parts.push(`주최: ${org}`);
  if (fee) parts.push(`관람료: ${fee}`);
  if (desc && desc.length > 5) parts.push(desc);
  return parts.join(' · ');
}

/* 영화의전당 '현재상영/상영예정프로그램' 목록은 회차별 시간표가 아니라
   프로그램(영화 시리즈) 한 편당 한 줄이라 '소식'에 알맞은 분량입니다.
   목록 페이지 자체에 제목·기간·요금·소개글이 이미 다 있어(상세 페이지가
   따로 필요 없음), 목록에서 바로 뽑아 씁니다. */
function extractDureraumProgList(html, baseUrl) {
  const out = [];
  const re = /<li class="title">\s*<a href="([^"]*)"\s*title="([^"]*)">[\s\S]*?<ul class="info">([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = re.exec(html))) {
    const url = abs(baseUrl, m[1].replace(/&amp;/g, '&'));
    if (!url) continue;
    const text = strip(m[2]).slice(0, 120);
    const lines = [...m[3].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(x => strip(x[1])).filter(Boolean);
    const dateLine = lines[0] || '';
    const dm = dateLine.match(/(20\d{2})-(\d{2})-(\d{2})/);
    const listDate = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : null;
    const bodyHint = lines.slice(1).join(' · ');
    out.push({ url, text, listDate, bodyHint });
  }
  return out;
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
  try { res = await fetchSafe(src.listUrl, { headers }, src.timeoutMs); }
  catch (e) {
    st.fails++;
    // 'fetch failed'만으로는 원인(타임아웃/DNS실패/연결거부/TLS오류)을 알 수 없어,
    // 실제 원인이 담긴 e.cause까지 함께 남깁니다 — haeundae.go.kr·busan.go.kr이
    // GitHub Actions에서만 계속 막히는 진짜 이유를 찾기 위한 진단용입니다.
    const cause = e.cause ? ` — 원인: ${e.cause.code || e.cause.message || e.cause}` : '';
    console.warn(`✗ ${src.name}: ${e.message}${cause}`);
    return [];
  }

  st.lastCheck = new Date().toISOString();
  if (res.status === 304) { st.fails = 0; console.log(`· ${src.name}: 변경 없음`); return []; }
  if (!res.ok) { st.fails++; console.warn(`✗ ${src.name}: HTTP ${res.status}`); return []; }
  st.fails = 0;
  st.etag = res.headers.get('etag') || st.etag;
  st.lastMod = res.headers.get('last-modified') || st.lastMod;

  const html = await res.text();
  let links = src.listStyle === 'dureraum-prog'
    ? extractDureraumProgList(html, src.listUrl)
    : src.idPattern
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
      const r2 = await fetchSafe(u.href, { headers: { 'User-Agent': agent.userAgent } }, src.timeoutMs);
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
      const r = await fetchSafe(url, { headers: { 'User-Agent': agent.userAgent } }, src.timeoutMs);
      if (!r.ok) continue;
      const rawHtml = await r.text();
      const d = extractDetail(rawHtml, url, link.text);
      if (url.includes('EventScheduleMgr/view.do')) {
        const bexcoBody = extractBexcoDetail(rawHtml);
        if (bexcoBody) d.body = bexcoBody;
      }
      // 영화의전당 프로그램은 목록 페이지에 이미 기간·요금·소개글이 있어
      // 그쪽이 상세 페이지보다 낫습니다(상세는 회차 예매용이라 오히려 부실).
      if (link.bodyHint && link.bodyHint.length > 20) d.body = link.bodyHint;
      if (!d.title || d.body.length < 40) continue;
      items.push({
        uid: sha1(url), source: src.name, sourceId: src.id, sourceUrl: url,
        trust: src.trust, region: src.region, topics: src.topics || [],
        rawTitle: d.title, rawBody: d.body,
        publishedAt: link.listDate || d.publishedAt || new Date().toISOString().slice(0, 10),
        attachments: d.attachments,
        imageUrl: d.imageUrl || null,
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
