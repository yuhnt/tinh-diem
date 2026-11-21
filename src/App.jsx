import { Component } from 'preact';
import { T } from './i18n.js';
import { vnd, signed, short, dur, CELLS, sv, num, fmt, uid, split } from './utils.js';
import { Back, Arrow, Pause, Play, Swap, Close } from './icons.jsx';

const KEY = 'bida-v2';
const THEMES = ['felt', 'navy', 'wine'];

export const initialState = () => ({
  screen: 'home', mode: 'pool', lang: 'vi', theme: 'felt', live: null,
  names2: ['Đội A', 'Đội B'], names3: ['Minh', 'Hùng', 'Tuấn'], race: 7, breakRule: 'alt',
  scores: [0, 0], breaker: 0, winner: null,
  pts: [0, 0, 0], last: [null, null, null], moneyOn: false, unit: 10000, unitCustom: '', denRack: 1,
  gone: [], joinAt: [0, 0, 0], carry: [0, 0, 0], sub: null, billOverride: '',
  rate: 60000, split: 'equal', tStart: null, tAcc: 0,
  xdDealer: 'Nam', xdNames: ['Minh', 'Hùng', 'Tuấn', 'Long'], xdBet: 20000, xdPlayers: [], xdGone: [], xdRound: 1, xdNew: '',
  hist: [], history: [],
});

/** Segmented control: options = [[value, label], ...] */
const Seg = ({ options, value, onPick, label, style }) => (
  <div class="seg" role="group" aria-label={label} style={style}>
    {options.map(([v, l]) => (
      <button type="button" key={String(v)} aria-pressed={value === v ? 'true' : 'false'} onClick={() => onPick(v)}>{l}</button>
    ))}
  </div>
);

