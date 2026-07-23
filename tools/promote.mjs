/* ============================================================
   promote.mjs — 수집한 글(pending.json) 중 어르신에게 쓸모 있는 것만
                 골라 앱 피드(feed.json)에 올린다.

   흐름:  pending.json → [선별 규칙] → [분류·정리] → feed.json.notices
   ※ AI 쉬운말 변환(build_feed.mjs)은 API 키가 있을 때 돌린다.
     키가 없어도 이 단계만으로 '진짜 최신 정보'가 앱에 뜨고 검색된다.

   실행:  node tools/promote.mjs
   ============================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PENDING = path.join(ROOT, 'data', 'pending.json');
const FEED = path.join(ROOT, 'data', 'feed.json');
const SOURCES = path.join(ROOT, 'tools', 'sources.json');

/* 소스마다 '누구에게 필요한 소식인가'가 정해져 있습니다.
   어르신용 앱이지만 관광·창업 소식까지 한 곳에 모으되,
   섞어서 보여 주면 어르신이 헤매므로 글마다 대상을 달아 둡니다. */
let AUDIENCE = {};   // 소스 이름 → ['senior','resident','tourist','biz']

/* 어르신과 무관한 행정 문서는 버린다 */
const DROP = /(입찰|낙찰|계약|용역|수의계약|인사발령|채용|임용|의회|조례|규칙\s*개정|감사\s*결과|공유재산|매각|분양|특별공급|기관추천|재개발|재건축|입찰공고|낙찰자|사업자\s*선정|위탁\s*운영자|기간제근로자|공무직|자원봉사자\s*모집|입주자\s*모집|취약계층지원|공시송달|영업정지|행정처분|처분\s*(사전)?통지|청문|과태료|종합건설업|건설업\s*(등록|폐업|양도)|폐업신고|등록\s*공고|양도·?양수|임대\s*(공고|재공고|\d차공고)|온비드|대관\s*공고|심의\s*결과|위원회\s*(구성|명단|개최|심의)|참석위원|공람|열람\s*공고|의견\s*청취|고시\s*(제정|개정|폐지)|위탁내용\s*등\s*고시|지적재조사|도시계획\s*(시설|변경)|실시계획|지구단위계획|정기검사|검사지연|미필)/;

/* 로고·메뉴 같은 '글이 아닌 링크'는 제목만 봐도 걸러진다 */
const NOT_A_POST = /(로고|바로가기|사이트맵|전체메뉴|이용안내|이용규정|대출\/반납|회원가입|상호대차|책나래|책바다|오시는\s*길|개인정보|저작권|누리집|홈페이지$|^더보기$|^목록$|사물함|복사\s*및|시설\s*안내|층별\s*안내|열람실|좌석\s*배정|주차\s*안내|공연장\s*안내|대관\s*안내|관람\s*안내|찾아오시는|조직도|부서\s*안내|연혁|인사말|스킵네비게이션|본문바로가기|콘텐츠바로가기|자주\s*하는\s*질문|희망도서|북로그|권장도서|도서\s*추천|시설\s*현황|학습\s*포털|바로대출|상호대차|책이음|회원가입|독서통장|우수도서|추천도서)/;

/* 어르신에게 특히 도움이 되는 신호 — 거르는 데 쓰지 않고 순서를 매기는 데만 씁니다.
   키워드가 없다고 버리면 '정보통신보조기기 보급', '환경보건이용권' 같은
   정작 필요한 안내가 통째로 사라집니다. */
const KEEP = /(어르신|경로|노인|고령|연금|복지|건강|접종|검진|무료|신청|지원|급식|경로당|복지관|보건소|폭염|한파|감염병|보이스피싱|사기|안전|교통|버스|지하철|문화|강좌|교실|축제|행사|공연|전시|소식지|쉼터|일자리|상담|치매|돌봄|의료|주민)/;

