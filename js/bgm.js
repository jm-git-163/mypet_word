/* ============================================================
   bgm.js — 배경음과 효과음

   ① 배경음: 앱이 그 자리에서 소리를 만들어 냅니다.
      · 음악 파일이 필요 없어 앱이 무거워지지 않고, 인터넷도 필요 없습니다.
      · 화음(코드)이 네 마디로 돌고 가락은 그 위에서 매번 새로 나옵니다.
        그래서 몇 시간을 들어도 같은 곡이 반복되지 않으면서도 음악답게 들립니다.
      · 우리 가락에 쓰이는 다섯 음(오음계)만 써서 어긋나는 음이 없습니다.
      ※ 직접 받아 두신 음악 파일(audio/bgm/*.mp3)이 있으면 그걸 먼저 씁니다.

   ② 효과음: 맞혔을 때·글자를 놓을 때 짧고 부드러운 소리를 냅니다.
      · 삐 소리가 아니라 실로폰·나무 소리처럼 울림이 있는 소리를 씁니다.
        (배음을 겹치고 잔향을 더해 만듭니다 — 소리가 얇지 않고 포근합니다)
      · 높은 소리(4kHz 위)를 쓰지 않습니다. 나이가 들면 높은 소리부터 잘 안 들립니다.
      · 틀렸을 때는 소리를 내지 않습니다.
   ============================================================ */