const Ball = ({ n, size }) => (
  <span class={`ball b${n}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true"><i>{n}</i></span>
);

const selectAll = e => e.currentTarget.select();

export class App extends Component {
  state = initialState();

  componentDidMount() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }
    let v = null;
    try { v = new URLSearchParams(location.search).get('v'); } catch (e) { /* noop */ }
    const patch = { ...(saved || {}), hist: [], sub: null };
    if (THEMES.includes(v)) patch.theme = v;
    this.setState(patch);
    this.tick = setInterval(() => { if (this.state.tStart) this.forceUpdate(); }, 1000);
    this.onKey = e => {
      if (e.key !== 'Escape') return;
      if (this.state.sub) this.setState({ sub: null });
    };
    addEventListener('keydown', this.onKey);
  }
  componentWillUnmount() { clearInterval(this.tick); removeEventListener('keydown', this.onKey); }
  componentDidUpdate(_, prev) {
    const { hist, ...rest } = this.state;
    try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch (e) { /* quota / private mode */ }
    if (prev.lang !== this.state.lang) document.documentElement.lang = this.state.lang;
    if (prev.screen !== this.state.screen) {
      const h = document.querySelector('h1');
      if (h && this.state.screen !== 'home') { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      scrollTo(0, 0);
    }
    const opened = (!prev.sub && this.state.sub) || (prev.winner == null && this.state.winner != null);
    if (opened) { const el = document.querySelector('[role=dialog] [data-autofocus]'); if (el) el.focus(); }
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = { felt: '#0f4d3a', navy: '#1d3f6e', wine: '#5a1f2a' }[this.state.theme] || '#0f4d3a';
  }

  /* ---------- game logic (ported 1:1 from the design) ---------- */
  snap() {
    const { scores, breaker, winner, pts, last, history, denRack, names3, gone, joinAt, carry, xdPlayers, xdGone, xdRound } = this.state;
    return { scores, breaker, winner, pts, last, history, denRack, names3, gone, joinAt, carry, xdPlayers, xdGone, xdRound };
  }
  commit(patch) { const snap = this.snap(); this.setState(s => ({ ...patch, hist: [...s.hist.slice(-80), snap] })); }
  undo = () => { const h = this.state.hist; if (h.length) this.setState({ ...h[h.length - 1], hist: h.slice(0, -1) }); };
  ms() { const s = this.state; return s.tAcc + (s.tStart ? Date.now() - s.tStart : 0); }
  billAuto() { return Math.round((this.state.rate * this.ms()) / 3600000 / 1000) * 1000; }
  bill() { const o = parseInt((this.state.billOverride || '').replace(/\D/g, ''), 10); return isNaN(o) ? this.billAuto() : o; }
  people() {
    const s = this.state, ms = this.ms(), c = s.carry || [0, 0, 0];
    return [
      ...s.names3.map((name, i) => ({ name, p: s.pts[i] + c[i], played: ms - s.joinAt[i], gone: false })),
      ...s.gone.map(g => ({ ...g, gone: true })),
    ];
  }
  when() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }
  record(game, result) { return [{ when: this.when(), game, result, dur: dur(this.ms()), bill: vnd(this.bill()) }, ...this.state.history].slice(0, 50); }
  xdInit() {
    const s = this.state;
    return { xdPlayers: s.xdNames.map(n => n.trim()).filter(Boolean).map(name => ({ id: uid(), name, bal: 0, rnd: 0, bet: fmt(s.xdBet) })), xdGone: [], xdRound: 1, xdNew: '' };
  }
  xdAll() { const s = this.state; return [...s.xdPlayers.map(p => ({ name: p.name, bal: p.bal })), ...s.xdGone]; }
  xdMove(id, sign) {
    const s = this.state;
    const xdPlayers = s.xdPlayers.map(p => { if (p.id !== id) return p; const amt = num(p.bet) || s.xdBet; return { ...p, bal: p.bal + sign * amt, rnd: p.rnd + sign * amt }; });
    this.commit({ xdPlayers });
  }
  xdAdd = e => {
    if (e) e.preventDefault();
    const s = this.state, name = s.xdNew.trim(); if (!name) return;
    this.commit({ xdPlayers: [...s.xdPlayers, { id: uid(), name, bal: 0, rnd: 0, bet: fmt(s.xdBet) }] });
    this.setState({ xdNew: '' });
  };
  xdRemove(id) {
    const s = this.state, p = s.xdPlayers.find(x => x.id === id); if (!p) return;
    this.commit({ xdPlayers: s.xdPlayers.filter(x => x.id !== id), xdGone: p.bal ? [...s.xdGone, { name: p.name, bal: p.bal }] : s.xdGone });
  }
  start = () => {
    const m = this.state.mode;
    this.setState({ screen: m, live: m, scores: [0, 0], breaker: 0, winner: null, pts: [0, 0, 0], last: [null, null, null], denRack: 1, gone: [], joinAt: [0, 0, 0], carry: [0, 0, 0], sub: null, billOverride: '', tStart: Date.now(), tAcc: 0, hist: [], ...(m === 'xd' ? this.xdInit() : {}) });
  };
  stopAll(extra) { this.setState({ screen: 'home', live: null, winner: null, tStart: null, tAcc: 0, hist: [], billOverride: '', gone: [], joinAt: [0, 0, 0], carry: [0, 0, 0], ...extra }); }
  tap(i) {
    const s = this.state; if (s.winner != null) return;
    const scores = [...s.scores]; scores[i]++;
    const breaker = s.breakRule === 'winner' ? i : 1 - s.breaker;
    const winner = scores[i] >= s.race ? i : null;
    const patch = { scores, breaker, winner };
    if (winner != null) patch.history = this.record(`Pool · ${s.names2[0]} – ${s.names2[1]}`, `${s.names2[i]} ${scores[i]}–${scores[1 - i]}`);
    this.commit(patch);
  }
  minus(i) { const s = this.state; if (!s.scores[i]) return; const scores = [...s.scores]; scores[i]--; this.commit({ scores, winner: null }); }
  add(i, d) { const pts = [...this.state.pts], last = [null, null, null]; pts[i] += d; last[i] = d; this.commit({ pts, last }); }
  confirmSub = e => {
    if (e) e.preventDefault();
    const s = this.state, sb = s.sub; if (!sb || !sb.name.trim()) return;
    const i = sb.i, ms = this.ms();
    const names3 = [...s.names3], joinAt = [...s.joinAt], carry = (s.carry || [0, 0, 0]).map((c, k) => c + s.pts[k]);
    const gone = [...s.gone, { name: names3[i], p: carry[i], played: ms - joinAt[i] }];
    names3[i] = sb.name.trim(); carry[i] = 0; joinAt[i] = ms;
    this.commit({ names3, pts: [0, 0, 0], carry, joinAt, last: [null, null, null], gone, sub: null });
  };
  settle() {
    const a = this.people().map((x, i) => ({ i, p: x.p }));
    const deb = a.filter(x => x.p < 0).map(x => ({ i: x.i, p: -x.p })), cred = a.filter(x => x.p > 0).map(x => ({ ...x }));
    const out = [];
    for (const d of deb) for (const c of cred) { const m = Math.min(d.p, c.p); if (m > 0) { out.push({ from: d.i, to: c.i, amt: m }); d.p -= m; c.p -= m; } }
    return out;
  }
  toggleTimer = () => this.setState(st => (st.tStart ? { tAcc: st.tAcc + Date.now() - st.tStart, tStart: null } : { tStart: Date.now() }));
  go = screen => () => this.setState({ screen });
  onBill = e => { const n = parseInt(e.currentTarget.value.replace(/\D/g, ''), 10); this.setState({ billOverride: isNaN(n) ? '' : n.toLocaleString('vi-VN') }); };

  /* ---------- shared pieces ---------- */
  t() { return T[this.state.lang] || T.vi; }
  backBtn(onClick, label) {
    return <button type="button" onClick={onClick} class="ib" aria-label={label} title={label}><Back /></button>;
  }
  timerBtn() {
    const t = this.t(), running = !!this.state.tStart;
    return (
      <button type="button" onClick={this.toggleTimer} class="pill num" aria-label={`${t.timer} ${dur(this.ms())}, ${t.bill} ${vnd(this.bill())}`} aria-pressed={running ? 'true' : 'false'}>
        {running ? <Pause /> : <Play />}
        {dur(this.ms())}<span class="sm">{vnd(this.bill())}</span>
      </button>
    );
  }
  undoBtn() {
    return <button type="button" onClick={this.undo} disabled={!this.state.hist.length} class="pill">↶ {this.t().undo}</button>;
  }

  /* ---------- screens ---------- */
  home() {
    const s = this.state, t = this.t();
    const xdDealerBal = -this.xdAll().reduce((a, x) => a + x.bal, 0);
    const liveLabel = s.live === 'pool' ? `${s.names2[0]} ${s.scores[0]} – ${s.scores[1]} ${s.names2[1]}`
      : s.live === 'xd' ? `${t.xd} · ${t.dealer} ${s.xdDealer} ${sv(xdDealerBal)}`
      : s.names3.map((n, i) => `${n} ${signed(s.pts[i])}`).join(' · ');
    const pick = mode => () => this.setState({ screen: 'setup', mode });
    return (
      <div class="scr">
        <header class="top wrap">
          <div class="ttl" style="gap:12px">
            <Ball n={8} size={44} />
            <h1 class="h" style="font-size:28px">Bida <span class="hs" style="font:400 14px/1 'Be Vietnam Pro',system-ui,sans-serif;letter-spacing:0;color:var(--mut)">{t.brand}</span></h1>
          </div>
          <Seg label={t.theme} style="flex:none;border-radius:999px" value={s.theme} onPick={theme => this.setState({ theme })}
            options={THEMES.map(v => [v, <span key={v} class="sw" title={t[v]}><span class="sr">{t[v]}</span><span aria-hidden="true" style={`display:inline-block;width:16px;height:16px;border-radius:50%;vertical-align:-3px;border:2px solid currentColor;background:${{ felt: '#0f4d3a', navy: '#1d3f6e', wine: '#5a1f2a' }[v]}`} /></span>])} />
          <Seg label={t.langLabel} style="flex:none;border-radius:999px" value={s.lang} onPick={lang => this.setState({ lang })} options={[['vi', 'VI'], ['en', 'EN']]} />
        </header>
        <main class="body">
          <div class="wrap" style="display:flex;flex-direction:column;gap:28px">
            {s.live && (
              <button type="button" onClick={this.go(s.live)} class="ivc" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px 16px;box-shadow:0 20px 40px rgba(0,0,0,.25)">
                <span style="display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:14px;color:#8a2a21"><span style="width:10px;height:10px;border-radius:50%;background:#c8372d" />{t.resume}</span>
                <span style="flex:1 1 240px;min-width:0;font-weight:700;font-size:17px">{liveLabel}</span>
                <span style="height:48px;padding:0 20px;border-radius:999px;background:var(--ink);color:var(--ivory);display:inline-flex;align-items:center;gap:8px;font-weight:700">{t.resume}<Arrow /></span>
              </button>
            )}
            <section style="display:flex;flex-direction:column;gap:16px" aria-labelledby="choose">
              <h2 id="choose" class="h" style="font-size:clamp(30px,4vw,44px)">{t.choose}</h2>
              <div class="games">
                <button type="button" onClick={pick('pool')} class="game">
                  <span class="ball xl" aria-hidden="true"><i>9</i></span>
                  <span class="h" style="font-size:32px">{t.pool}</span>
                  <span style="color:var(--mut)">{t.poolSub}</span>
                  <span class="go">{t.start} →</span>
                </button>
                <button type="button" onClick={pick('den')} class="game">
                  <span style="display:flex" aria-hidden="true"><span class="ball xl b3"><i>3</i></span><span class="ball xl b2" style="margin-left:-28px"><i>2</i></span></span>
                  <span class="h" style="font-size:32px">{t.den}</span>
                  <span style="color:var(--mut)">{t.denSub}</span>
                  <span class="go">{t.start} →</span>
                </button>
                <button type="button" onClick={pick('xd')} class="game">
                  <span style="display:flex;height:88px;align-items:center" aria-hidden="true">
                    <span class="card" style="background:var(--ivory);color:#c8372d;transform:rotate(-10deg)">A<span>A</span></span>
                    <span class="card" style="margin-left:-16px;background:var(--ink);border:2px solid var(--ivory);color:var(--ivory);transform:rotate(8deg)">K<span>K</span></span>
                  </span>
                  <span class="h" style="font-size:32px">{t.xd}</span>
                  <span style="color:var(--mut)">{t.xdSub}</span>
                  <span class="go">{t.start} →</span>
                </button>
              </div>
            </section>
            <section style="display:flex;flex-direction:column;gap:14px" aria-labelledby="hist">
              <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">
                <h2 id="hist" class="h" style="font-size:clamp(26px,3.4vw,36px)">{t.history}</h2>
                <button type="button" onClick={this.go('history')} class="pill">{t.seeAll} →</button>
              </div>
              {s.history.length ? (
                <ul style="display:flex;flex-direction:column;gap:10px;list-style:none;margin:0;padding:0">
                  {s.history.slice(0, 4).map((r, k) => (
                    <li class="row" key={k}>
                      <span class="chip">{r.when}</span>
                      <span style="flex:1 1 200px;min-width:0;color:var(--mut);font-size:14px">{r.game}</span>
                      <span style="font-weight:700">{r.result}</span>
                    </li>
                  ))}
                </ul>
              ) : <p class="note">{t.empty}</p>}
            </section>
            <footer class="about">
              <h2 class="lbl">Bida · {t.brand}</h2>
              <p class="note">{t.about}</p>
            </footer>
          </div>
        </main>
      </div>
    );
  }

  setup() {
    const s = this.state, t = this.t(), isPool = s.mode === 'pool', key = isPool ? 'names2' : 'names3', names = s[key];
    const setName = (i, v) => this.setState(st => { const arr = [...st[key]]; arr[i] = v; return { [key]: arr }; });
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl"><h1 class="h" style="font-size:28px">{isPool ? t.pool : t.den}</h1></div>
          <button type="button" onClick={this.start} class="pill acc" style="padding:0 24px">{t.start} →</button>
        </header>
        <main class="body">
          <div class="cols">
            <section class="panel" aria-labelledby="names-l">
              <h2 class="lbl" id="names-l">{isPool ? t.players : t.order}</h2>
              {names.map((v, i) => (
                <label class="fld" style="padding-left:6px" key={i}>
                  <Ball n={i + 1} size={38} />
                  <input value={v} onInput={e => setName(i, e.currentTarget.value)} aria-label={`${t.order} ${i + 1}`} autocomplete="off" enterkeyhint="next" />
                </label>
              ))}
              {!isPool && <p class="note">{t.denNote}</p>}
            </section>
            <section class="panel">
              {isPool ? (
                <>
                  <h2 class="lbl" id="race-l">{t.raceTo}</h2>
                  <div class="step">
                    <button type="button" onClick={() => this.setState(st => ({ race: Math.max(1, st.race - 1) }))} class="ib" style="width:60px;height:60px" aria-label={`${t.raceTo} −1`}>−</button>
                    <output class="big" style="flex:1;text-align:center;font-size:84px" aria-labelledby="race-l" aria-live="polite">{s.race}</output>
                    <button type="button" onClick={() => this.setState(st => ({ race: Math.min(21, st.race + 1) }))} class="ib" style="width:60px;height:60px" aria-label={`${t.raceTo} +1`}>+</button>
                  </div>
                  <p class="note">{t.raceNote}</p>
                </>
              ) : (
                <>
                  <h2 class="lbl">{t.money}</h2>
                  <Seg label={t.money} value={s.moneyOn} onPick={moneyOn => this.setState({ moneyOn })} options={[[false, t.off], [true, t.on]]} />
                  {s.moneyOn && (
                    <>
                      <h3 class="lbl" style="margin-top:6px">{t.perPoint}</h3>
                      <Seg label={t.perPoint} value={s.unitCustom ? null : s.unit} onPick={unit => this.setState({ unit, unitCustom: '' })} options={[5000, 10000, 20000, 50000].map(u => [u, short(u)])} />
                      <label class={`fld${s.unitCustom ? ' on' : ''}`}>
                        <span class="u" style="padding:0 0 0 14px">{t.custom}</span>
                        <input inputmode="numeric" placeholder={t.customPh} value={s.unitCustom} class="num"
                          onInput={e => { const n = num(e.currentTarget.value); this.setState(st => ({ unitCustom: n ? n.toLocaleString('vi-VN') : '', unit: n || (st.unitCustom ? 10000 : st.unit) })); }} />
                        <span class="u">đ</span>
                      </label>
                    </>
                  )}
                </>
              )}
            </section>
            <section class="panel">
              <h2 class="lbl" id="rate-l">{t.rate}</h2>
              <div class="step">
                <button type="button" onClick={() => this.setState(st => ({ rate: Math.max(0, st.rate - 10000) }))} class="ib" aria-label={`${t.rate} −10.000`}>−</button>
                <label class="fld" style="flex:1">
                  <input inputmode="numeric" value={s.rate ? s.rate.toLocaleString('vi-VN') : ''} onFocus={selectAll} class="num" style="font:800 22px/1 'Fraunces',Georgia,serif" aria-labelledby="rate-l"
                    onInput={e => { const n = parseInt(e.currentTarget.value.replace(/\D/g, ''), 10); this.setState({ rate: isNaN(n) ? 0 : Math.min(n, 99999999) }); }} />
                  <span class="u">đ</span>
                </label>
                <button type="button" onClick={() => this.setState(st => ({ rate: st.rate + 10000 }))} class="ib" aria-label={`${t.rate} +10.000`}>+</button>
              </div>
              <h3 class="lbl" style="margin-top:6px">{t.split}</h3>
              <Seg label={t.split} value={s.split} onPick={v => this.setState({ split: v })} options={[['equal', t.equal], ['loser', t.loser]]} />
            </section>
          </div>
        </main>
      </div>
    );
  }

  pool() {
    const s = this.state, t = this.t(), billN = this.bill();
    const loser = s.winner != null ? s.names2[1 - s.winner] : '';
    const billNote = s.split === 'loser' ? `${loser} ${t.pays} ${vnd(billN)}` : split(billN, [1, 1]).map((v, i) => `${s.names2[i]} ${vnd(v)}`).join(' · ');
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl"><h1 class="h" style="font-size:24px">{t.raceTo} {s.race}</h1><span style="color:var(--mut);font-size:14px">{t.rack} {Math.min(s.scores[0] + s.scores[1] + 1, s.race * 2 - 1)}</span></div>
          {this.timerBtn()}
          <button type="button" onClick={() => this.commit({ breaker: 1 - s.breaker })} class="pill">{t.swap}</button>
          {this.undoBtn()}
        </header>
        <main class="duo">
          {[0, 1].map(i => (
            <section class="panel" style="padding:18px 0;gap:6px" key={i} aria-label={s.names2[i]}>
              <div style="display:flex;align-items:center;gap:12px;padding:0 20px;min-width:0">
                <Ball n={i + 1} size={44} />
                <h2 class="h ell" style="flex:1;min-width:0;font-size:24px">{s.names2[i]}</h2>
                {s.breaker === i && <span class="tag warn">{t.breakTag}</span>}
              </div>
              <button type="button" onClick={() => this.tap(i)} class="tapz" aria-label={`${s.names2[i]}: ${s.scores[i]}. ${t.tapHint}`}>
                <span class="big pscore" aria-live="polite">{s.scores[i]}</span>
              </button>
              <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:0 20px">
                <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
                  <div style="display:flex;gap:5px;flex-wrap:wrap" aria-hidden="true">
                    {Array.from({ length: s.race }, (_, k) => <span key={k} class={`pip${k < s.scores[i] ? ' on' : ''}`} />)}
                  </div>
                  <span style="font-size:13px;color:var(--mut)">{t.tapHint}</span>
                </div>
                <button type="button" onClick={() => this.minus(i)} class="ib" style="width:56px;height:56px" aria-label={`${s.names2[i]} −1`}>−</button>
              </div>
            </section>
          ))}
        </main>
        {s.winner != null && (
          <div class="ov">
            <div class="ivc modal" role="dialog" aria-modal="true" aria-labelledby="win-name">
              <span class="lbl red">{t.winner}</span>
              <h2 id="win-name" class="h" style="font-size:44px">{s.names2[s.winner]}</h2>
              <span class="big" style="font-size:40px">{s.scores[s.winner]} – {s.scores[1 - s.winner]}</span>
              <span style="font-size:14px;color:var(--inkmut)">{t.duration} {dur(this.ms())}</span>
              <label class={`fld lt${s.billOverride ? ' on' : ''}`}>
                <span class="u" style="padding:0 0 0 14px">{t.bill}</span>
                <input inputmode="numeric" value={s.billOverride} placeholder={vnd(this.billAuto()).replace('đ', '')} onInput={this.onBill} class="num" style="font:800 20px/1 'Fraunces',Georgia,serif" />
                <span class="u">đ</span>
              </label>
              <span style="font-size:14px;color:var(--inkmut)">{billNote}</span>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
                <button type="button" onClick={() => this.setState({ scores: [0, 0], winner: null, billOverride: '', breaker: s.winner != null ? 1 - s.winner : 0, hist: [] })} class="pill ink" style="flex:1 1 140px" data-autofocus>{t.rematch}</button>
                <button type="button" onClick={this.undo} class="pill lt">{t.undo}</button>
                <button type="button" onClick={() => this.stopAll({ scores: [0, 0] })} class="pill lt">{t.home}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  den() {
    const s = this.state, t = this.t(), people = this.people();
    const boardSum = s.pts.reduce((a, b) => a + b, 0);
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl">
            <h1 class="h" style="font-size:24px">{t.rack} {s.denRack}</h1>
            {boardSum !== 0 && <span role="status" class="tag warn">⚠ {t.boardWarn(signed(boardSum))}</span>}
          </div>
          {this.timerBtn()}
          {this.undoBtn()}
          <button type="button" onClick={() => this.commit({ denRack: s.denRack + 1, last: [null, null, null] })} class="pill">✓ {t.endRack}</button>
          <button type="button" onClick={this.go('result')} class="pill acc">{t.finish}</button>
        </header>
        <main class="trio">
          {s.names3.map((name, i) => {
            const p = s.pts[i], carry = (s.carry || [0, 0, 0])[i];
            return (
              <section class="panel" style="justify-content:space-between" key={i} aria-label={name}>
                <div style="display:flex;align-items:center;gap:8px;min-width:0">
                  <Ball n={i + 1} />
                  <h2 class="h ell" style="flex:1;min-width:0;font-size:21px">{name}</h2>
                  {s.last[i] != null && <span class="tag num">{t.last} {signed(s.last[i])}</span>}
                  <button type="button" onClick={() => this.setState({ sub: { i, name: '' } })} class="ib" style="width:40px;height:40px" aria-label={`${t.swapP}: ${name}`} title={t.swapP}><Swap /></button>
                </div>
                <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;flex-wrap:wrap">
                  <span class={`big${p < 0 ? ' neg' : ''}`} style="font-size:clamp(72px,9vw,108px)" aria-live="polite">{signed(p)}</span>
                  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                    {!!carry && <span class="tag num" style="color:var(--fg)">{t.sum} {signed(people[i].p)}</span>}
                    {s.moneyOn && <span class={`num${p < 0 ? ' neg' : ''}`} style="font-weight:700;font-size:15px">{(p < 0 ? '−' : p > 0 ? '+' : '') + vnd(Math.abs(p * s.unit))}</span>}
                  </div>
                </div>
                <div class="cells">
                  {CELLS.map(d => (
                    <button type="button" key={d} class={d > 0 ? 'p' : ''} onClick={() => this.add(i, d)} aria-label={`${name} ${signed(d)}`}>{signed(d)}</button>
                  ))}
                </div>
              </section>
            );
          })}
        </main>
        {s.sub && (
          <div class="ov" onClick={e => { if (e.target === e.currentTarget) this.setState({ sub: null }); }}>
            <form class="ivc modal" role="dialog" aria-modal="true" aria-labelledby="sub-t" onSubmit={this.confirmSub}>
              <h2 class="lbl red" id="sub-t">{t.swapP} · {t.seat} {s.sub.i + 1}</h2>
              <p style="font-size:15px;text-wrap:pretty;margin:0">{t.subNote(s.names3[s.sub.i], signed(people[s.sub.i].p))}</p>
              <label class="fld lt">
                <input value={s.sub.name} onInput={e => { const v = e.currentTarget.value; this.setState(st => ({ sub: { ...st.sub, name: v } })); }} placeholder={t.newName} aria-label={t.newName} data-autofocus autocomplete="off" enterkeyhint="done" />
              </label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                <button type="button" onClick={() => this.setState({ sub: null })} class="pill lt" style="flex:1 1 120px">{t.cancel}</button>
                <button type="submit" class="pill ink" style="flex:1 1 120px" disabled={!s.sub.name.trim()}>{t.confirm}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  result() {
    const s = this.state, t = this.t(), people = this.people(), billN = this.bill(), billA = this.billAuto();
    const ranked = people.map((x, i) => ({ ...x, i })).sort((a, b) => b.p - a.p);
    const lowest = ranked[ranked.length - 1];
    const settle = this.settle();
    const ptsLabel = n => (s.moneyOn ? vnd(n * s.unit) : `${n} ${t.pt}`);
    const sum = people.reduce((a, x) => a + x.p, 0);
    const even = split(billN, people.map(x => Math.max(x.played, 1)));
    const shares = people.map((x, i) => ({ name: x.name, amt: vnd(s.split === 'loser' ? (i === lowest.i ? billN : 0) : even[i]) }));
    const close = () => this.stopAll({ pts: [0, 0, 0], last: [null, null, null], denRack: 1, history: this.record(`${t.den} · ${s.denRack - 1} ${t.rack.toLowerCase()} · ${s.names3.join(', ')}`, ranked.map(r => `${r.name} ${signed(r.p)}`).join(' · ')) });
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('den'), t.cont)}
          <div class="ttl"><h1 class="h" style="font-size:28px">{t.summary}</h1><span style="color:var(--mut);font-size:14px">{s.denRack - 1} {t.racksDone}</span></div>
          <button type="button" onClick={this.go('den')} class="pill">{t.cont}</button>
          <button type="button" onClick={close} class="pill acc">{t.close}</button>
        </header>
        <main class="body">
          <div class="cols">
            <section class="panel">
              <h2 class="lbl">{t.standing}</h2>
              {sum !== 0 && <span role="status" class="tag warn" style="align-self:flex-start;white-space:normal">⚠ {t.boardWarn(signed(sum))}</span>}
              <ol style="display:flex;flex-direction:column;gap:12px;list-style:none;margin:0;padding:0">
                {ranked.map((r, k) => (
                  <li class="row bg" key={k}>
                    <span class="h" style="font-size:22px;color:var(--mut);width:20px">{k + 1}</span>
                    <span class="ell" style="flex:1;min-width:0;font-weight:700">{r.name}</span>
                    <span class={`big${r.p < 0 ? ' neg' : ''}`} style="font-size:32px">{signed(r.p)}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section class="panel">
              <h2 class="lbl">{t.whoPays}</h2>
              {settle.map((x, k) => (
                <div class="ivc" style="padding:14px 18px;gap:4px;border-radius:22px" key={k}>
                  <span style="font-weight:600">{people[x.from].name} → {people[x.to].name}</span>
                  <span class="big" style="font-size:30px">{ptsLabel(x.amt)}</span>
                </div>
              ))}
              {!settle.length && <p class="note">{t.even}</p>}
            </section>
            <section class="panel">
              <h2 class="lbl" id="bill-l">{t.bill}</h2>
              <label class={`fld${s.billOverride ? ' on' : ''}`}>
                <input inputmode="numeric" value={s.billOverride} placeholder={vnd(billA).replace('đ', '')} onInput={this.onBill} class="num" style="font:800 22px/1 'Fraunces',Georgia,serif" aria-labelledby="bill-l" />
                <span class="u">đ</span>
              </label>
              <p class="note">{t.billAuto}: {dur(this.ms())} × {vnd(s.rate)}/h = {vnd(billA)}</p>
              {!!s.billOverride && <button type="button" onClick={() => this.setState({ billOverride: '' })} class="pill" style="align-self:flex-start;height:40px">{t.useAuto}</button>}
              {shares.map((b, k) => (
                <div class="split-row" key={k}><span style="font-weight:600">{b.name}</span><span class="num" style="font-weight:700">{b.amt}</span></div>
              ))}
            </section>
          </div>
        </main>
      </div>
    );
  }

  xdSetup() {
    const s = this.state, t = this.t();
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl"><h1 class="h" style="font-size:28px">{t.xd}</h1></div>
          <button type="button" onClick={this.start} class="pill acc" style="padding:0 24px">{t.start} →</button>
        </header>
        <main class="body">
          <div class="cols">
            <section class="panel">
              <h2 class="lbl" id="dealer-l">{t.dealer}</h2>
              <label class="fld on"><input value={s.xdDealer} onInput={e => this.setState({ xdDealer: e.currentTarget.value })} aria-labelledby="dealer-l" style="font-weight:700" autocomplete="off" /></label>
              <h3 class="lbl" style="margin-top:8px">{t.xdPlayers}</h3>
              {s.xdNames.map((v, i) => (
                <div class="fld" key={i}>
                  <span class="u" style="width:40px;padding:0;text-align:center">{i + 1}</span>
                  <input value={v} placeholder={t.addPh} aria-label={`${t.addPh} ${i + 1}`} style="padding-left:0" autocomplete="off"
                    onInput={e => { const val = e.currentTarget.value; this.setState(st => { const a = [...st.xdNames]; a[i] = val; return { xdNames: a }; }); }} />
                  <button type="button" class="x" onClick={() => this.setState(st => ({ xdNames: st.xdNames.filter((_, k) => k !== i) }))} aria-label={`${t.remove} ${v}`}><Close /></button>
                </div>
              ))}
              <button type="button" onClick={() => this.setState(st => ({ xdNames: [...st.xdNames, ''] }))} class="pill" style="border-style:dashed;color:var(--acc)">+ {t.addP}</button>
            </section>
            <section class="panel">
              <h2 class="lbl" id="bet-l">{t.bet}</h2>
              <Seg label={t.bet} value={s.xdBet} onPick={xdBet => this.setState({ xdBet })} options={[10000, 20000, 50000, 100000].map(u => [u, short(u)])} />
              <label class="fld"><input inputmode="numeric" value={fmt(s.xdBet)} onInput={e => this.setState({ xdBet: num(e.currentTarget.value) })} onFocus={selectAll} class="num" style="font:800 22px/1 'Fraunces',Georgia,serif" aria-labelledby="bet-l" /><span class="u">đ</span></label>
            </section>
            <section class="panel">
              <h2 class="lbl">{t.rules}</h2>
              <p style="font-size:15px;text-wrap:pretty;margin:0">{t.xdRule}</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  dealerCard(total, extra) {
    const t = this.t(), s = this.state;
    return (
      <div class="ivc" style="align-self:start">
        <span class="lbl red">{t.dealer}</span>
        <h2 class="h ell" style="font-size:28px">{s.xdDealer}</h2>
        <span class={`big${total < 0 ? ' neg' : ''}`} style="font-size:clamp(44px,5vw,60px)">{sv(total)}</span>
        {extra}
      </div>
    );
  }

  xd() {
    const s = this.state, t = this.t();
    const total = -this.xdAll().reduce((a, x) => a + x.bal, 0), rnd = -s.xdPlayers.reduce((a, p) => a + p.rnd, 0);
    const setBet = (id, v) => this.setState(st => ({ xdPlayers: st.xdPlayers.map(x => (x.id === id ? { ...x, bet: v } : x)) }));
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl"><h1 class="h" style="font-size:24px">{t.xd}</h1><span style="color:var(--mut);font-size:14px">{t.rack} {s.xdRound}</span></div>
          {this.undoBtn()}
          <button type="button" onClick={() => this.commit({ xdRound: s.xdRound + 1, xdPlayers: s.xdPlayers.map(p => ({ ...p, rnd: 0 })) })} class="pill">✓ {t.doneRound}</button>
          <button type="button" onClick={this.go('xdResult')} class="pill acc">{t.finish}</button>
        </header>
        <main class="side">
          {this.dealerCard(total, (
            <>
              <span class="num" style="font-weight:600;font-size:14px;color:var(--inkmut)">{t.thisRound} {sv(rnd)}</span>
              {s.xdGone.length > 0 && (
                <>
                  <span class="lbl" style="margin-top:10px">{t.gonePl}</span>
                  {s.xdGone.map((g, k) => (
                    <div class="split-row" key={k}><span class="ell" style="font-weight:600">{g.name}</span><span class="num" style="font-weight:700">{sv(g.bal)}</span></div>
                  ))}
                </>
              )}
            </>
          ))}
          <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
            <ul class="list" style="flex:1;margin:0;padding:0;list-style:none">
              {s.xdPlayers.map(p => (
                <li class="panel" key={p.id} style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 14px 12px 20px;border-radius:26px">
                  <div style="flex:1 1 160px;min-width:0;display:flex;flex-direction:column;gap:4px">
                    <h2 class="h ell" style="font-size:20px">{p.name}</h2>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span class={`big${p.bal < 0 ? ' neg' : ''}`} style="font-size:24px;letter-spacing:-.02em" aria-live="polite">{sv(p.bal)}</span>
                      {!!p.rnd && <span class="tag num">{t.thisRound} {sv(p.rnd)}</span>}
                    </div>
                  </div>
                  <div class="ctl">
                    <button type="button" onClick={() => this.xdMove(p.id, -1)} class="ib" style="width:52px;height:52px" aria-label={`− ${p.name}`}>−</button>
                    <label class="fld" style="width:132px;height:52px">
                      <input inputmode="numeric" value={p.bet} onInput={e => setBet(p.id, fmt(num(e.currentTarget.value)))} onFocus={selectAll} aria-label={`${t.betP} ${p.name}`} class="num" style="font:800 18px/1 'Fraunces',Georgia,serif;padding-right:4px" />
                      <span class="u">đ</span>
                    </label>
                    <button type="button" onClick={() => this.xdMove(p.id, 1)} class="ib acc" style="width:52px;height:52px" aria-label={`+ ${p.name}`}>+</button>
                    <button type="button" onClick={() => this.xdRemove(p.id)} class="ib" style="width:44px;height:44px" aria-label={`${t.remove} ${p.name}`} title={`${t.remove} ${p.name}`}><Close /></button>
                  </div>
                </li>
              ))}
              {!s.xdPlayers.length && <li><p class="note" style="margin:6px 4px">{t.noPl}</p></li>}
            </ul>
            <form style="display:flex;gap:8px;flex:none" onSubmit={this.xdAdd}>
              <label class="fld" style="flex:1;border-radius:999px"><input value={s.xdNew} onInput={e => this.setState({ xdNew: e.currentTarget.value })} placeholder={t.addPh} aria-label={t.addPh} style="padding-left:20px" autocomplete="off" enterkeyhint="done" /></label>
              <button type="submit" class="pill iv" style="height:52px" disabled={!s.xdNew.trim()}>+ {t.addP}</button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  xdResult() {
    const s = this.state, t = this.t(), all = this.xdAll();
    const total = -all.reduce((a, x) => a + x.bal, 0);
    const played = s.xdRound - 1 + (s.xdPlayers.some(p => p.rnd) ? 1 : 0);
    const note = total > 0 ? `${s.xdDealer} ${t.xdUp} ${vnd(total)}` : total < 0 ? `${s.xdDealer} ${t.xdDown} ${vnd(-total)}` : t.even;
    const close = () => this.stopAll({
      xdPlayers: [], xdGone: [], xdRound: 1,
      history: [{ when: this.when(), game: `${t.xd} · ${played} ${t.rack.toLowerCase()} · ${t.dealer} ${s.xdDealer}`, result: [`${s.xdDealer} ${sv(total)}`, ...all.map(x => `${x.name} ${sv(x.bal)}`)].join(' · '), dur: dur(this.ms()), bill: '—' }, ...s.history].slice(0, 50),
    });
    const rows = all.filter(x => x.bal);
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('xd'), t.cont)}
          <div class="ttl"><h1 class="h" style="font-size:28px">{t.summary}</h1><span style="color:var(--mut);font-size:14px">{played} {t.racksDone}</span></div>
          <button type="button" onClick={this.go('xd')} class="pill">{t.cont}</button>
          <button type="button" onClick={close} class="pill acc">{t.close}</button>
        </header>
        <main class="body">
          <div class="side" style="padding:0">
            {this.dealerCard(total, <span style="font-size:14px;color:var(--inkmut)">{note}</span>)}
            <section class="panel">
              <h2 class="lbl">{t.whoPays}</h2>
              {rows.map((x, k) => (
                <div class="row bg" style="justify-content:space-between" key={k}>
                  <span style="font-weight:600;min-width:0">{x.bal < 0 ? `${x.name} ${t.xdPaysDealer}` : `${t.dealerPays} ${x.name}`}</span>
                  <span class="big" style={`font-size:26px;letter-spacing:-.02em;color:${x.bal < 0 ? 'var(--acc)' : 'var(--fg)'}`}>{vnd(Math.abs(x.bal))}</span>
                </div>
              ))}
              {!rows.length && <p class="note">{t.even}</p>}
            </section>
          </div>
        </main>
      </div>
    );
  }

  history() {
    const s = this.state, t = this.t();
    return (
      <div class="scr">
        <header class="top">
          {this.backBtn(this.go('home'), t.back)}
          <div class="ttl"><h1 class="h" style="font-size:28px">{t.history}</h1><span style="color:var(--mut);font-size:14px">{s.history.length} {t.matches}</span></div>
        </header>
        <main class="body">
          <ul class="wrap" style="display:flex;flex-direction:column;gap:10px;list-style:none;margin:0 auto;padding:0">
            {s.history.map((h, k) => (
              <li class="row" key={k}>
                <span class="chip">{h.when}</span>
                <span style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:2px">
                  <span style="font-weight:700">{h.result}</span>
                  <span style="font-size:13px;color:var(--mut)">{h.game}</span>
                </span>
                <span class="num" style="font-size:14px;color:var(--mut)">{t.duration} {h.dur}</span>
                <span class="num" style="font-size:14px;font-weight:700">{h.bill}</span>
              </li>
            ))}
            {!s.history.length && <li><p class="note" style="margin:6px 0 0">{t.empty}</p></li>}
          </ul>
        </main>
      </div>
    );
  }

  render(_, s) {
    const screen = s.screen === 'setup' ? (s.mode === 'xd' ? 'xdSetup' : 'setup') : s.screen;
    const fn = this[screen] && typeof this[screen] === 'function' ? screen : 'home';
    return <div class="bz" data-v={s.theme}>{this[fn]()}</div>;
  }
}
