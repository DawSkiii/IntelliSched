/*
 * IntelliSched data layer  (js/store.js)
 * ------------------------------------------------------------------
 * Single source of truth for the whole app. No UI code lives here.
 *
 * Data model (persisted as one JSON blob in localStorage):
 *   users[]         { id, empId, username, email, password, name, role: 'nurse'|'chief', dept, leave{annual,sick,other}, active, ... }
 *   schedule        { [userId]: { 'YYYY-MM-DD': 'M'|'P'|'N'|'L' } }   (missing = day off)
 *   departments     { [name]: { name, min: { M, P, N } } }            (minimum staffing)
 *   swaps[] leaves[] notifications[] settings{}
 *
 * To move to a real backend: keep the Store.* function signatures and replace
 * commit()/load()/persist() with API calls; the React code will not need to change.
 */
(function (global) {
  'use strict';

  // Storage keys. Bump VERSION when the data shape changes: load() then discards old
  // saved data and re-seeds (see load()).
  const KEY = 'intellisched.data.v1';
  const SESSION_KEY = 'intellisched.session';
  const VERSION = 1;

  /* ---------- dates (all dates are local 'YYYY-MM-DD' strings) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  // Date helpers. Every date in the app is a local 'YYYY-MM-DD' string, so plain string
  // comparison (a < b) orders dates correctly. Never use toISOString() (it shifts to UTC).
  const D = {
    pad,
    fmt: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    parse: (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    addDays: (s, n) => { const d = D.parse(s); d.setDate(d.getDate() + n); return D.fmt(d); },
    today: () => D.fmt(new Date()),
    dow: (s) => D.parse(s).getDay(),
    startOfWeek: (s) => D.addDays(s, -D.dow(s)),
    diff: (a, b) => Math.round((D.parse(b) - D.parse(a)) / 864e5),
    range: (s, e) => { const o = []; for (let d = s; d <= e && o.length < 800; d = D.addDays(d, 1)) o.push(d); return o; },
    long: (s) => D.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    medium: (s) => D.parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    short: (s) => D.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    month: (s) => D.parse(s).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    monthStart: (s) => s.slice(0, 8) + '01',
    addMonths: (s, n) => { const d = D.parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return D.fmt(d); },
    daysInMonth: (s) => { const d = D.parse(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); },
  };

  /* ---------- constants ---------- */
  // Shift catalogue. Schedule cells store the id: 'M' | 'P' | 'N', or 'L' for approved leave.
  // A missing entry means day off. startHour is used for .ics export.
  const SHIFTS = {
    M: { id: 'M', name: 'Morning Shift', label: 'Morning', time: '7:00 AM – 3:00 PM', startHour: 7, hours: 8 },
    P: { id: 'P', name: 'Afternoon Shift', label: 'Afternoon', time: '3:00 PM – 11:00 PM', startHour: 15, hours: 8 },
    N: { id: 'N', name: 'Night Shift', label: 'Night', time: '11:00 PM – 7:00 AM', startHour: 23, hours: 8 },
  };
  const SHIFT_ORDER = ['M', 'P', 'N'];
  const SHIFT_NAME = { M: 'Morning Shift', P: 'Afternoon Shift', N: 'Night Shift', L: 'On leave' };
  const LEAVE_TYPES = { annual: 'Annual Leave', sick: 'Sick Leave', other: 'VL/SL (Other)' };
  const SWAP_STATUS = {
    awaiting_colleague: ['Awaiting colleague', 'warn'],
    awaiting_chief: ['Awaiting Chief Nurse', 'info'],
    approved: ['Approved', 'ok'],
    declined: ['Declined by colleague', 'bad'],
    rejected: ['Rejected', 'bad'],
    cancelled: ['Cancelled', 'muted'],
  };
  const LEAVE_STATUS = {
    pending: ['Pending', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'], cancelled: ['Cancelled', 'muted'],
  };
  // Department staffing rules: min = minimum nurses required per shift. Editable by the
  // Chief Nurse in Settings; drives open-shift detection and the generator.
  const DEFAULT_DEPTS = {
    'OPD': { name: 'Outpatient Department', min: { M: 2, P: 1, N: 0 } },
    'Emergency': { name: 'Emergency Department', min: { M: 1, P: 1, N: 1 } },
    'Ward A': { name: 'Medical Ward A', min: { M: 1, P: 1, N: 1 } },
    'Ward B': { name: 'Surgical Ward B', min: { M: 1, P: 1, N: 1 } },
    'ICU': { name: 'Intensive Care Unit', min: { M: 1, P: 1, N: 1 } },
  };
  // Seed roster: [name, department, optional 'heavy']. 'heavy' nurses get extra night
  // shifts in seed() so the demo shows overtime and high-fatigue alerts.
  const ROSTER = [
    ['Sarah Wilson', 'OPD'], ['Aaron Vigan', 'Emergency'], ['Clara Ramos', 'Ward A', 'heavy'], ['Maria Santos', 'OPD'],
    ['Roberto Cruz', 'Emergency'], ['Elena Singson', 'Ward B', 'heavy'], ['Joy Dela Cruz', 'ICU'], ['Miguel Torres', 'OPD'],
    ['Angela Reyes', 'Emergency'], ['Paolo Mendoza', 'Ward A'], ['Liza Navarro', 'Ward B'], ['Carlo Bautista', 'ICU'],
    ['Jenny Garcia', 'OPD'], ['Rico Fernandez', 'Emergency'], ['Hannah Domingo', 'Ward A'], ['Mark Villanueva', 'Ward B'],
    ['Patricia Lim', 'ICU'], ['Jose Aquino', 'Emergency', 'heavy'], ['Cathy Santiago', 'Ward A'], ['Dennis Pascual', 'Ward B'],
    ['Faith Castillo', 'ICU'], ['Noel Rivera', 'ICU'], ['Ana Mercado', 'OPD'], ['Ben Soriano', 'Ward A'],
  ];
  const isWork = (s) => s === 'M' || s === 'P' || s === 'N';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- scheduling engine ---------- */
  // Scheduling rules engine. Works on a schedule object ({ [userId]: { [date]: shift } }).
  //   violations(id, date, shift) -> human-readable rule breaks (rest, streak, weekly cap)
  //   canWork(...)               -> slot is free and breaks no rule
  //   score(...)                 -> lower = better candidate (fewer shifts that week, fewer recent nights,
  //   small bonus for continuing yesterday's shift)
  // Rest rule: no morning after a night/afternoon shift, no afternoon after a night shift (11h rest).
  function engine(sched, opts) {
    const o = Object.assign({ maxConsecutive: 5, allowOvertime: false }, opts);
    const maxWeek = o.allowOvertime ? 6 : 5;
    const get = (id, d) => (sched[id] && sched[id][d]) || null;
    const set = (id, d, s) => { (sched[id] = sched[id] || {})[d] = s; };
    const weekCount = (id, d) => {
      const s = D.startOfWeek(d); let c = 0;
      for (let i = 0; i < 7; i++) if (isWork(get(id, D.addDays(s, i)))) c++;
      return c;
    };
    const nightsBefore = (id, d) => { let c = 0; for (let i = 1; i <= 14; i++) if (get(id, D.addDays(d, -i)) === 'N') c++; return c; };
    const violations = (id, d, sh) => {
      const v = [];
      const prev = get(id, D.addDays(d, -1)); const next = get(id, D.addDays(d, 1));
      if (prev === 'N' && sh !== 'N') v.push('Less than 11 hours of rest after the previous night shift.');
      if (prev === 'P' && sh === 'M') v.push('Less than 11 hours of rest after the previous afternoon shift.');
      if (sh === 'N' && isWork(next) && next !== 'N') v.push('The shift on the next day would start without enough rest.');
      if (sh === 'P' && next === 'M') v.push('The morning shift on the next day would start without enough rest.');
      let before = 0; while (isWork(get(id, D.addDays(d, -1 - before))) && before < 10) before++;
      let after = 0; while (isWork(get(id, D.addDays(d, 1 + after))) && after < 10) after++;
      if (before + 1 + after > o.maxConsecutive) v.push(`This creates ${before + 1 + after} working days in a row (limit ${o.maxConsecutive}).`);
      const wc = weekCount(id, d) - (isWork(get(id, d)) ? 1 : 0);
      if (wc >= maxWeek) v.push(`This exceeds ${maxWeek} shifts in the week.`);
      return v;
    };
    const canWork = (id, d, sh) => !get(id, d) && violations(id, d, sh).length === 0;
    const score = (id, d, sh) => weekCount(id, d) * 10 + (sh === 'N' ? nightsBefore(id, d) * 2 : 0) + (get(id, D.addDays(d, -1)) === sh ? -4 : 0);
    return { get, set, violations, canWork, score, weekCount };
  }

  // Staffing coverage: one row per (date, department, shift) that has a minimum > 0,
  // with need (required) and have (assigned). openCount() sums the shortfall.
  function coverage(st, dept, days, schedule) {
    const sched = schedule || st.schedule; const out = [];
    Object.keys(st.departments).forEach((dp) => {
      if (dept !== 'all' && dp !== dept) return;
      const pool = st.users.filter((u) => u.role === 'nurse' && u.active && u.dept === dp);
      days.forEach((d) => SHIFT_ORDER.forEach((sh) => {
        const need = st.departments[dp].min[sh] || 0; if (!need) return;
        const have = pool.filter((u) => sched[u.id] && sched[u.id][d] === sh).length;
        out.push({ date: d, dept: dp, shift: sh, need, have });
      }));
    });
    return out;
  }
  const openCount = (rows) => rows.reduce((n, r) => n + Math.max(0, r.need - r.have), 0);

  // Workload / fatigue score (0-100) for one nurse over [start, end]. Everything is scaled to
  // a 7-day week so ranges of any length are comparable.
  //   score = weeklyHours/56*60 + nights*5 + (streak-4)*8 + rushed rotations*6
  //   level: Low < 50, Medium 50-74, High >= 75. Overtime = hours above 40 per week.
  function analyze(st, uid, start, end, schedule) {
    const row = (schedule || st.schedule)[uid] || {};
    const days = D.range(start, end); const len = days.length || 1; const f = 7 / len;
    let shifts = 0, nights = 0, hours = 0, rot = 0, streak = 0, cur = 0;
    days.forEach((d) => { const s = row[d]; if (isWork(s)) { shifts++; hours += SHIFTS[s].hours; if (s === 'N') nights++; } });
    D.range(D.addDays(start, -3), end).forEach((d) => {
      const s = row[d]; const p = row[D.addDays(d, -1)];
      if (isWork(s)) { cur++; streak = Math.max(streak, cur); if ((p === 'N' && s !== 'N') || (p === 'P' && s === 'M')) rot++; } else cur = 0;
    });
    const weeklyHours = hours * f;
    const overtime = Math.max(0, Math.round(hours - 40 / f));
    const score = Math.min(100, Math.round(weeklyHours / 56 * 60 + nights * f * 5 + Math.max(0, streak - 4) * 8 + rot * f * 6));
    const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';
    return { shifts, hours, weeklyHours, overtime, nights, streak, rot, score, level };
  }

  // Rule-based schedule generator (no network/AI model involved). Pure function: works on a
  // copy and returns { schedule, changes, unfilled } without touching saved state.
  //   mode 'fill'    keeps current shifts and only fills gaps
  //   mode 'rebuild' clears shifts in range (leave is kept) and reassigns
  // Nights are filled first because they are the hardest to cover. Apply with Store.applyChanges().
  function generate(st, opts) {
    const o = Object.assign({ dept: 'all', mode: 'fill', maxConsecutive: 5, allowOvertime: false }, opts);
    const sched = clone(st.schedule);
    const eng = engine(sched, o);
    const nurses = st.users.filter((u) => u.role === 'nurse' && u.active && (o.dept === 'all' || u.dept === o.dept));
    const days = D.range(o.start, o.end);
    if (o.mode === 'rebuild') nurses.forEach((n) => days.forEach((d) => { if (sched[n.id] && isWork(sched[n.id][d])) delete sched[n.id][d]; }));
    const unfilled = [];
    days.forEach((d, di) => {
      Object.keys(st.departments).forEach((dp) => {
        if (o.dept !== 'all' && dp !== o.dept) return;
        const pool = nurses.filter((n) => n.dept === dp);
        ['N', 'P', 'M'].forEach((sh) => {
          const need = st.departments[dp].min[sh] || 0;
          let have = pool.filter((n) => eng.get(n.id, d) === sh).length;
          while (have < need) {
            const cands = pool.filter((n) => eng.canWork(n.id, d, sh))
              .map((n, i) => ({ n, s: eng.score(n.id, d, sh) + ((pool.indexOf(n) + di) % pool.length) * 0.01 }))
              .sort((a, b) => a.s - b.s);
            if (!cands.length) unfilled.push({ date: d, dept: dp, shift: sh }); else eng.set(cands[0].n.id, d, sh);
            have++;
          }
        });
      });
    });
    const changes = [];
    nurses.forEach((n) => days.forEach((d) => {
      const from = (st.schedule[n.id] && st.schedule[n.id][d]) || null; const to = (sched[n.id] && sched[n.id][d]) || null;
      if (from !== to) changes.push({ uid: n.id, date: d, from, to });
    }));
    return { schedule: sched, changes, unfilled, days };
  }

  /* ---------- seed ---------- */
  // Builds the demo dataset: users, a generated schedule (-45 to +120 days around today),
  // plus a few pending swap/leave requests and notifications so every screen has content.
  function seed() {
    const t = D.today();
    const st = { version: VERSION, seq: 100, users: [], schedule: {}, departments: clone(DEFAULT_DEPTS), swaps: [], leaves: [], notifications: [], settings: {} };
    st.users.push({ id: 'c1', empId: 'MVH-0001', username: 'chief', email: 'ianne.magsino@metrovigan.ph', password: 'chief123', name: 'Ianne Magsino', role: 'chief', dept: 'Administration', phone: '+63 917 555 0001', active: true, title: 'Chief Nurse', leave: { annual: 15, sick: 7, other: 3 } });
    ROSTER.forEach(([name, dept, load], i) => {
      const [first, last] = name.toLowerCase().split(' ');
      st.users.push({ id: 'n' + (i + 1), empId: 'MVH-' + (1001 + i), username: first, email: `${first}.${last}@metrovigan.ph`, password: 'nurse123', name, role: 'nurse', dept, phone: '+63 917 555 ' + (1100 + i * 37), active: true, load: load || 'normal', title: 'Staff Nurse', leave: { annual: 12, sick: 5, other: 3 } });
    });
    const start = D.addDays(t, -45), end = D.addDays(t, 120);
    st.schedule = generate(st, { start, end, mode: 'rebuild' }).schedule;
    st.users.filter((u) => u.load === 'heavy').forEach((u) => {
      D.range(start, end).forEach((d) => { if (!isWork(st.schedule[u.id] && st.schedule[u.id][d]) && D.dow(d) % 2 === 0) (st.schedule[u.id] = st.schedule[u.id] || {})[d] = 'N'; });
    });
    // history: an approved leave for Sarah
    const hs = D.addDays(t, -21), he = D.addDays(t, -19);
    D.range(hs, he).forEach((d) => { st.schedule.n1[d] = 'L'; });
    st.leaves.push({ id: 'lv1', userId: 'n1', type: 'annual', start: hs, end: he, days: 3, reason: 'Family trip', status: 'approved', created: Date.now() - 864e5 * 40, note: '' });
    // helpers to build realistic pending requests
    const upcoming = (uid, from) => D.range(from, D.addDays(from, 40)).filter((d) => isWork(st.schedule[uid] && st.schedule[uid][d]));
    const pair = (a, b, from) => {
      for (const da of upcoming(a, from)) for (const db of upcoming(b, from)) {
        if (da !== db && !st.schedule[a][db] && !st.schedule[b][da]) return [da, db];
      } return null;
    };
    const mk = (req, tgt, status, from) => {
      const p = pair(req, tgt, from); if (!p) return;
      st.swaps.push({ id: 'sw' + (++st.seq), requesterId: req, targetId: tgt, date: p[0], shift: st.schedule[req][p[0]], targetDate: p[1], targetShift: st.schedule[tgt][p[1]], reason: 'Family commitment on that date', status, created: Date.now() - 36e5 * 5, note: '' });
    };
    mk('n4', 'n1', 'awaiting_colleague', D.addDays(t, 3));
    mk('n2', 'n9', 'awaiting_chief', D.addDays(t, 2));
    st.leaves.push({ id: 'lv2', userId: 'n4', type: 'annual', start: D.addDays(t, 10), end: D.addDays(t, 12), days: 3, reason: 'Personal errand', status: 'pending', created: Date.now() - 36e5 * 8, note: '' });
    st.leaves.push({ id: 'lv3', userId: 'n14', type: 'sick', start: D.addDays(t, 5), end: D.addDays(t, 6), days: 2, reason: 'Medical appointment and recovery', status: 'pending', created: Date.now() - 36e5 * 3, note: '' });
    const note = (uid, text, kind, ago) => st.notifications.push({ id: 'nt' + (++st.seq), uid, text, kind, ts: Date.now() - ago, read: false });
    note('n1', 'Nurse Maria Santos asked to swap shifts with you. Review it under Shift Swap.', 'swap', 36e5 * 5);
    note('n1', 'Your schedule for the coming weeks has been published.', 'schedule', 864e5);
    note('c1', '2 leave requests and 1 shift swap are waiting for your approval.', 'system', 36e5 * 3);
    return st;
  }

  /* ---------- state ---------- */
  // In-memory state + tiny pub/sub store. commit() mutates, saves to localStorage and
  // notifies subscribers. React components read it through UI.useStore()
  // (useSyncExternalStore) and must treat state as read-only; always mutate via Store.* actions.
  let state = load();
  const subs = new Set();
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s.version === VERSION) return s; } } catch (e) { /* ignore */ }
    const s = seed(); persist(s); return s;
  }
  function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage full or blocked */ } }
  function commit(mut) { const r = mut(state); state = Object.assign({}, state); persist(state); subs.forEach((f) => f()); return r; }
  if (typeof addEventListener === 'function') {
    addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subs.forEach((f) => f()); } });
  }

  const ok = (extra) => Object.assign({ ok: true }, extra);
  const fail = (error) => ({ ok: false, error });
  const byId = (s, id) => s.users.find((u) => u.id === id);
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Per-user settings with defaults (alert toggles, default calendar view).
  function settingsOf(uid) {
    const s = state.settings[uid] || {};
    return { defaultView: s.defaultView || 'month', alerts: Object.assign({ swap: true, leave: true, schedule: true, system: true }, s.alerts) };
  }
  // Adds an in-app notification unless the user switched that kind off in Settings.
  // kinds: 'swap' | 'leave' | 'schedule' | 'system'.
  function pushNote(s, uid, text, kind) {
    const cfg = s.settings[uid];
    if (cfg && cfg.alerts && cfg.alerts[kind || 'system'] === false) return;
    s.notifications.unshift({ id: 'nt' + (++s.seq), uid, text, kind: kind || 'system', ts: Date.now(), read: false });
    if (s.notifications.length > 400) s.notifications.length = 400;
  }
  const first = (u) => u.name.split(' ')[0];
  const label = (u) => (u.role === 'chief' ? 'Chief Nurse ' : 'Nurse ') + u.name;

  // Performs an approved swap by exchanging both shifts. Re-checks that the schedule
  // still matches the request; returns false if either shift changed in the meantime.
  function execSwap(s, w) {
    const a = w.requesterId, b = w.targetId;
    const sa = s.schedule[a] && s.schedule[a][w.date], sb = s.schedule[b] && s.schedule[b][w.targetDate];
    if (sa !== w.shift || sb !== w.targetShift) return false;
    if (w.date !== w.targetDate) {
      if (s.schedule[a][w.targetDate] || s.schedule[b][w.date]) return false;
    }
    delete s.schedule[a][w.date]; delete s.schedule[b][w.targetDate];
    s.schedule[a][w.targetDate] = sb; s.schedule[b][w.date] = sa;
    return true;
  }

  // Public API exposed as window.Store. Every mutating action returns { ok, error? }
  // (the UI shows `error` to the user). Actions are grouped: auth, notifications, swaps,
  // leave, scheduling (chief nurse), staff management.
  const api = {
    Dates: D, SHIFTS, SHIFT_ORDER, SHIFT_NAME, LEAVE_TYPES, SWAP_STATUS, LEAVE_STATUS, isWork, label, first,
    getState: () => state,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    settingsOf, analyze, coverage, openCount, generate,
    violations: (uid, d, sh, opts) => engine(state.schedule, opts).violations(uid, d, sh),
    eligible(date, dept, shift) {
      const e = engine(state.schedule, {});
      return state.users.filter((u) => u.role === 'nurse' && u.active && u.dept === dept && e.canWork(u.id, date, shift))
        .map((u) => ({ user: u, score: e.score(u.id, date, shift) })).sort((a, b) => a.score - b.score);
    },

    /* auth */
    // Auth is demo-only: the user id lives in sessionStorage (or localStorage when
    // "Remember me" is ticked) and passwords are stored in plain text. Replace with a real
    // backend (hashed passwords, server sessions) before any real use.
    currentUser() { const id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); return state.users.find((u) => u.id === id && u.active) || null; },
    login(identifier, password, role, remember) {
      const id = (identifier || '').trim().toLowerCase();
      if (!id || !password) return fail('Enter your email or username and your password.');
      const u = state.users.find((x) => x.username.toLowerCase() === id || x.email.toLowerCase() === id);
      if (!u || u.password !== password) return fail('Incorrect email, username or password.');
      if (!u.active) return fail('This account is deactivated. Contact your Chief Nurse.');
      if (u.role !== role) return fail(`This is a ${u.role === 'chief' ? 'Chief Nurse' : 'Nurse'} account. Switch the role above and try again.`);
      sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, u.id);
      return ok({ user: u });
    },
    logout() { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); },
    resetPasswordByIdentity(identifier, empId, next) {
      const id = (identifier || '').trim().toLowerCase();
      const u = state.users.find((x) => x.username.toLowerCase() === id || x.email.toLowerCase() === id);
      if (!u || u.empId.toLowerCase() !== (empId || '').trim().toLowerCase()) return fail('We could not match that account and employee ID.');
      if ((next || '').length < 8) return fail('Use at least 8 characters for the new password.');
      return commit((s) => { byId(s, u.id).password = next; return ok(); });
    },
    changePassword(uid, cur, next) {
      const u = byId(state, uid);
      if (!u || u.password !== cur) return fail('Your current password is incorrect.');
      if ((next || '').length < 8) return fail('Use at least 8 characters for the new password.');
      return commit((s) => { byId(s, uid).password = next; return ok(); });
    },
    updateProfile(uid, p) {
      const name = (p.name || '').trim(), email = (p.email || '').trim(), phone = (p.phone || '').trim();
      if (!name) return fail('Enter your full name.');
      if (!emailOk(email)) return fail('Enter a valid email address.');
      if (state.users.some((u) => u.id !== uid && u.email.toLowerCase() === email.toLowerCase())) return fail('Another account already uses that email.');
      return commit((s) => { Object.assign(byId(s, uid), { name, email, phone }); return ok(); });
    },
    updateSettings(uid, patch) {
      return commit((s) => { const cur = s.settings[uid] || {}; s.settings[uid] = Object.assign({}, cur, patch, { alerts: Object.assign({}, cur.alerts, patch.alerts) }); return ok(); });
    },

    /* notifications */
    markRead(uid, id) { commit((s) => { s.notifications.forEach((n) => { if (n.uid === uid && (!id || n.id === id)) n.read = true; }); }); },
    clearNotes(uid) { commit((s) => { s.notifications = s.notifications.filter((n) => n.uid !== uid); }); },

    /* shift swaps */
    // Swap lifecycle: awaiting_colleague -> awaiting_chief -> approved | rejected.
    // (declined / cancelled can end it earlier). Shifts only move in decideSwap(approve).
    requestSwap({ requesterId, date, targetId, targetDate, reason }) {
      const me = byId(state, requesterId), tg = byId(state, targetId), t = D.today();
      if (!tg) return fail('Choose a colleague to swap with.');
      if (me.dept !== tg.dept) return fail('You can only swap with someone in your department.');
      if (!date || !targetDate) return fail('Choose both shifts for the swap.');
      if (date < t || targetDate < t) return fail('You can only swap upcoming shifts.');
      const a = state.schedule[me.id] && state.schedule[me.id][date], b = state.schedule[tg.id] && state.schedule[tg.id][targetDate];
      if (!isWork(a)) return fail('You are not scheduled for a shift on that date.');
      if (!isWork(b)) return fail(`${first(tg)} is not scheduled for a shift on that date.`);
      if (date === targetDate && a === b) return fail('You both work the same shift on that day. Pick a different date.');
      if (date !== targetDate) {
        if (state.schedule[me.id][targetDate]) return fail(`You already have a ${SHIFT_NAME[state.schedule[me.id][targetDate]].toLowerCase()} on ${D.medium(targetDate)}.`);
        if (state.schedule[tg.id][date]) return fail(`${first(tg)} already has a ${SHIFT_NAME[state.schedule[tg.id][date]].toLowerCase()} on ${D.medium(date)}.`);
      }
      if (state.swaps.some((w) => w.requesterId === me.id && w.date === date && (w.status === 'awaiting_colleague' || w.status === 'awaiting_chief'))) return fail('You already have a pending swap request for that shift.');
      return commit((s) => {
        const w = { id: 'sw' + (++s.seq), requesterId, targetId, date, shift: a, targetDate, targetShift: b, reason: (reason || '').trim(), status: 'awaiting_colleague', created: Date.now(), note: '' };
        s.swaps.unshift(w);
        pushNote(s, targetId, `${label(me)} asked to swap their ${SHIFTS[a].label.toLowerCase()} on ${D.medium(date)} for your ${SHIFTS[b].label.toLowerCase()} on ${D.medium(targetDate)}.`, 'swap');
        return ok({ swap: w });
      });
    },
    respondSwap(id, uid, accept) {
      return commit((s) => {
        const w = s.swaps.find((x) => x.id === id);
        if (!w || w.targetId !== uid || w.status !== 'awaiting_colleague') return fail('This request is no longer open.');
        w.status = accept ? 'awaiting_chief' : 'declined';
        const me = byId(s, uid);
        if (accept) {
          pushNote(s, w.requesterId, `${label(me)} accepted your swap. It now needs Chief Nurse approval.`, 'swap');
          s.users.filter((u) => u.role === 'chief').forEach((c) => pushNote(s, c.id, `A shift swap between ${byId(s, w.requesterId).name} and ${me.name} needs your approval.`, 'system'));
        } else pushNote(s, w.requesterId, `${label(me)} declined your swap request.`, 'swap');
        return ok();
      });
    },
    cancelSwap(id, uid) {
      return commit((s) => {
        const w = s.swaps.find((x) => x.id === id);
        if (!w || w.requesterId !== uid || !(w.status === 'awaiting_colleague' || w.status === 'awaiting_chief')) return fail('This request can no longer be cancelled.');
        w.status = 'cancelled'; return ok();
      });
    },
    decideSwap(id, chiefId, approve, note) {
      return commit((s) => {
        const w = s.swaps.find((x) => x.id === id);
        if (!w || w.status !== 'awaiting_chief') return fail('This request is no longer open.');
        const a = byId(s, w.requesterId), b = byId(s, w.targetId);
        if (approve) {
          if (!execSwap(s, w)) return fail('One of the shifts has changed since the request was made. Decline it and ask for a new request.');
          w.status = 'approved';
        } else w.status = 'rejected';
        w.note = (note || '').trim();
        const msg = `Your shift swap on ${D.medium(w.date)} was ${approve ? 'approved' : 'rejected'}${w.note ? ': ' + w.note : '.'}`;
        pushNote(s, a.id, msg, 'swap'); pushNote(s, b.id, `The swap with ${a.name} was ${approve ? 'approved. Check your updated schedule' : 'rejected'}.`, 'swap');
        return ok();
      });
    },

    /* leave */
    leaveAvailable(uid, type) {
      const u = byId(state, uid);
      const pending = state.leaves.filter((l) => l.userId === uid && l.type === type && l.status === 'pending').reduce((n, l) => n + l.days, 0);
      return { balance: u.leave[type], pending, available: u.leave[type] - pending };
    },
    // Leave lifecycle: pending -> approved | rejected | cancelled. Balance is checked here
    // against already-pending days, and only deducted when the Chief Nurse approves.
    requestLeave({ userId, type, start, end, reason }) {
      if (!start || !end) return fail('Choose a start and end date.');
      if (end < start) return fail('The end date must be on or after the start date.');
      if (start < D.today()) return fail('Leave can only be requested for today or later.');
      const days = D.diff(start, end) + 1;
      const av = api.leaveAvailable(userId, type);
      if (days > av.available) return fail(`You requested ${days} day${days > 1 ? 's' : ''} but only have ${av.available} available for ${LEAVE_TYPES[type]}.`);
      if (state.leaves.some((l) => l.userId === userId && (l.status === 'pending' || l.status === 'approved') && l.start <= end && l.end >= start)) return fail('These dates overlap another leave request.');
      return commit((s) => {
        const l = { id: 'lv' + (++s.seq), userId, type, start, end, days, reason: (reason || '').trim(), status: 'pending', created: Date.now(), note: '' };
        s.leaves.unshift(l);
        const u = byId(s, userId);
        s.users.filter((c) => c.role === 'chief').forEach((c) => pushNote(s, c.id, `${u.name} requested ${days} day${days > 1 ? 's' : ''} of ${LEAVE_TYPES[type].toLowerCase()} (${D.short(start)} – ${D.short(end)}).`, 'system'));
        return ok({ leave: l });
      });
    },
    cancelLeave(id, uid) {
      return commit((s) => {
        const l = s.leaves.find((x) => x.id === id);
        if (!l || l.userId !== uid || l.status !== 'pending') return fail('Only pending requests can be cancelled.');
        l.status = 'cancelled'; return ok();
      });
    },
    decideLeave(id, approve, note) {
      return commit((s) => {
        const l = s.leaves.find((x) => x.id === id);
        if (!l || l.status !== 'pending') return fail('This request is no longer open.');
        const u = byId(s, l.userId);
        if (approve) {
          if (u.leave[l.type] < l.days) return fail('The nurse no longer has enough leave balance.');
          u.leave[l.type] -= l.days;
          s.schedule[u.id] = s.schedule[u.id] || {};
          D.range(l.start, l.end).forEach((d) => { s.schedule[u.id][d] = 'L'; });
          l.status = 'approved';
        } else l.status = 'rejected';
        l.note = (note || '').trim();
        pushNote(s, u.id, `Your ${LEAVE_TYPES[l.type].toLowerCase()} request (${D.short(l.start)} – ${D.short(l.end)}) was ${approve ? 'approved' : 'rejected'}${l.note ? ': ' + l.note : '.'}`, 'leave');
        return ok();
      });
    },

    /* scheduling (chief nurse) */
    // Manual assignment (chief nurse). shift = 'M'|'P'|'N'|'L' or null for day off.
    setShift(uid, date, shift, actorId) {
      return commit((s) => {
        s.schedule[uid] = s.schedule[uid] || {};
        const prev = s.schedule[uid][date] || null;
        if ((shift || null) === prev) return ok();
        if (shift) s.schedule[uid][date] = shift; else delete s.schedule[uid][date];
        const u = byId(s, uid);
        if (actorId && actorId !== uid) pushNote(s, uid, `Your schedule on ${D.medium(date)} changed to ${shift ? SHIFT_NAME[shift] : 'day off'}.`, 'schedule');
        return ok();
      });
    },
    applyChanges(changes) {
      return commit((s) => {
        const per = {};
        changes.forEach((c) => {
          s.schedule[c.uid] = s.schedule[c.uid] || {};
          if (c.to) s.schedule[c.uid][c.date] = c.to; else delete s.schedule[c.uid][c.date];
          (per[c.uid] = per[c.uid] || []).push(c.date);
        });
        Object.keys(per).forEach((uid) => { const ds = per[uid].sort(); pushNote(s, uid, `Your schedule was updated (${ds.length} change${ds.length > 1 ? 's' : ''} between ${D.short(ds[0])} and ${D.short(ds[ds.length - 1])}).`, 'schedule'); });
        return ok({ count: changes.length });
      });
    },
    updateDeptMin(dept, shift, val) {
      const n = Math.max(0, Math.min(9, parseInt(val, 10) || 0));
      commit((s) => { s.departments[dept].min[shift] = n; });
    },

    /* staff management */
    saveNurse(data, id) {
      const name = (data.name || '').trim(), email = (data.email || '').trim(), username = (data.username || '').trim().toLowerCase();
      if (!name) return fail('Enter the nurse’s full name.');
      if (!emailOk(email)) return fail('Enter a valid email address.');
      if (!/^[a-z0-9._-]{3,}$/.test(username)) return fail('Username needs 3+ characters: letters, numbers, dots, dashes or underscores.');
      if (!state.departments[data.dept]) return fail('Choose a department.');
      if (state.users.some((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase())) return fail('Another account already uses that email.');
      if (state.users.some((u) => u.id !== id && u.username.toLowerCase() === username)) return fail('That username is already taken.');
      const leave = { annual: Math.max(0, +data.annual || 0), sick: Math.max(0, +data.sick || 0), other: Math.max(0, +data.other || 0) };
      if (!id && (data.password || '').length < 8) return fail('Set a temporary password with at least 8 characters.');
      return commit((s) => {
        if (id) { Object.assign(byId(s, id), { name, email, username, dept: data.dept, phone: (data.phone || '').trim(), leave }); return ok(); }
        const n = s.users.filter((u) => u.role === 'nurse').length;
        const u = { id: 'n' + (++s.seq), empId: 'MVH-' + (1001 + n + s.seq), username, email, password: data.password, name, role: 'nurse', dept: data.dept, phone: (data.phone || '').trim(), active: true, load: 'normal', title: 'Staff Nurse', leave };
        s.users.push(u); pushNote(s, u.id, 'Welcome to IntelliSched. Your Chief Nurse will assign your first shifts soon.', 'system');
        return ok({ user: u });
      });
    },
    setActive(uid, active) { commit((s) => { byId(s, uid).active = active; }); },
    adminResetPassword(uid, pw) {
      if ((pw || '').length < 8) return fail('Use at least 8 characters.');
      return commit((s) => { byId(s, uid).password = pw; return ok(); });
    },
    removeNurse(uid) {
      commit((s) => {
        s.users = s.users.filter((u) => u.id !== uid); delete s.schedule[uid];
        s.swaps = s.swaps.filter((w) => w.requesterId !== uid && w.targetId !== uid);
        s.leaves = s.leaves.filter((l) => l.userId !== uid);
        s.notifications = s.notifications.filter((n) => n.uid !== uid);
      });
    },
    // Wipes everything and re-seeds. Used by Settings > Reset demo data.
    resetData() { state = seed(); persist(state); subs.forEach((f) => f()); },
  };

  global.Store = api;
})(typeof window !== 'undefined' ? window : globalThis);