(function (global) {
  'use strict';

  const Audio2 = {
    ctx: null, master: null, bgmGain: null, sfxGain: null, wet: null,
    timer: null, playing: false, fileEl: null, useFile: false,
    step: 0, placeRun: 0, placeAt: 0,

    ensure() {
      if (this.ctx) return this.ctx;
      try {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // 소리가 겹쳐도 찢어지지 않게 마지막에 한 번 눌러 줍니다
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -12; comp.knee.value = 22;
        comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
        comp.connect(c.destination);

        this.master = c.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(comp);

        // ── 울림(잔향) ──
        // 작은 방에서 나는 울림을 그 자리에서 만들어 씁니다.
        // 울림이 있으면 같은 소리도 훨씬 부드럽고 값지게 들립니다.
        this.wet = c.createGain();
        this.wet.gain.value = 0.34;
        try {
          const conv = c.createConvolver();
          conv.buffer = this.makeRoom(1.9);
          const damp = c.createBiquadFilter();
          damp.type = 'lowpass'; damp.frequency.value = 2200;   // 울림의 높은 소리를 깎아 포근하게
          this.wet.connect(conv); conv.connect(damp); damp.connect(this.master);
        } catch (e) { this.wet.connect(this.master); }

        this.bgmGain = c.createGain();
        this.bgmGain.gain.value = 0;              // 조용히 시작해 서서히 올립니다
        this.bgmGain.connect(this.master);
        const bw = c.createGain(); bw.gain.value = 0.5;
        this.bgmGain.connect(bw); bw.connect(this.wet);

        this.sfxGain = c.createGain();
        this.sfxGain.gain.value = 1;
        this.sfxGain.connect(this.master);
        this.sfxGain.connect(this.wet);
      } catch (e) { this.ctx = null; }
      return this.ctx;
    },

    /** 방 울림 만들기 — 사그라드는 잡음으로 만듭니다 */
    makeRoom(sec) {
      const c = this.ctx, n = Math.floor(c.sampleRate * sec);
      const buf = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < n; i++) {
          const decay = Math.pow(1 - i / n, 2.6);
          // 부드럽게 흐리기 — 거친 잡음이 그대로 남으면 '치익' 소리가 납니다
          last = (last * 0.72) + (Math.random() * 2 - 1) * 0.28;
          d[i] = last * decay;
        }
      }
      return buf;
    },

    resume() {
      const c = this.ensure();
      if (c && c.state === 'suspended') c.resume();
    },

    /* ══════════ 소리 한 알 ══════════════════════
       실로폰·오르골처럼 들리도록 배음을 함께 냅니다.
       배음이 없는 소리는 '삐' 하는 기계음으로 들립니다.
       ══════════════════════════════════════════ */

    /**
     * 울림 있는 한 음.
     * @param freq  음 높이
     * @param when  언제 (초)
     * @param dur   울리는 길이
     * @param vol   크기
     * @param kind  'bell'(오르골) | 'wood'(나무) | 'soft'(포근한 패드)
     * @param bus   나갈 곳 (기본: 효과음)
     */
    ping(freq, when, dur, vol, kind, bus, pan, open) {
      const c = this.ctx; if (!c) return;
      let out = bus || this.sfxGain;

      // 좌우 자리 — 소리마다 자리를 조금씩 달리하면 넓게 들립니다
      if (pan && c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(out); out = p;
      }

      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      const top = (open || 1) * (kind === 'wood' ? 2600 : 3000);
      f.frequency.setValueAtTime(top, when);
      f.frequency.exponentialRampToValueAtTime(Math.max(240, top * 0.24), when + dur);  // 갈수록 부드러워집니다
      f.Q.value = 0.7;

      const atk = kind === 'soft' ? 0.45 : (kind === 'wood' ? 0.004 : 0.012);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      g.connect(f); f.connect(out);

      // 배음 짜임 — 소리의 성격을 정합니다
      const parts = kind === 'wood'
        ? [[1, 1], [2.76, 0.34], [5.4, 0.12]]          // 나무·실로폰
        : kind === 'soft'
          ? [[1, 1], [2, 0.28], [3, 0.10]]             // 포근한 패드
          : [[1, 1], [2, 0.42], [3, 0.16], [4.2, 0.07]]; // 오르골

      parts.forEach(([mul, amp], i) => {
        const o = c.createOscillator(), og = c.createGain();
        o.type = (kind === 'soft' && i === 0) ? 'triangle' : 'sine';
        o.frequency.value = freq * mul;
        if (i > 0) o.detune.value = (i % 2 ? 4 : -4);   // 아주 살짝 어긋내 두툼하게
        og.gain.value = amp;
        // 배음은 먼저 사그라듭니다 (진짜 악기가 그렇습니다)
        og.gain.setValueAtTime(amp, when);
        if (i > 0) og.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.45);
        o.connect(og); og.connect(g);
        o.start(when); o.stop(when + dur + 0.06);
      });
    },

    /** 효과음 하나 (설정이 꺼져 있으면 나지 않습니다) */
    fx(notes, kind, vol) {
      if (!global.Store || !global.Store.data.settings.sfx) return;
      const c = this.ensure(); if (!c) return;
      this.resume();
      const t0 = c.currentTime + 0.02;
      notes.forEach(([freq, delay, dur, amp]) =>
        this.ping(freq, t0 + delay, dur, (amp || 1) * (vol || 0.16), kind));
    },

    /* ── 자리마다 쓰이는 소리 ── */

    /** 단추를 누를 때 — 나무를 톡 */
    tap() { this.fx([[523.25, 0, 0.20, 1]], 'wood', 0.22); },

    /**
     * 글자를 놓을 때 — 이어서 놓으면 음이 한 계단씩 올라갑니다.
     * 잘 되어 간다는 느낌이 손끝으로 전해집니다.
     */
    place() {
      const now = Date.now();
      this.placeRun = (now - this.placeAt < 2600) ? Math.min(this.placeRun + 1, 5) : 0;
      this.placeAt = now;
      const up = [392.00, 440.00, 493.88, 523.25, 587.33, 659.25][this.placeRun];
      this.fx([[up, 0, 0.26, 1], [up * 2, 0.03, 0.16, 0.35]], 'wood', 0.24);
    },

    /** 낱말을 하나 맞혔을 때 — 맑게 올라가는 세 음 */
    word() {
      this.placeRun = 0;
      this.fx([
        [523.25, 0, 0.5, 0.9],
        [659.25, 0.075, 0.5, 0.95],
        [783.99, 0.15, 0.9, 1],
        [1046.50, 0.15, 0.9, 0.4]
      ], 'bell', 0.15);
    },

    /** 도움을 받았을 때 — 반짝 */
    hint() {
      this.fx([
        [880.00, 0, 0.5, 0.7],
        [1174.66, 0.07, 0.6, 0.55],
        [1318.51, 0.14, 0.75, 0.35]
      ], 'bell', 0.17);
    },

    /** 판을 다 채웠을 때 — 작은 축하 가락 */
    clear() {
      this.placeRun = 0;
      // 가락
      this.fx([
        [523.25, 0.00, 0.55, 0.9],
        [659.25, 0.13, 0.55, 0.9],
        [783.99, 0.26, 0.55, 0.95],
        [1046.50, 0.39, 1.5, 1.0],
        [783.99, 0.39, 1.5, 0.45],
        [659.25, 0.39, 1.5, 0.35]
      ], 'bell', 0.16);
      // 아래를 받쳐 주는 낮은 음 — 있으면 훨씬 든든하게 들립니다
      this.fx([
        [130.81, 0.00, 1.1, 1],
        [196.00, 0.39, 1.6, 1]
      ], 'soft', 0.13);
    },
    // 틀렸을 때 소리는 없습니다 (DESIGN §13)

    /* ══════════ 배경음 ══════════════════════════
       한 마디마다 화음이 바뀌고, 여덟 마디마다 진행이 바뀝니다.
       화음은 앞 화음과 가장 가까운 자리로 옮겨 가고(성부 연결),
       그 위에 물결 같은 아르페지오와 가락이 얹힙니다.
       화면의 계절·때에 따라 빠르기와 밝기가 달라집니다.
       ══════════════════════════════════════════ */

    /** 음 번호를 소리 높이로 (60 = 가운데 도) */
    hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

    // 다장조 오음계 — 도 레 미 솔 라
    PENTA: [0, 2, 4, 7, 9],

    /**
     * 화음 — [뿌리음, 화음을 이루는 음]
     * 오음계 가락과 부딪히지 않는 순한 화음만 골랐습니다.
     */
    CH: {
      C: [48, [0, 4, 7]],
      Am: [45, [9, 0, 4]],
      F: [41, [5, 9, 0]],
      G: [43, [7, 11, 2]],
      Dm: [38, [2, 5, 9]]
    },

    /** 진행 여섯 가지 — 여덟 마디마다 하나씩 골라 씁니다 */
    FLOWS: [
      ['C', 'Am', 'F', 'G'],
      ['C', 'F', 'Am', 'G'],
      ['Am', 'F', 'C', 'G'],
      ['F', 'G', 'C', 'Am'],
      ['C', 'G', 'Am', 'F'],
      ['Dm', 'G', 'C', 'Am']
    ],

    /**
     * 풍경에 맞춘 결.
     * 봄은 밝고 촘촘하게, 겨울은 느긋하고 성글게.
     */
    TONE: {
      봄: { bar: 4.0, open: 1.15, arp: 6, mel: 3 },
      여름: { bar: 4.3, open: 1.05, arp: 5, mel: 3 },
      가을: { bar: 4.9, open: 0.85, arp: 4, mel: 2 },
      겨울: { bar: 5.5, open: 0.70, arp: 3, mel: 2 }
    },
    WHEN: {
      새벽: { slow: 1.15, quiet: 0.78, open: 0.82 },
      아침: { slow: 0.96, quiet: 1.00, open: 1.10 },
      한낮: { slow: 1.00, quiet: 1.00, open: 1.00 },
      해질녘: { slow: 1.06, quiet: 0.92, open: 0.88 },
      밤: { slow: 1.18, quiet: 0.74, open: 0.76 }
    },

    scene: null,
    /** 화면이 바뀌면 음악의 결도 함께 바꿉니다 */
    setScene(sc) {
      if (!sc) return;
      const key = sc.season + '|' + sc.time;
      if (this._sceneKey === key) return;
      this._sceneKey = key;
      const t = this.TONE[sc.season] || this.TONE.봄;
      const w = this.WHEN[sc.time] || this.WHEN.한낮;
      this.scene = {
        bar: t.bar * w.slow,
        open: t.open * w.open,
        vol: w.quiet,
        arp: Math.max(2, Math.round(t.arp * (w.quiet > 0.8 ? 1 : 0.7))),
        mel: t.mel
      };
    },

    /**
     * 화음을 앞 화음과 가장 가까운 자리에 놓습니다.
     * 이렇게 하면 화음이 껑충 뛰지 않고 스르르 이어집니다 — 훨씬 음악답게 들립니다.
     */
    voice(pcs) {
      const prev = this._prevVoicing || [60, 64, 67];

      // 앞 화음의 세 음을 새 화음의 어느 음이 이어받을지,
      // 짝짓는 여섯 가지를 모두 따져 가장 적게 움직이는 짝을 고릅니다.
      const ORDER = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      let best = null, bestCost = 1e9;

      ORDER.forEach(ord => {
        const v = [];
        let cost = 0;
        for (let i = 0; i < 3; i++) {
          const pc = pcs[ord[i]], target = prev[i];
          // 같은 음이름 중 앞 음과 가장 가까운 옥타브
          let m = pc + 12 * Math.round((target - pc) / 12);
          v.push(m);
          cost += Math.abs(m - target);
        }
        // 너무 낮거나 높게 뭉치면 웅웅거리거나 날카로워집니다
        const mid = (v[0] + v[1] + v[2]) / 3;
        if (mid < 57 || mid > 71) cost += 24;
        if (cost < bestCost) { bestCost = cost; best = v; }
      });

      return best;
    },

    /**
     * 한 마디를 이어 붙입니다.
     * @param at 이 마디를 시작할 때 (비우면 '지금'. 검사할 때만 넣습니다)
     */
    weave(at) {
      if (!this.playing || this.useFile) return;
      const c = this.ctx; if (!c) return;

      const S = this.scene || { bar: 4.4, open: 1, vol: 1, arp: 4, mel: 2 };
      const bar = S.bar;
      const t = at === undefined ? c.currentTime + 0.12 : at;
      const V = S.vol;

      // 여덟 마디마다 진행을 바꿉니다 (같은 자리를 도는 느낌을 없앱니다)
      if (this.step % 8 === 0) {
        let n = Math.floor(Math.random() * this.FLOWS.length);
        if (n === this._flowIdx) n = (n + 1) % this.FLOWS.length;
        this._flowIdx = n;
      }
      const flow = this.FLOWS[this._flowIdx || 0];
      const [rootM, pcs] = this.CH[flow[this.step % 4]];
      const notes = this.voice(pcs);
      this._prevVoicing = notes;

      // ① 아래를 받치는 뿌리음 — 가운데에서 든든하게
      this.ping(this.hz(rootM), t, bar * 1.2, 0.052 * V, 'soft', this.bgmGain, 0, S.open);
      this.ping(this.hz(rootM + 12), t + 0.05, bar * 0.9, 0.020 * V, 'soft', this.bgmGain, 0, S.open);

      // ② 화음 — 천천히 스며들고, 좌우로 조금씩 벌려 놓습니다
      notes.forEach((m, i) =>
        this.ping(this.hz(m), t + i * 0.12, bar * 1.1, 0.026 * V, 'soft',
          this.bgmGain, (i - 1) * 0.42, S.open));

      // ③ 아르페지오 — 화음을 한 알씩 굴려 물결 같은 움직임을 만듭니다.
      //    이게 없으면 소리가 멈춰 있는 것처럼 들려 심심합니다.
      const arp = notes.concat(notes.map(m => m + 12));
      const gap = (bar * 0.82) / S.arp;
      for (let i = 0; i < S.arp; i++) {
        const m = arp[i % arp.length];
        this.ping(this.hz(m), t + 0.25 + i * gap, 1.5, 0.016 * V, 'bell',
          this.bgmGain, (i % 2 ? 0.5 : -0.5), S.open);
      }

      // ④ 가락 — 오음계 위를 걸어 다닙니다. 마디마다 다르게 나옵니다.
      let deg = this._deg === undefined ? 2 : this._deg;
      for (let i = 0; i < S.mel; i++) {
        // 바로 옆 음으로만 움직여 가락이 튀지 않게 합니다
        deg = Math.max(0, Math.min(this.PENTA.length * 2 - 1, deg + (Math.floor(Math.random() * 5) - 2)));
        const m = 60 + this.PENTA[deg % this.PENTA.length] + 12 * Math.floor(deg / this.PENTA.length);
        this.ping(this.hz(m), t + 0.45 + i * (bar / (S.mel + 0.6)),
          2.2 + Math.random(), 0.040 * V, 'bell', this.bgmGain, 0, S.open);
      }
      this._deg = deg;

      this.step++;
      this.timer = setTimeout(() => this.weave(), bar * 1000);
    },

    /** 직접 받아 두신 음악 파일이 있으면 그것을 먼저 씁니다 */
    checkFiles() {
      return fetch('audio/bgm/index.json', { cache: 'no-cache' })
        .then(r => r.ok ? r.json() : null)
        .then(j => (j && j.files && j.files.length) ? j.files : null)
        .catch(() => null);
    },

    start() {
      if (!global.Store || !global.Store.data.settings.bgm) return;
      if (this.playing) return;
      const c = this.ensure(); if (!c) return;
      this.resume();
      this.playing = true;

      this.checkFiles().then(files => {
        if (!this.playing) return;
        if (files && files.length) {
          // 받아 둔 음악 파일 재생
          this.useFile = true;
          if (!this.fileEl) { this.fileEl = new Audio(); this.fileEl.loop = true; }
          this.fileEl.src = 'audio/bgm/' + files[Math.floor(Math.random() * files.length)];
          this.fileEl.volume = 0.18;                     // 아주 작게 (말소리를 덮지 않게)
          this.fileEl.play().catch(() => { this.useFile = false; this.weave(); });
        } else {
          // 앱이 직접 만들어 냅니다
          this.useFile = false;
          this.bgmGain.gain.cancelScheduledValues(c.currentTime);
          this.bgmGain.gain.setValueAtTime(0, c.currentTime);
          this.bgmGain.gain.linearRampToValueAtTime(1, c.currentTime + 3.5);  // 스며들 듯
          this.step = 0;
          this.weave();
        }
      });
    },

    stop() {
      this.playing = false;
      clearTimeout(this.timer);
      if (this.fileEl) { try { this.fileEl.pause(); } catch (e) { } }
      const c = this.ctx;
      if (c && this.bgmGain) {
        this.bgmGain.gain.cancelScheduledValues(c.currentTime);
        this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, c.currentTime);
        this.bgmGain.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);   // 뚝 끊기지 않게
      }
    },

    /** 설정이 바뀌면 불러 줍니다 */
    sync() {
      if (!global.Store) return;
      if (global.Store.data.settings.bgm) this.start(); else this.stop();
    }
  };

  global.Audio2 = Audio2;
})(window);