const CAT = [
  [/(연금|기초생활|생계급여|수당|지원금|바우처|돌봄|요양|장애|한부모|보훈|긴급복지|사회복지)/, '복지'],
  [/(건강|접종|검진|보건|치매|의료|병원|진료|약국|금연|영양|정신건강|감염병|결핵)/, '건강'],
  [/(안전|폭염|한파|호우|태풍|재난|화재|점검|보이스피싱|사기|범죄|실종|대피|해빙|지진)/, '안전'],
  // '근로'·'인력' 처럼 홀로 두면 "근로자의 날 휴무 안내", "승용차요일제"(본문에 근로자의 날 언급)
  // 같은 무관한 글까지 끌어옵니다. 실제 채용·구직 맥락의 낱말로만 좁힙니다.
  [/(취업|일자리|구인|채용|직업\s*훈련|노무상담|노동상담|재취업|인력양성|인력풀|인력\s*모집|노인일자리)/, '일자리'],
  [/(창업|소상공인|자영업|상인|점포|시장\s*상권|기업|사업자\s*지원)/, '창업'],
  [/(교육|강좌|교실|수강|아카데미|특강|평생학습|배움|학습|문해)/, '교육'],
  [/(버스|지하철|도시철도|주차|도로|통행|교통|택시|자전거|보행)/, '교통'],
  [/(주택|임대|아파트|집수리|주거|이사|전세|월세|공동주택)/, '주거'],
  [/(청소|재활용|쓰레기|분리배출|미세먼지|하천|공원|녹지|환경|에너지)/, '환경'],
  [/(세금|지방세|감면|요금|납부|고지서|과세|재산세|자동차세)/, '세금'],
  [/(도서관|독서|책|미술관|박물관|영화|전시|공연|문화)/, '문화'],
  [/(관광|여행|명소|숙박|해수욕장|둘레길|투어)/, '관광'],
  [/(축제|행사|대회|캠프|챌린지|기념일|모집|참가자)/, '행사'],
];
/* 제목을 최우선으로 봅니다. 본문 1200자를 통째로 훑으면
   "~인력~", "~지원~" 같은 낱말이 스치듯 한 번 나온 것만으로
   전혀 다른 주제의 글이 엉뚱한 분류에 들어갑니다.
   제목에 실마리가 없을 때만 본문 앞 200자(첫 문단)를 봅니다. */
const catOf = (title, bodyHead) =>
  (CAT.find(([re]) => re.test(title)) || CAT.find(([re]) => re.test(bodyHead || '')) || [, '생활'])[1];

/* 해운대 18개 행정동 — 제목·본문에 동 이름이 있으면 그 동 소식으로 본다 */
const DONG = ['우1동', '우2동', '우3동', '중1동', '중2동', '좌1동', '좌2동', '좌3동', '좌4동',
  '송정동', '반여1동', '반여2동', '반여3동', '반여4동', '반송1동', '반송2동', '재송1동', '재송2동'];

/* &#39; &amp; 같은 웹 기호가 그대로 보이면 어르신은 글자가 깨진 줄 압니다 */
const unesc = s => String(s || '')
  .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const clean = s => unesc(s).replace(/\s+/g, ' ')
  .replace(/(공지사항\s*)?게시물\s*상세\s*정보|작성자|작성일|조회수?\s*\d*|첨부파일|이전글|다음글|목록/g, ' ')
  .replace(/-->|<!--/g, ' ')                      // 주석 찌꺼기가 제목 끝에 붙어 나옵니다
  .replace(/\s+/g, ' ').trim();

/* 본문 자리에 좌측 메뉴가 통째로 담겨 오는 기관이 있습니다.
   그런 글은 어르신이 읽어도 아무 내용이 없으므로 본문을 비웁니다. */
const NAV_BODY = /(주\s*메뉴\s*영역|HOME\s*SITEMAP|전체\s*메뉴|사이트맵|자료실\s*건축|구청장실\s*의회)/;
const navRatio = t => {
  const hits = (t.match(/(자료실|안내|현황|신청|정보|센터|과$)/g) || []).length;
  return hits / Math.max(1, t.split(/\s+/).length);   // 명사 나열이면 메뉴입니다
};

