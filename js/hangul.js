/* ============================================================
   hangul.js — 한글 처리 엔진
   TECH_SPEC.md §5 구현
   ============================================================ */
(function (global) {
  'use strict';

  const SBASE = 0xac00, SLAST = 0xd7a3;
  const LCOUNT = 19, VCOUNT = 21, TCOUNT = 28;
  const NCOUNT = VCOUNT * TCOUNT; // 588

  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  /** 음절 코드가 한글 완성형인지 */
  function isSyllable(ch) {
    if (!ch) return false;
    const c = ch.codePointAt(0);
    return c >= SBASE && c <= SLAST;
  }

  /** 문자열이 전부 한글 완성형인지 */
  function isAllHangul(s) {
    for (const ch of s) if (!isSyllable(ch)) return false;
    return s.length > 0;
  }

  /** 음절 → {lead, vowel, tail} 인덱스 */
  function decomposeIndex(ch) {
    const s = ch.codePointAt(0) - SBASE;
    return { lead: Math.floor(s / NCOUNT), vowel: Math.floor((s % NCOUNT) / TCOUNT), tail: s % TCOUNT };
  }

  /** 인덱스 → 음절 */
  function compose(lead, vowel, tail) {
    return String.fromCharCode(((lead * VCOUNT) + vowel) * TCOUNT + tail + SBASE);
  }

  /** 음절 → ['ㅇ','ㅗ','']  (자모 문자 배열) */
  function decompose(ch) {
    if (!isSyllable(ch)) return [ch];
    const { lead, vowel, tail } = decomposeIndex(ch);
    return [CHO[lead], JUNG[vowel], JONG[tail]].filter(x => x !== '');
  }

  /** 문자열 → 자모 배열 (평탄화) */
  function toJamo(s) {
    const out = [];
    for (const ch of s) out.push(...decompose(ch));
    return out;
  }

  /** 문자열 → 초성 문자열. '온고지신' → 'ㅇㄱㅈㅅ' */
  function choseong(s) {
    let out = '';
    for (const ch of s) out += isSyllable(ch) ? CHO[decomposeIndex(ch).lead] : ch;
    return out;
  }

  /** 종성 유무 */
  function hasTail(ch) {
    return isSyllable(ch) && decomposeIndex(ch).tail !== 0;
  }

  /**
   * 조사 자동 선택. TECH_SPEC §5.3
   * particle('사과','을','를') → '를'
   * particle('온고지신','으로','로') → '로'   ('ㄹ' 받침 예외 처리)
   */
  function particle(word, withTail, withoutTail) {
    if (!word) return withoutTail;
    const last = [...word].pop();
    if (!isSyllable(last)) return withoutTail;
    const t = decomposeIndex(last).tail;
    if (t === 0) return withoutTail;
    // '으로/로' 계열: ㄹ 받침(8)은 받침 없는 형태를 씀
    if (t === 8 && (withoutTail === '로' || withoutTail === '로서' || withoutTail === '로써')) return withoutTail;
    return withTail;
  }

  /** '사과' + '을/를' 을 붙여 반환 */
  function withParticle(word, pair) {
    const [a, b] = pair.split('/');
    return word + particle(word, a, b);
  }

  /** 정렬된 음절 다중집합 키. '온고지신' → '고신온지' */
  function syllableBagKey(s) {
    return [...s].filter(isSyllable).sort().join('');
  }

  /** 다중집합 포함 여부: word의 음절이 bag 안에 모두 있는가 */
  function isSubsetOfBag(word, bagArr) {
    const pool = bagArr.slice();
    for (const ch of word) {
      const i = pool.indexOf(ch);
      if (i === -1) return false;
      pool.splice(i, 1);
    }
    return true;
  }

  /** 두 낱말의 자모 유사도 0~1 (혼동어 후보 생성용) */
  function similarity(a, b) {
    const x = toJamo(a), y = toJamo(b);
    const n = x.length, m = y.length;
    if (n === 0 || m === 0) return 0;
    const dp = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    return 1 - dp[n][m] / Math.max(n, m);
  }

  /** 낱말의 한 글자를 빈칸으로. maskIndex 위치 */
  function mask(word, idx, blank = '○') {
    return [...word].map((c, i) => (i === idx ? blank : c)).join('');
  }

  global.Hangul = {
    SBASE, SLAST, CHO, JUNG, JONG,
    isSyllable, isAllHangul, decompose, decomposeIndex, compose, toJamo,
    choseong, hasTail, particle, withParticle,
    syllableBagKey, isSubsetOfBag, similarity, mask
  };
})(window);
