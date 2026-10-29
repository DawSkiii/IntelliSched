/*
 * Nurse portal  (js/nurse.js)
 * Views: Dashboard, My Schedule, Shift Swap, Leave Requests, Profile, Settings.
 * Non-nurse users are redirected away (see the guard below).
 */
(function () {
  'use strict';
  const { useState, useMemo } = React;
  const { html, cx, Icon, useStore, useHash, toast, confirm, Modal, Field, Segmented, Toggle, Pill, SwapPill, LeavePill, ShiftBadge, ShiftTag, Empty, PageHead, MonthGrid, WeekStrip, Shell, ProfileForm, PasswordForm, download } = UI;
  const { Dates: D, SHIFTS, SHIFT_ORDER, SHIFT_NAME, LEAVE_TYPES, isWork } = Store;

  const me0 = Store.currentUser();
  if (!me0) location.replace('login.html'); else if (me0.role !== 'nurse') location.replace('chief.html');

  // // Sidebar views; the active one is kept in the URL hash (#dashboard, #swap, ...).
  const VIEWS = ['dashboard', 'schedule', 'swap', 'leave', 'profile', 'settings'];
  const opt = (d, s) => `${D.medium(d)} · ${SHIFTS[s].label}`;

  /* ----- swap request modal ----- */
  // // Swap request form. A swap trades one of my shifts for one of a same-department colleague's.
  // // Date lists only include upcoming shifts (next 60 days); Store.requestSwap() re-validates everything.
  function SwapModal({ me, prefill, onClose }) {
    const st = useStore(); const t = D.today(); const horizon = D.range(t, D.addDays(t, 60));
    const mine = horizon.filter((d) => isWork(st.schedule[me.id] && st.schedule[me.id][d]));
    const mates = st.users.filter((u) => u.role === 'nurse' && u.active && u.dept === me.dept && u.id !== me.id);
    const [date, setDate] = useState((prefill && prefill.date) || mine[0] || '');
    const [targetId, setTargetId] = useState(mates[0] ? mates[0].id : '');
    const [pick, setPick] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState('');
    const theirs = targetId ? horizon.filter((d) => isWork(st.schedule[targetId] && st.schedule[targetId][d])) : [];
    const targetDate = theirs.includes(pick) ? pick : theirs[0] || '';
    const mate = mates.find((m) => m.id === targetId);
    const submit = (e) => {
      e.preventDefault();
      const r = Store.requestSwap({ requesterId: me.id, date, targetId, targetDate, reason });
      if (!r.ok) return setErr(r.error);
      toast(`Swap request sent to ${mate.name}`); onClose();
    };
    return html`<${Modal} title="Request a shift swap" onClose=${onClose} footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className="btn btn-primary" form="swapform" type="submit" disabled=${!mine.length || !mates.length}>Send request</button>`}>
      ${!mine.length ? html`<${Empty} icon="calendar" title="No upcoming shifts to swap" text="Once you have shifts scheduled in the next 60 days, you can request a swap."/>` : html`
      <form id="swapform" onSubmit=${submit} noValidate>
        <${Field} label="Your shift to give away"><select className="select" value=${date} onChange=${(e) => setDate(e.target.value)}>${mine.map((d) => html`<option key=${d} value=${d}>${opt(d, st.schedule[me.id][d])}</option>`)}</select><//>
        <${Field} label=${'Swap with (' + me.dept + ')'}><select className="select" value=${targetId} onChange=${(e) => setTargetId(e.target.value)}>${mates.map((m) => html`<option key=${m.id} value=${m.id}>${m.name}</option>`)}</select><//>
        <${Field} label="Their shift you will take" error=${!theirs.length ? 'This colleague has no upcoming shifts in the next 60 days.' : ''}><select className="select" value=${targetDate} onChange=${(e) => setPick(e.target.value)} disabled=${!theirs.length}>${theirs.map((d) => html`<option key=${d} value=${d}>${opt(d, st.schedule[targetId][d])}</option>`)}</select><//>
        ${date && targetDate && html`<div className="swap-sum"><div><small>You give</small><strong>${D.medium(date)}</strong><${ShiftTag} s=${st.schedule[me.id][date]}/></div><${Icon} n="swap"/><div><small>You take</small><strong>${D.medium(targetDate)}</strong><${ShiftTag} s=${st.schedule[targetId][targetDate]}/></div></div>`}
        <${Field} label="Reason (optional)"><textarea className="textarea" rows="2" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="Tell your colleague and Chief Nurse why"></textarea><//>
        ${err && html`<p className="form-err" role="alert">${err}</p>`}
      </form>`}<//>`;
  }

  /* ----- leave form ----- */
  // // Leave request form: shows live day count and remaining balance (including already-pending days).
  function LeaveForm({ me, initial, onDone }) {
    const st = useStore(); const t = D.today();
    const [f, setF] = useState({ type: 'annual', start: (initial && initial.start) || t, end: (initial && initial.start) || t, reason: '' });
    const [err, setErr] = useState('');
    const days = f.start && f.end && f.end >= f.start ? D.diff(f.start, f.end) + 1 : 0;
    const av = Store.leaveAvailable(me.id, f.type);
    const set = (k) => (e) => { const v = e.target.value; setF((p) => { const n = Object.assign({}, p, { [k]: v }); if (k === 'start' && n.end < v) n.end = v; return n; }); };
    const submit = (e) => {
      e.preventDefault();
      const r = Store.requestLeave({ userId: me.id, type: f.type, start: f.start, end: f.end, reason: f.reason });
      if (!r.ok) return setErr(r.error);
      setErr(''); toast('Leave request submitted'); setF(Object.assign({}, f, { reason: '' })); onDone && onDone();
    };
    return html`<form id="leaveform" onSubmit=${submit} noValidate>
      <${Field} label="Leave type"><select className="select" value=${f.type} onChange=${set('type')}>${Object.keys(LEAVE_TYPES).map((k) => html`<option key=${k} value=${k}>${LEAVE_TYPES[k]}</option>`)}</select><//>
      <div className="grid-2"><${Field} label="From"><input className="input" type="date" min=${t} value=${f.start} onChange=${set('start')}/><//><${Field} label="To"><input className="input" type="date" min=${f.start || t} value=${f.end} onChange=${set('end')}/><//></div>
      <p className="calc"><strong>${days}</strong> day${days === 1 ? '' : 's'} requested · <strong>${av.available}</strong> available${av.pending ? ` (${av.pending} already pending)` : ''}</p>
      <${Field} label="Reason (optional)"><textarea className="textarea" rows="2" value=${f.reason} onChange=${set('reason')}></textarea><//>
      ${err && html`<p className="form-err" role="alert">${err}</p>`}
      <div className="form-actions"><button className="btn btn-primary" type="submit">Submit request</button></div></form>`;
  }

  /* ----- day detail ----- */
  // // Details for a clicked calendar day: shift, colleagues on the same shift, pending requests.
  function DayModal({ me, date, onClose, onSwap }) {
    const st = useStore(); const s = st.schedule[me.id] && st.schedule[me.id][date]; const t = D.today();
    const mates = isWork(s) ? st.users.filter((u) => u.id !== me.id && u.active && u.dept === me.dept && st.schedule[u.id] && st.schedule[u.id][date] === s) : [];
    const swaps = st.swaps.filter((w) => (w.requesterId === me.id || w.targetId === me.id) && (w.date === date || w.targetDate === date) && ['awaiting_colleague', 'awaiting_chief'].includes(w.status));
    const leave = st.leaves.find((l) => l.userId === me.id && l.status === 'pending' && l.start <= date && l.end >= date);
    return html`<${Modal} title=${D.parse(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} onClose=${onClose} small footer=${isWork(s) && date >= t ? html`<button className="btn" onClick=${() => { onClose(); onSwap(date); }}><${Icon} n="swap" size=${16}/>Request swap</button>` : null}>
      ${s ? html`<div className="day-shift"><${ShiftBadge} s=${s} size="lg"/><div><strong>${SHIFT_NAME[s]}</strong><span>${s === 'L' ? 'Approved leave' : SHIFTS[s].time}</span></div></div>` : html`<p className="muted-p">No shift scheduled. Enjoy your day off.</p>`}
      ${mates.length > 0 && html`<h4 className="mini-h">Working with you</h4><p className="muted-p">${mates.map((m) => m.name).join(', ')}</p>`}
      ${swaps.length > 0 && html`<h4 className="mini-h">Pending swap</h4>${swaps.map((w) => html`<p key=${w.id} className="muted-p"><${SwapPill} s=${w.status}/></p>`)}`}
      ${leave && html`<h4 className="mini-h">Pending leave</h4><p className="muted-p">${LEAVE_TYPES[leave.type]}, ${D.short(leave.start)} – ${D.short(leave.end)}</p>`}<//>`;
  }

  /* ----- dashboard ----- */
  // // Dashboard: greeting, month/week calendar, department, next shift and leave balance.
  // // Pending requests are shown on the calendar with a ring marker.
  function Dashboard({ me, go }) {
    const st = useStore(); const t = D.today(); const cfg = Store.settingsOf(me.id);
    const [mode, setMode] = useState(cfg.defaultView); const [month, setMonth] = useState(D.monthStart(t)); const [wk, setWk] = useState(D.startOfWeek(t));
    const [day, setDay] = useState(null); const [swap, setSwap] = useState(null);
    const row = st.schedule[me.id] || {};
    const pend = useMemo(() => {
      const s = new Set();
      st.swaps.filter((w) => w.requesterId === me.id && ['awaiting_colleague', 'awaiting_chief'].includes(w.status)).forEach((w) => s.add(w.date));
      st.leaves.filter((l) => l.userId === me.id && l.status === 'pending').forEach((l) => D.range(l.start, l.end).forEach((d) => s.add(d)));
      return s;
    }, [st.swaps, st.leaves, me.id]);
    const cell = (d) => ({ shift: row[d], pending: pend.has(d) });
    const next = D.range(t, D.addDays(t, 60)).find((d) => isWork(row[d]));
    const step = (n) => (mode === 'month' ? setMonth(D.addMonths(month, n)) : setWk(D.addDays(wk, 7 * n)));
    const goToday = () => { setMonth(D.monthStart(t)); setWk(D.startOfWeek(t)); };
    const atToday = mode === 'month' ? month === D.monthStart(t) : wk === D.startOfWeek(t);
    const title = mode === 'month' ? D.month(month) : `${D.short(wk)} – ${D.short(D.addDays(wk, 6))}`;
    const incoming = st.swaps.filter((w) => w.targetId === me.id && w.status === 'awaiting_colleague').length;
    const dept = st.departments[me.dept];
    return html`<div>
      <div className="nurse-grid">
        <div className="col">
          <section className="card glass hello"><span className="avatar xl"><${Icon} n="user" size=${24}/></span><div><h2>Hello, Nurse ${Store.first(me)}</h2><p>You make a difference, every shift.</p></div><div className="today-box"><small>TODAY</small><strong>${D.long(t)}</strong></div></section>
          ${incoming > 0 && html`<button className="banner" onClick=${() => go('swap')}><${Icon} n="swap" size=${18}/>${incoming} colleague${incoming > 1 ? 's' : ''} asked to swap shifts with you. Review now<${Icon} n="right" size=${16}/></button>`}
          <section className="card glass pad">
            <div className="card-head">
              <h3>My Schedule</h3>
              <div className="stepper"><button className="icon-btn" aria-label="Previous" onClick=${() => step(-1)}><${Icon} n="left"/></button><strong>${title}</strong><button className="icon-btn" aria-label="Next" onClick=${() => step(1)}><${Icon} n="right"/></button></div>
              <button className="btn btn-sm" onClick=${goToday} disabled=${atToday} title="Jump to the current date"><${Icon} n="calendar" size=${14}/>Today</button>
              <${Segmented} label="Calendar view" value=${mode} onChange=${setMode} options=${[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}/>
            </div>
            ${mode === 'month' ? html`<${MonthGrid} month=${month} cell=${cell} onSelect=${setDay}/>` : html`<${WeekStrip} start=${wk} cell=${cell} onSelect=${setDay}/>`}
            <div className="legend"><span><${ShiftBadge} s="M"/>Morning Shift</span><span><${ShiftBadge} s="P"/>Afternoon Shift</span><span><${ShiftBadge} s="N"/>Night Shift</span><span><${ShiftBadge} s="L"/>Leave</span><span><span className="sb sb-pending"><i></i></span>Pending Request</span></div>
          </section>
        </div>
        <aside className="col">
          <section className="card glass pad"><h4 className="side-h"><${Icon} n="building" size=${16}/>My Department</h4><strong className="big">${me.dept}</strong><p>${dept ? dept.name : ''}</p><small className="dim">Your current assignment</small></section>
          <section className="card glass pad"><h4 className="side-h"><${Icon} n="clock" size=${16}/>Next shift</h4>${next ? html`<div className="day-shift tight"><${ShiftBadge} s=${row[next]} size="lg"/><div><strong>${next === t ? 'Today' : D.medium(next)}</strong><span>${SHIFTS[row[next]].time}</span></div></div>` : html`<p className="muted-p">No shifts in the next 60 days.</p>`}</section>
          <button className="btn btn-block" onClick=${() => setSwap({})}><${Icon} n="swap" size=${16}/>Request Shift Swap</button>
          <section className="card glass pad"><h4 className="side-h"><${Icon} n="calendar" size=${16}/>Leave Balance</h4>
            <ul className="bal">${Object.keys(LEAVE_TYPES).map((k) => html`<li key=${k}><span>${k === 'annual' ? 'Annual Leave' : k === 'sick' ? 'Sick Leave' : 'VL/SL (Other)'}</span><strong>${me.leave[k]} days</strong></li>`)}</ul>
            <button className="link" onClick=${() => go('leave')}>Request leave</button></section>
        </aside>
      </div>
      ${day && html`<${DayModal} me=${me} date=${day} onClose=${() => setDay(null)} onSwap=${(d) => setSwap({ date: d })}/>`}
      ${swap && html`<${SwapModal} me=${me} prefill=${swap} onClose=${() => setSwap(null)}/>`}
    </div>`;
  }

  /* ----- my schedule list ----- */
  // // Grouped list of shifts with range and type filters, plus .ics export for phone calendars.
  function ScheduleView({ me }) {
    const st = useStore(); const t = D.today();
    const [span, setSpan] = useState('30'); const [kind, setKind] = useState('all'); const [swap, setSwap] = useState(null);
    const row = st.schedule[me.id] || {};
    const [from, to] = span === 'past' ? [D.addDays(t, -30), D.addDays(t, -1)] : [t, D.addDays(t, +span)];
    const list = D.range(from, to).filter((d) => row[d] && (kind === 'all' || row[d] === kind));
    const groups = {}; list.forEach((d) => { const w = D.startOfWeek(d); (groups[w] = groups[w] || []).push(d); });
    const exportIcs = () => {
      const stamp = (d, h) => d.replace(/-/g, '') + 'T' + D.pad(h) + '0000';
      const ev = D.range(t, D.addDays(t, 120)).filter((d) => isWork(row[d])).map((d) => {
        const s = SHIFTS[row[d]]; const endDay = s.startHour + 8 >= 24 ? D.addDays(d, 1) : d;
        return ['BEGIN:VEVENT', `UID:${d}-${me.id}@intellisched`, `DTSTAMP:${stamp(t, 0)}`, `DTSTART:${stamp(d, s.startHour)}`, `DTEND:${stamp(endDay, (s.startHour + 8) % 24)}`, `SUMMARY:${s.name} (${me.dept})`, 'END:VEVENT'].join('\r\n');
      });
      download('my-shifts.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IntelliSched//EN', ...ev, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
      toast(`Exported ${ev.length} shifts`);
    };
    return html`<div>
      <${PageHead} title="My Schedule" sub=${`${me.dept} · ${list.length} shift${list.length === 1 ? '' : 's'} listed`} actions=${html`<button className="btn" onClick=${exportIcs}><${Icon} n="download" size=${16}/>Export to calendar</button>`}/>
      <div className="toolbar"><${Segmented} label="Range" value=${span} onChange=${setSpan} options=${[{ value: '14', label: 'Next 14 days' }, { value: '30', label: 'Next 30 days' }, { value: '90', label: 'Next 90 days' }, { value: 'past', label: 'Past 30 days' }]}/>
        <select className="select auto" aria-label="Shift type" value=${kind} onChange=${(e) => setKind(e.target.value)}><option value="all">All shift types</option>${SHIFT_ORDER.map((s) => html`<option key=${s} value=${s}>${SHIFTS[s].name}</option>`)}<option value="L">Leave</option></select></div>
      ${list.length === 0 ? html`<section className="card glass pad"><${Empty} icon="calendar" title="No shifts in this view" text="Try a longer range or a different shift type."/></section>` : Object.keys(groups).map((w) => html`<section key=${w} className="card glass pad group"><h4 className="side-h">Week of ${D.long(w)}</h4>
        <ul className="shift-list">${groups[w].map((d) => html`<li key=${d} className=${d === t ? 'today' : ''}><span className="sl-date"><strong>${D.parse(d).getDate()}</strong>${D.parse(d).toLocaleDateString('en-US', { weekday: 'short' })}</span><${ShiftBadge} s=${row[d]} size="lg"/><span className="sl-main"><strong>${SHIFT_NAME[row[d]]}</strong><small>${row[d] === 'L' ? 'Approved leave' : SHIFTS[row[d]].time}</small></span>${isWork(row[d]) && d >= t ? html`<button className="btn btn-sm" onClick=${() => setSwap({ date: d })}>Swap</button>` : null}</li>`)}</ul></section>`)}
      ${swap && html`<${SwapModal} me=${me} prefill=${swap} onClose=${() => setSwap(null)}/>`}</div>`;
  }

  /* ----- shift swap ----- */
  // // Incoming swap requests to accept/decline, and the nurse's own requests with status.
  function SwapView({ me }) {
    const st = useStore(); const [open, setOpen] = useState(false);
    const nm = (id) => (st.users.find((u) => u.id === id) || { name: 'Former colleague' }).name;
    const incoming = st.swaps.filter((w) => w.targetId === me.id && w.status === 'awaiting_colleague');
    const mine = st.swaps.filter((w) => w.requesterId === me.id);
    const respond = (w, yes) => { const r = Store.respondSwap(w.id, me.id, yes); r.ok ? toast(yes ? 'Accepted. Sent to Chief Nurse for approval.' : 'Request declined') : toast(r.error, 'bad'); };
    const cancel = async (w) => { if (await confirm({ title: 'Cancel swap request?', message: 'The colleague and Chief Nurse will no longer see this request.', confirmLabel: 'Cancel request', danger: true })) { Store.cancelSwap(w.id, me.id); toast('Request cancelled'); } };
    return html`<div><${PageHead} title="Shift Swap" sub="Trade a shift with a colleague in your department. Chief Nurse approves every swap." actions=${html`<button className="btn btn-primary" onClick=${() => setOpen(true)}><${Icon} n="plus" size=${16}/>New swap request</button>`}/>
      ${incoming.length > 0 && html`<section className="card glass pad group"><h3 className="card-title">Needs your response</h3>${incoming.map((w) => html`<div key=${w.id} className="req"><div className="req-main"><strong>${nm(w.requesterId)}</strong> wants to give you their <strong>${SHIFTS[w.shift].label}</strong> on ${D.medium(w.date)} and take your <strong>${SHIFTS[w.targetShift].label}</strong> on ${D.medium(w.targetDate)}.${w.reason && html`<small>“${w.reason}”</small>`}</div><div className="req-act"><button className="btn btn-sm" onClick=${() => respond(w, false)}>Decline</button><button className="btn btn-sm btn-primary" onClick=${() => respond(w, true)}>Accept</button></div></div>`)}</section>`}
      <section className="card glass pad"><h3 className="card-title">My requests</h3>
        ${mine.length === 0 ? html`<${Empty} icon="swap" title="No swap requests yet" text="Start a request when you need to trade a shift." action=${html`<button className="btn btn-primary" onClick=${() => setOpen(true)}>New swap request</button>`}/>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>You give</th><th>You take</th><th>With</th><th>Status</th><th></th></tr></thead><tbody>${mine.map((w) => html`<tr key=${w.id}><td>${opt(w.date, w.shift)}</td><td>${opt(w.targetDate, w.targetShift)}</td><td>${nm(w.targetId)}</td><td><${SwapPill} s=${w.status}/>${w.note && html`<small className="note-s">${w.note}</small>`}</td><td className="right">${['awaiting_colleague', 'awaiting_chief'].includes(w.status) && html`<button className="btn btn-sm" onClick=${() => cancel(w)}>Cancel</button>`}</td></tr>`)}</tbody></table></div>`}</section>
      ${open && html`<${SwapModal} me=${me} onClose=${() => setOpen(false)}/>`}</div>`;
  }

  /* ----- leave ----- */
  // // Leave requests page: new request, balances and history.
  function LeaveView({ me }) {
    const st = useStore(); const mine = st.leaves.filter((l) => l.userId === me.id);
    const cancel = async (l) => { if (await confirm({ title: 'Cancel leave request?', message: `${LEAVE_TYPES[l.type]}, ${D.short(l.start)} – ${D.short(l.end)}`, confirmLabel: 'Cancel request', danger: true })) { Store.cancelLeave(l.id, me.id); toast('Request cancelled'); } };
    return html`<div><${PageHead} title="Leave Requests" sub="Requests go to your Chief Nurse. Approved leave updates your schedule automatically."/>
      <div className="split">
        <section className="card glass pad"><h3 className="card-title">New request</h3><${LeaveForm} me=${me}/></section>
        <section className="card glass pad"><h3 className="card-title">Balance</h3><div className="bal-cards">${Object.keys(LEAVE_TYPES).map((k) => { const a = Store.leaveAvailable(me.id, k); return html`<div key=${k} className="bal-card"><small>${LEAVE_TYPES[k]}</small><strong>${a.balance}</strong><span>days${a.pending ? ` · ${a.pending} pending` : ''}</span></div>`; })}</div></section>
      </div>
      <section className="card glass pad"><h3 className="card-title">My requests</h3>
        ${mine.length === 0 ? html`<${Empty} icon="file" title="No leave requests" text="Submit a request using the form above."/>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th></tr></thead><tbody>${mine.map((l) => html`<tr key=${l.id}><td>${LEAVE_TYPES[l.type]}</td><td>${D.short(l.start)} – ${D.long(l.end)}</td><td>${l.days}</td><td><${LeavePill} s=${l.status}/>${l.note && html`<small className="note-s">${l.note}</small>`}</td><td className="right">${l.status === 'pending' && html`<button className="btn btn-sm" onClick=${() => cancel(l)}>Cancel</button>`}</td></tr>`)}</tbody></table></div>`}</section></div>`;
  }

  function ProfileView({ me }) {
    return html`<div><${PageHead} title="Profile" sub="Keep your contact details up to date."/>
      <section className="card glass pad profile-head"><span className="avatar xl"><${Icon} n="user" size=${26}/></span><div><h2>Nurse ${me.name}</h2><p>${me.title} · ${me.dept} · ${me.empId}</p></div></section>
      <div className="split"><${ProfileForm} user=${me}/><${PasswordForm} user=${me}/></div></div>`;
  }

  // // Per-user preferences saved through Store.updateSettings().
  function SettingsView({ me }) {
    useStore(); const cfg = Store.settingsOf(me.id);
    const alert = (k) => (v) => Store.updateSettings(me.id, { alerts: { [k]: v } });
    return html`<div><${PageHead} title="Settings" sub="Choose how IntelliSched looks and what it tells you."/>
      <section className="card glass pad"><h3 className="card-title">Notifications</h3>
        <${Toggle} label="Shift swap updates" hint="Requests from colleagues and decisions" checked=${cfg.alerts.swap} onChange=${alert('swap')}/>
        <${Toggle} label="Leave decisions" hint="Approvals and rejections" checked=${cfg.alerts.leave} onChange=${alert('leave')}/>
        <${Toggle} label="Schedule changes" hint="When your shifts are published or edited" checked=${cfg.alerts.schedule} onChange=${alert('schedule')}/></section>
      <section className="card glass pad"><h3 className="card-title">Dashboard</h3><${Field} label="Default calendar view"><${Segmented} label="Default view" value=${cfg.defaultView} onChange=${(v) => { Store.updateSettings(me.id, { defaultView: v }); toast('Default view saved'); }} options=${[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]}/><//></section></div>`;
  }

  // // Root: guards the role, builds the sidebar and renders the active view.
  function App() {
    const st = useStore(); const me = Store.currentUser();
    const [view, setView] = useHash('dashboard', VIEWS);
    if (!me || me.role !== 'nurse') return null;
    const incoming = st.swaps.filter((w) => w.targetId === me.id && w.status === 'awaiting_colleague').length;
    const nav = [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { id: 'schedule', label: 'My Schedule', icon: 'calendar' }, { id: 'swap', label: 'Shift Swap', icon: 'swap', badge: incoming }, { id: 'leave', label: 'Leave Requests', icon: 'file' }, { id: 'profile', label: 'Profile', icon: 'user' }];
    const V = { dashboard: Dashboard, schedule: ScheduleView, swap: SwapView, leave: LeaveView, profile: ProfileView, settings: SettingsView }[view];
    return html`<${Shell} user=${me} nav=${nav} view=${view} onNav=${setView}><${V} me=${me} go=${setView}/><//>`;
  }
  if (me0 && me0.role === 'nurse') ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
})();