function toNotice(it) {
  const text = `${it.rawTitle} ${it.rawBody}`;
  let body = clean(it.rawBody).replace(new RegExp('^' + it.rawTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '').trim();
  if (NAV_BODY.test(body) || navRatio(body) > 0.28) body = '';   // 메뉴만 담겨 온 글
  // 본문 앞머리에 '게시판이름 담당부서 2026.01.14' 같은 머리표가 붙어 옵니다.
  // 어르신은 그 줄부터 읽기 시작하므로 첫 날짜까지를 잘라 냅니다.
  body = body.replace(/^(?:[가-힣]{2,12}\s+){1,3}\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\.?\s+/, '').trim();
  const region = DONG.filter(d => text.includes(d));
  return {
    cat: catOf(it.rawTitle, String(it.rawBody || '').slice(0, 200)),
    title: clean(it.rawTitle),
    body: body ? body.slice(0, 180) + '…' : '자세한 내용은 원문에서 확인하실 수 있습니다.',
    source: it.source,
    sourceUrl: it.sourceUrl,
    date: it.publishedAt,
    verified: new Date().toISOString().slice(0, 10),
    auto: true,
    ...(region.length ? { region } : {}),
    audience: AUDIENCE[it.source] || ['senior', 'resident'],
    ...(/(어르신|경로|노인|고령|연금|치매|경로당|복지관|보건소)/.test(text) ? { for65: true } : {}),
    ...(KEEP.test(text) ? { useful: true } : {})   // 어르신께 먼저 보일 글
  };
}

const main = async () => {
  const src = JSON.parse(await fs.readFile(SOURCES, 'utf8'));
  AUDIENCE = Object.fromEntries(src.sources.map(x => [x.name, x.audience || ['senior', 'resident']]));
  // 꺼 둔 소스의 글이 대기 목록에 남아 있어도 싣지 않습니다.
  // (소스를 끈 이유는 그 기관에서 쓸 만한 글이 안 나오기 때문입니다)
  const LIVE = new Set(src.sources.filter(x => x.enabled).map(x => x.name));

  const pending = JSON.parse(await fs.readFile(PENDING, 'utf8'));
  const feed = JSON.parse(await fs.readFile(FEED, 'utf8'));

  const passed = pending.filter(it => {
    if (!LIVE.has(it.source)) return false;
    if (!it.rawTitle || it.rawTitle.length < 6) return false;
    // 제목이 '…채..' 처럼 잘려 오는 게시판이 있어, 본문 앞머리까지 함께 봅니다
    const head = `${it.rawTitle} ${String(it.rawBody || '').slice(0, 300)}`;
    if (DROP.test(head) || NOT_A_POST.test(it.rawTitle)) return false;
    return true;   // 공식 기관이 구민에게 알리려고 올린 글이다 — 기본은 싣는다
  });

  const CUTOFF = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10);   // 2년

  const seen = new Set();
  const notices = passed.map(toNotice)
    .filter(n => n.title && n.date && n.date >= CUTOFF)
    // 같은 제목이라도 기관이 다르면 다른 글입니다.
    // 제목만으로 지우면 '공지사항' 같은 흔한 이름의 글이 통째로 사라집니다.
    .filter(n => { const k = n.source + '|' + n.title.replace(/\s/g, '');
      if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // 손으로 정리해 둔 안내(auto 아님)는 남기고, 자동 수집분만 새로 갈아 끼운다
  const curated = (feed.notices || []).filter(n => !n.auto);
  feed.notices = [...notices, ...curated];
  feed.meta.lastUpdated = new Date().toISOString().slice(0, 10);
  feed.meta.autoCount = notices.length;

  await fs.writeFile(FEED, JSON.stringify(feed, null, 2), 'utf8');
  console.log(`수집 ${pending.length}건 → 선별 통과 ${passed.length}건 → 피드 게시 ${notices.length}건`);
  console.log('버려진 글 예시:', pending.filter(it => DROP.test(it.rawTitle)).slice(0, 3).map(i => i.rawTitle.slice(0, 30)).join(' / ') || '(없음)');
};
main().catch(e => { console.error(e); process.exit(1); });
