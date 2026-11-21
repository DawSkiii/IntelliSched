/*
 * Chief Nurse portal  (js/chief.js)
 * Views: Dashboard, Schedule Overview, Staff Management, Shift Generator, Approvals, Reports, Settings.
 * Non-chief users are redirected away (see the guard below).
 */
(function () {
  'use strict';
  const { useState, useRef, useEffect } = React;
  const { html, cx, Icon, useStore, useHash, useClickAway, toast, confirm, Modal, Field, Segmented, Toggle, Avatar, Pill, SwapPill, LeavePill, ShiftBadge, ShiftTag, Empty, PageHead, Menu, Shell, ProfileForm, PasswordForm, download } = UI;
  const { Dates: D, SHIFTS, SHIFT_ORDER, SHIFT_NAME, LEAVE_TYPES, isWork } = Store;

  const me0 = Store.currentUser();
  if (!me0) location.replace('login.html'); else if (me0.role !== 'chief') location.replace('nurse.html');
  // // Sidebar views; kept in the URL hash. Dashboard filters (department + date range) live in App
  // // and are passed down as `f` so the Dashboard, Schedule Overview and Reports stay in sync.
  const VIEWS = ['dashboard', 'schedule', 'staff', 'generator', 'approvals', 'reports', 'settings'];
  const nurseList = (st, dept) => st.users.filter((u) => u.role === 'nurse' && u.active && (dept === 'all' || u.dept === dept));
  // // Maps a fatigue level to the CSS dot/bar colour class.
  const dotClass = (l) => (l === 'High' ? 'bad' : l === 'Medium' ? 'mid' : 'low');

  /* ----- filters ----- */
  // // Department select + date-range popover. Ranges are capped at 60 days.
  function FilterBar({ f, setF, extra }) {
    const st = useStore(); const [open, setOpen] = useState(false); const ref = useRef(null); useClickAway(ref, () => setOpen(false));
    const t = D.today(); const { start, end } = f.range;
    const preset = (s, e) => { setF({ range: { start: s, end: e } }); setOpen(false); };
    const setStart = (v) => { if (!v) return; setF({ range: { start: v, end: end < v ? v : D.diff(v, end) > 60 ? D.addDays(v, 60) : end } }); };
    const setEnd = (v) => { if (!v) return; setF({ range: { start: start > v ? v : start, end: D.diff(start, v) > 60 ? D.addDays(start, 60) : v } }); };
    return html`<div className="filters">
      <label className="pick"><${Icon} n="building" size=${16}/><select aria-label="Department" value=${f.dept} onChange=${(e) => setF({ dept: e.target.value })}><option value="all">All Departments</option>${Object.keys(st.departments).map((d) => html`<option key=${d} value=${d}>${d}</option>`)}</select><${Icon} n="down" size=${14}/></label>
      <div className="dd" ref=${ref}>
        <button className="pick" aria-expanded=${open} onClick=${() => setOpen(!open)}><${Icon} n="calendar" size=${16}/><span>${D.long(start)} – ${D.long(end)}</span><${Icon} n="down" size=${14}/></button>
        ${open && html`<div className="dd-pop glass range-pop"><div className="presets">
          <button className="btn btn-sm" onClick=${() => preset(D.startOfWeek(t), D.addDays(D.startOfWeek(t), 6))}>This week</button>
          <button className="btn btn-sm" onClick=${() => preset(t, D.addDays(t, 6))}>Next 7 days</button>
          <button className="btn btn-sm" onClick=${() => preset(t, D.addDays(t, 13))}>Next 14 days</button>
          <button className="btn btn-sm" onClick=${() => preset(D.addDays(D.startOfWeek(t), 7), D.addDays(D.startOfWeek(t), 13))}>Next week</button></div>
          <div className="grid-2"><${Field} label="From"><input className="input" type="date" value=${start} onChange=${(e) => setStart(e.target.value)}/><//><${Field} label="To"><input className="input" type="date" value=${end} min=${start} onChange=${(e) => setEnd(e.target.value)}/><//></div>
          <small className="dim">Ranges are limited to 60 days.</small></div>`}
      </div>${extra}</div>`;
  }

  /* ----- assign modal ----- */
  // // Assign / change one nurse's shift on a date. Shows rest/overtime warnings from Store.violations()
  // // but still lets the Chief Nurse override them.
  function AssignModal({ target, me, onClose }) {
    const st = useStore(); const [d, setD] = useState(target.date); const [sel, setSel] = useState(undefined);
    const u = st.users.find((x) => x.id === target.uid); const cur = (st.schedule[u.id] && st.schedule[u.id][d]) || 'off';
    const val = sel === undefined ? cur : sel; const warn = isWork(val) ? Store.violations(u.id, d, val) : [];
    const opts = [['M', 'Morning'], ['P', 'Afternoon'], ['N', 'Night'], ['L', 'Leave'], ['off', 'Day off']];
    const save = () => { Store.setShift(u.id, d, val === 'off' ? null : val, me.id); toast(`${u.name}: ${val === 'off' ? 'day off' : SHIFT_NAME[val]} on ${D.medium(d)}`); onClose(); };
    return html`<${Modal} title="Assign shift" onClose=${onClose} small footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className="btn btn-primary" onClick=${save}>Save shift</button>`}>
      <div className="who"><${Avatar} name=${u.name}/><div><strong>Nurse ${u.name}</strong><small>${u.dept}</small></div></div>
      <${Field} label="Date"><input className="input" type="date" value=${d} onChange=${(e) => { setD(e.target.value); setSel(undefined); }}/><//>
      <div className="opt-grid" role="radiogroup" aria-label="Shift">${opts.map(([k, l]) => html`<button key=${k} role="radio" aria-checked=${val === k} className=${cx('opt', val === k && 'on')} onClick=${() => setSel(k)}>${k !== 'off' && html`<${ShiftBadge} s=${k}/>`}<span>${l}</span>${k !== 'off' && k !== 'L' && html`<small>${SHIFTS[k].time}</small>`}</button>`)}</div>
      ${warn.length > 0 && html`<div className="warn" role="alert"><${Icon} n="alert" size=${16}/><div><strong>Check before saving</strong>${warn.map((w) => html`<p key=${w}>${w}</p>`)}</div></div>`}<//>`;
  }

  /* ----- nurse detail ----- */
  // // One nurse's workload breakdown and next 14 days.
  function DetailModal({ uid, range, onClose, onAssign }) {
    const st = useStore(); const u = st.users.find((x) => x.id === uid); const t = D.today();
    const a = Store.analyze(st, uid, range.start, range.end); const row = st.schedule[uid] || {};
    const tip = a.level === 'High' ? 'High fatigue risk. Give a rest day soon and avoid back-to-back nights.' : a.level === 'Medium' ? 'Workload is moderate. Keep rotations predictable.' : 'Workload is healthy for this period.';
    return html`<${Modal} title=${'Nurse ' + u.name} onClose=${onClose} wide footer=${html`<button className="btn" onClick=${onClose}>Close</button><button className="btn btn-primary" onClick=${() => onAssign({ uid, date: t })}>Assign shift</button>`}>
      <div className="stat-row"><div className="mini-stat"><small>Workload</small><strong>${a.score}%</strong><span className=${'lvl ' + dotClass(a.level)}>${a.level}</span></div><div className="mini-stat"><small>Shifts</small><strong>${a.shifts}</strong><span>${a.hours} hrs</span></div><div className="mini-stat"><small>Nights</small><strong>${a.nights}</strong><span>in range</span></div><div className="mini-stat"><small>Longest streak</small><strong>${a.streak}</strong><span>days</span></div><div className="mini-stat"><small>Overtime</small><strong>${a.overtime}</strong><span>hrs</span></div></div>
      <p className="muted-p">${tip}</p>
      <h4 className="mini-h">Next 14 days</h4>
      <div className="mini-days">${D.range(t, D.addDays(t, 13)).map((d) => html`<button key=${d} className="md" onClick=${() => onAssign({ uid, date: d })}><small>${D.medium(d)}</small>${row[d] ? html`<${ShiftBadge} s=${row[d]}/>` : html`<span className="dim">Off</span>`}</button>`)}</div><//>`;
  }

  /* ----- dashboard ----- */
  // // KPI cards (on duty, open shifts, overtime alerts) and the nurse overview table.
  // // The AI button sets a session flag so the Shift Generator opens with a preview already built.
  function Dashboard({ f, go, me, openAssign, openDetail }) {
    const st = useStore(); const t = D.today(); const { start, end } = f.range;
    const nurses = nurseList(st, f.dept); const days = D.range(start, end);
    const [q, setQ] = useState('');
    const onDuty = nurses.filter((n) => isWork(st.schedule[n.id] && st.schedule[n.id][t])).length;
    const open = Store.openCount(Store.coverage(st, f.dept, days));
    const rows = nurses.map((n) => ({ n, a: Store.analyze(st, n.id, start, end) }));
    const otN = rows.filter((r) => r.a.overtime > 0 || r.a.level === 'High').length; const otH = rows.reduce((s, r) => s + r.a.overtime, 0);
    const shown = rows.filter((r) => !q || (r.n.name + r.n.dept).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    const auto = () => { sessionStorage.setItem('intellisched.autogen', '1'); go('generator'); };
    return html`<div><${PageHead} title="Supervisor Dashboard" sub="Hospital-Wide Overview & Assignment"/>
      <div className="dash-bar"><${FilterBar} f=${f} setF=${f.set}/><button className="btn btn-primary" onClick=${auto}><${Icon} n="sparkle" size=${16}/>Auto-Generate Smart Schedule (AI)</button></div>
      <div className="kpis">
        <button className="card glass kpi" onClick=${() => go('schedule')}><span className="kpi-i"><${Icon} n="users" size=${22}/></span><div><small>Total staff on duty</small><strong>${onDuty} / ${nurses.length}${nurses.length ? html`<em className="chip">${Math.round(onDuty / nurses.length * 100)}%</em>` : ''}</strong><span>On shift today</span></div></button>
        <button className="card glass kpi" onClick=${() => go('schedule')}><span className="kpi-i"><${Icon} n="calendar" size=${22}/></span><div><small>Open shifts</small><strong>${open}</strong><span>${open ? 'Needs assignment' : 'Fully covered'}</span></div></button>
        <button className="card glass kpi" onClick=${() => go('reports')}><span className="kpi-i"><${Icon} n="alert" size=${22}/></span><div><small>Overtime alerts</small><strong>${otN}${otH > 0 && html`<em className="chip warn">${otH} hrs</em>`}</strong><span>High fatigue risk</span></div></button>
      </div>
      <section className="card glass pad"><div className="card-head"><h3>Nurse Staff Overview</h3><label className="search"><${Icon} n="search" size=${16}/><input placeholder="Search name or department" aria-label="Search nurses" value=${q} onChange=${(e) => setQ(e.target.value)}/></label><button className="btn btn-sm" onClick=${() => go('staff')}>View All Staff<${Icon} n="right" size=${14}/></button></div>
        ${shown.length === 0 ? html`<${Empty} icon="users" title="No nurses match" text="Change the department filter or search."/>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Name</th><th>Department</th><th>Current assignment</th><th>Shift hours</th><th>Workload / Fatigue</th><th></th></tr></thead><tbody>
        ${shown.map(({ n, a }, i) => { const s = st.schedule[n.id] && st.schedule[n.id][t]; return html`<tr key=${n.id}><td>${i + 1}</td><td><button className="who-btn" onClick=${() => openDetail(n.id)}><${Avatar} name=${n.name} size=${30}/>Nurse ${n.name}</button></td><td><span className="dept">${n.dept}</span></td><td>${s ? html`<${ShiftTag} s=${s}/>` : html`<span className="dim">Day off</span>`}</td><td>${isWork(s) ? SHIFTS[s].time : '—'}</td><td><span className="load"><i className=${'dot ' + dotClass(a.level)}></i><strong>${a.score}%</strong><small>(${a.level})</small></span></td><td className="right"><${Menu} items=${[{ label: 'View details', icon: 'user', onClick: () => openDetail(n.id) }, { label: 'Assign shift', icon: 'edit', onClick: () => openAssign({ uid: n.id, date: t }) }]}/></td></tr>`; })}</tbody></table></div>`}</section></div>`;
  }

  /* ----- schedule overview ----- */
  // // Roster grid (nurses x days, max 14 days) with a coverage row, plus open shifts with one-click suggestions.
  function Overview({ f, me, openAssign }) {
    const st = useStore(); const days = D.range(f.range.start, f.range.end).slice(0, 14); const t = D.today();
    const nurses = nurseList(st, f.dept).sort((a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));
    const cov = Store.coverage(st, f.dept, days); const openRows = cov.filter((r) => r.have < r.need);
    const assign = (uid, r) => { Store.setShift(uid, r.date, r.shift, me.id); toast(`Assigned ${SHIFT_NAME[r.shift]} on ${D.medium(r.date)}`); };
    return html`<div><${PageHead} title="Schedule Overview" sub="Click any cell to assign or change a shift. Coverage updates instantly."/>
      <div className="dash-bar"><${FilterBar} f=${f} setF=${f.set}/></div>
      ${D.diff(f.range.start, f.range.end) > 13 && html`<p className="muted-p">Showing the first 14 days of your range.</p>`}
      <section className="card glass pad"><div className="grid-wrap"><table className="roster"><thead><tr><th className="stick">Nurse</th>${days.map((d) => html`<th key=${d} className=${d === t ? 'today' : ''}><small>${UI.DOW[D.dow(d)]}</small>${D.parse(d).getDate()}</th>`)}</tr></thead><tbody>
        ${nurses.map((n) => html`<tr key=${n.id}><th className="stick"><span className="rn">${n.name}</span><small>${n.dept}</small></th>${days.map((d) => { const s = st.schedule[n.id] && st.schedule[n.id][d]; return html`<td key=${d}><button className="rcell" aria-label=${`${n.name}, ${D.medium(d)}, ${s ? SHIFT_NAME[s] : 'day off'}. Edit`} onClick=${() => openAssign({ uid: n.id, date: d })}>${s ? html`<${ShiftBadge} s=${s}/>` : html`<span className="dim">·</span>`}</button></td>`; })}</tr>`)}
        <tr className="cov"><th className="stick">Coverage</th>${days.map((d) => { const c = cov.filter((r) => r.date === d); const need = c.reduce((s, r) => s + r.need, 0); const have = c.reduce((s, r) => s + Math.min(r.have, r.need), 0); return html`<td key=${d}><span className=${cx('covb', have >= need ? 'ok' : 'bad')}>${have}/${need}</span></td>`; })}</tr></tbody></table></div></section>
      <section className="card glass pad"><h3 className="card-title">Open shifts <span className="count">${openRows.length}</span></h3>
        ${openRows.length === 0 ? html`<${Empty} icon="check" title="Every required shift is covered" text="Staffing requirements are met for this range."/>` : openRows.map((r) => { const el = Store.eligible(r.date, r.dept, r.shift).slice(0, 3); return html`<div key=${r.date + r.dept + r.shift} className="req"><div className="req-main"><${ShiftBadge} s=${r.shift}/> <strong>${r.dept}</strong> · ${SHIFT_NAME[r.shift]} · ${D.medium(r.date)}<small>${r.have} of ${r.need} nurses assigned</small></div><div className="req-act">${el.length ? el.map(({ user }) => html`<button key=${user.id} className="btn btn-sm" onClick=${() => assign(user.id, r)}>Assign ${Store.first(user)}</button>`) : html`<span className="dim">No one is available within rest and hour limits</span>`}</div></div>`; })}</section></div>`;
  }

  /* ----- staff management ----- */
  // // Add / edit nurse dialog (validation lives in Store.saveNurse).
  function NurseForm({ nurse, onClose }) {
    const st = useStore(); const [err, setErr] = useState('');
    const [f, setF] = useState(nurse ? { name: nurse.name, username: nurse.username, email: nurse.email, phone: nurse.phone, dept: nurse.dept, annual: nurse.leave.annual, sick: nurse.leave.sick, other: nurse.leave.other, password: '' } : { name: '', username: '', email: '', phone: '', dept: Object.keys(st.departments)[0], annual: 12, sick: 5, other: 3, password: '' });
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
    const submit = (e) => { e.preventDefault(); const r = Store.saveNurse(f, nurse && nurse.id); if (!r.ok) return setErr(r.error); toast(nurse ? 'Nurse updated' : 'Nurse added'); onClose(); };
    return html`<${Modal} title=${nurse ? 'Edit nurse' : 'Add nurse'} onClose=${onClose} wide footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className="btn btn-primary" form="nform" type="submit">${nurse ? 'Save changes' : 'Add nurse'}</button>`}>
      <form id="nform" onSubmit=${submit} noValidate>
        <div className="grid-2"><${Field} label="Full name"><input className="input" value=${f.name} onChange=${set('name')} autoFocus/><//><${Field} label="Department"><select className="select" value=${f.dept} onChange=${set('dept')}>${Object.keys(st.departments).map((d) => html`<option key=${d}>${d}</option>`)}</select><//></div>
        <div className="grid-2"><${Field} label="Email"><input className="input" type="email" value=${f.email} onChange=${set('email')}/><//><${Field} label="Username"><input className="input" value=${f.username} onChange=${set('username')}/><//></div>
        <div className="grid-2"><${Field} label="Phone"><input className="input" value=${f.phone} onChange=${set('phone')}/><//>${!nurse && html`<${Field} label="Temporary password" hint="At least 8 characters"><input className="input" type="text" value=${f.password} onChange=${set('password')}/><//>`}</div>
        <div className="grid-3"><${Field} label="Annual leave (days)"><input className="input" type="number" min="0" value=${f.annual} onChange=${set('annual')}/><//><${Field} label="Sick leave (days)"><input className="input" type="number" min="0" value=${f.sick} onChange=${set('sick')}/><//><${Field} label="VL/SL other (days)"><input className="input" type="number" min="0" value=${f.other} onChange=${set('other')}/><//></div>
        ${err && html`<p className="form-err" role="alert">${err}</p>`}</form><//>`;
  }
  function PwModal({ nurse, onClose }) {
    const [pw, setPw] = useState(''); const [err, setErr] = useState('');
    const save = () => { const r = Store.adminResetPassword(nurse.id, pw); if (!r.ok) return setErr(r.error); toast(`Password reset for ${nurse.name}`); onClose(); };
    return html`<${Modal} title="Reset password" small onClose=${onClose} footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className="btn btn-primary" onClick=${save}>Reset password</button>`}><${Field} label=${'New password for ' + nurse.name} error=${err}><input className="input" value=${pw} onChange=${(e) => setPw(e.target.value)} autoFocus/><//><//>`;
  }
  // // Staff management table: search, filters, edit, reset password, deactivate, delete.
  function Staff() {
    const st = useStore(); const [q, setQ] = useState(''); const [dept, setDept] = useState('all'); const [status, setStatus] = useState('active'); const [form, setForm] = useState(null); const [pw, setPw] = useState(null);
    const list = st.users.filter((u) => u.role === 'nurse' && (dept === 'all' || u.dept === dept) && (status === 'all' || (status === 'active') === u.active) && (!q || (u.name + u.email + u.empId).toLowerCase().includes(q.toLowerCase())));
    const remove = async (u) => { if (await confirm({ title: 'Delete nurse?', message: `${u.name} will be removed along with their schedule and requests. Deactivate instead to keep history.`, confirmLabel: 'Delete', danger: true })) { Store.removeNurse(u.id); toast('Nurse deleted'); } };
    return html`<div><${PageHead} title="Staff Management" sub=${`${list.length} nurse${list.length === 1 ? '' : 's'}`} actions=${html`<button className="btn btn-primary" onClick=${() => setForm({})}><${Icon} n="plus" size=${16}/>Add nurse</button>`}/>
      <div className="toolbar"><label className="search grow"><${Icon} n="search" size=${16}/><input placeholder="Search name, email or ID" aria-label="Search staff" value=${q} onChange=${(e) => setQ(e.target.value)}/></label>
        <select className="select auto" aria-label="Department" value=${dept} onChange=${(e) => setDept(e.target.value)}><option value="all">All departments</option>${Object.keys(st.departments).map((d) => html`<option key=${d}>${d}</option>`)}</select>
        <select className="select auto" aria-label="Status" value=${status} onChange=${(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></div>
      <section className="card glass pad">${list.length === 0 ? html`<${Empty} icon="users" title="No nurses found" text="Adjust the filters or add a new nurse."/>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>ID</th><th>Department</th><th>Contact</th><th>Leave (A / S / O)</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((u) => html`<tr key=${u.id}><td><span className="who-btn static"><${Avatar} name=${u.name} size=${30}/>Nurse ${u.name}</span></td><td>${u.empId}</td><td><span className="dept">${u.dept}</span></td><td>${u.email}<small className="note-s">${u.phone}</small></td><td>${u.leave.annual} / ${u.leave.sick} / ${u.leave.other}</td><td><${Pill} kind=${u.active ? 'ok' : 'muted'}>${u.active ? 'Active' : 'Inactive'}<//></td><td className="right"><${Menu} items=${[{ label: 'Edit', icon: 'edit', onClick: () => setForm(u) }, { label: 'Reset password', icon: 'key', onClick: () => setPw(u) }, { label: u.active ? 'Deactivate' : 'Activate', icon: u.active ? 'x' : 'check', onClick: () => { Store.setActive(u.id, !u.active); toast(u.active ? 'Nurse deactivated' : 'Nurse activated'); } }, { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(u) }]}/></td></tr>`)}</tbody></table></div>`}</section>
      ${form && html`<${NurseForm} nurse=${form.id ? form : null} onClose=${() => setForm(null)}/>`}${pw && html`<${PwModal} nurse=${pw} onClose=${() => setPw(null)}/>`}</div>`;
  }

  /* ----- shift generator ----- */
  // // Shift Generator: configure -> preview (before/after metrics + change list) -> apply.
  // // Nothing is saved until "Apply schedule".
  function Generator({ f, me }) {
    const st = useStore(); const [o, setO] = useState({ dept: f.dept, start: f.range.start, end: f.range.end, mode: 'fill', maxConsecutive: 5, allowOvertime: false });
    const [res, setRes] = useState(null);
    const set = (k, v) => setO((p) => Object.assign({}, p, { [k]: v }));
    const run = (opts) => {
      const x = opts || o; if (x.end < x.start) return toast('The end date must be on or after the start date.', 'bad');
      const g = Store.generate(st, x); const scope = nurseList(st, x.dept);
      const high = (sched) => scope.filter((n) => Store.analyze(st, n.id, x.start, x.end, sched).level === 'High').length;
      setRes(Object.assign(g, { openBefore: Store.openCount(Store.coverage(st, x.dept, g.days)), openAfter: Store.openCount(Store.coverage(st, x.dept, g.days, g.schedule)), highBefore: high(st.schedule), highAfter: high(g.schedule) }));
    };
    useEffect(() => { if (sessionStorage.getItem('intellisched.autogen')) { sessionStorage.removeItem('intellisched.autogen'); run(); } }, []);
    const apply = () => { Store.applyChanges(res.changes); toast(`Schedule applied: ${res.changes.length} change${res.changes.length === 1 ? '' : 's'}`); setRes(null); };
    const nm = (id) => (st.users.find((u) => u.id === id) || {}).name;
    return html`<div><${PageHead} title="Shift Generator" sub="Builds a schedule that meets staffing needs, respects rest rules and balances workload. Review before applying."/>
      <div className="split gen">
        <section className="card glass pad"><h3 className="card-title">Settings</h3>
          <${Field} label="Department"><select className="select" value=${o.dept} onChange=${(e) => set('dept', e.target.value)}><option value="all">All departments</option>${Object.keys(st.departments).map((d) => html`<option key=${d}>${d}</option>`)}</select><//>
          <div className="grid-2"><${Field} label="From"><input className="input" type="date" value=${o.start} onChange=${(e) => set('start', e.target.value)}/><//><${Field} label="To"><input className="input" type="date" min=${o.start} value=${o.end} onChange=${(e) => set('end', D.diff(o.start, e.target.value) > 60 ? D.addDays(o.start, 60) : e.target.value)}/><//></div>
          <${Field} label="Mode"><${Segmented} label="Mode" value=${o.mode} onChange=${(v) => set('mode', v)} options=${[{ value: 'fill', label: 'Fill open shifts' }, { value: 'rebuild', label: 'Rebuild range' }]}/><//>
          <p className="field-h">${o.mode === 'fill' ? 'Keeps every current shift and only fills gaps.' : 'Clears shifts in the range (leave is kept) and assigns them again.'}</p>
          <${Field} label=${'Max consecutive working days: ' + o.maxConsecutive}><input type="range" min="3" max="7" value=${o.maxConsecutive} onChange=${(e) => set('maxConsecutive', +e.target.value)}/><//>
          <${Toggle} label="Allow a 6th shift in a week" hint="Counts as overtime. Use only when coverage can't be met" checked=${o.allowOvertime} onChange=${(v) => set('allowOvertime', v)}/>
          <div className="form-actions"><button className="btn btn-primary" onClick=${() => run()}><${Icon} n="sparkle" size=${16}/>Generate preview</button></div></section>
        <section className="card glass pad">${!res ? html`<${Empty} icon="sparkle" title="No preview yet" text="Adjust the settings and generate a preview. Nothing changes until you apply it."/>` : html`<div>
          <h3 className="card-title">Preview</h3>
          <div className="stat-row"><div className="mini-stat"><small>Open shifts</small><strong>${res.openBefore} → ${res.openAfter}</strong></div><div className="mini-stat"><small>High fatigue</small><strong>${res.highBefore} → ${res.highAfter}</strong></div><div className="mini-stat"><small>Changes</small><strong>${res.changes.length}</strong></div><div className="mini-stat"><small>Unfilled</small><strong>${res.unfilled.length}</strong></div></div>
          ${res.unfilled.length > 0 && html`<div className="warn"><${Icon} n="alert" size=${16}/><div><strong>Couldn't fill ${res.unfilled.length} slot${res.unfilled.length > 1 ? 's' : ''}</strong><p>${res.unfilled.slice(0, 5).map((u) => `${u.dept} ${SHIFTS[u.shift].label} ${D.short(u.date)}`).join(', ')}${res.unfilled.length > 5 ? '…' : ''}. Try allowing a 6th shift or raise max consecutive days.</p></div></div>`}
          ${res.changes.length === 0 ? html`<p className="muted-p">The current schedule already matches these settings.</p>` : html`<div className="table-wrap tall"><table className="table"><thead><tr><th>Nurse</th><th>Date</th><th>Change</th></tr></thead><tbody>${res.changes.slice(0, 60).map((c, i) => html`<tr key=${i}><td>${nm(c.uid)}</td><td>${D.medium(c.date)}</td><td>${c.from ? html`<${ShiftBadge} s=${c.from}/>` : html`<span className="dim">Off</span>`} <${Icon} n="right" size=${14}/> ${c.to ? html`<${ShiftBadge} s=${c.to}/>` : html`<span className="dim">Off</span>`}</td></tr>`)}</tbody></table></div>${res.changes.length > 60 && html`<small className="dim">Showing 60 of ${res.changes.length} changes.</small>`}`}
          <div className="form-actions"><button className="btn" onClick=${() => setRes(null)}>Discard</button><button className="btn btn-primary" disabled=${!res.changes.length} onClick=${apply}>Apply schedule</button></div></div>`}</section></div></div>`;
  }

  /* ----- approvals ----- */
  // // Chief Nurse decisions on swaps (after the colleague accepted) and leave requests.
  function Approvals({ me }) {
    const st = useStore(); const [tab, setTab] = useState('swaps'); const [decide, setDecide] = useState(null);
    const nm = (id) => (st.users.find((u) => u.id === id) || { name: 'Former staff' }).name;
    const swaps = st.swaps; const leaves = st.leaves;
    const pSw = swaps.filter((w) => w.status === 'awaiting_chief'), pLv = leaves.filter((l) => l.status === 'pending');
    const submit = (note) => {
      const { kind, item, approve } = decide;
      const r = kind === 'swap' ? Store.decideSwap(item.id, me.id, approve, note) : Store.decideLeave(item.id, approve, note);
      r.ok ? toast(approve ? 'Approved' : 'Rejected') : toast(r.error, 'bad'); setDecide(null);
    };
    const acts = (kind, item) => html`<div className="req-act"><button className="btn btn-sm" onClick=${() => setDecide({ kind, item, approve: false })}>Reject</button><button className="btn btn-sm btn-primary" onClick=${() => setDecide({ kind, item, approve: true })}>Approve</button></div>`;
    return html`<div><${PageHead} title="Approvals" sub="Shift swaps and leave requests waiting on you."/>
      <div className="toolbar"><${Segmented} label="Request type" value=${tab} onChange=${setTab} options=${[{ value: 'swaps', label: `Shift swaps (${pSw.length})` }, { value: 'leave', label: `Leave (${pLv.length})` }]}/></div>
      ${tab === 'swaps' ? html`<div>
        <section className="card glass pad group"><h3 className="card-title">Ready for approval</h3>${pSw.length === 0 ? html`<${Empty} icon="check" title="No swaps waiting" text="Accepted swaps from nurses will appear here."/>` : pSw.map((w) => html`<div key=${w.id} className="req"><div className="req-main"><strong>${nm(w.requesterId)}</strong> ⇄ <strong>${nm(w.targetId)}</strong><br/>${nm(w.requesterId)} gives ${SHIFTS[w.shift].label} on ${D.medium(w.date)}; ${nm(w.targetId)} gives ${SHIFTS[w.targetShift].label} on ${D.medium(w.targetDate)}.${w.reason && html`<small>“${w.reason}”</small>`}</div>${acts('swap', w)}</div>`)}</section>
        <section className="card glass pad"><h3 className="card-title">All swap requests</h3>${swaps.length === 0 ? html`<p className="muted-p">No requests yet.</p>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>Requester</th><th>With</th><th>Dates</th><th>Status</th></tr></thead><tbody>${swaps.map((w) => html`<tr key=${w.id}><td>${nm(w.requesterId)}</td><td>${nm(w.targetId)}</td><td>${D.short(w.date)} ⇄ ${D.short(w.targetDate)}</td><td><${SwapPill} s=${w.status}/></td></tr>`)}</tbody></table></div>`}</section></div>` : html`<div>
        <section className="card glass pad group"><h3 className="card-title">Pending leave</h3>${pLv.length === 0 ? html`<${Empty} icon="check" title="No leave waiting" text="New requests from nurses will appear here."/>` : pLv.map((l) => { const clash = nurseList(st, st.users.find((u) => u.id === l.userId).dept).filter((n) => n.id !== l.userId && D.range(l.start, l.end).some((d) => st.schedule[n.id] && st.schedule[n.id][d] === 'L')).length; return html`<div key=${l.id} className="req"><div className="req-main"><strong>${nm(l.userId)}</strong> · ${LEAVE_TYPES[l.type]} · ${l.days} day${l.days > 1 ? 's' : ''}<br/>${D.medium(l.start)} – ${D.medium(l.end)}${clash > 0 && html`<small className="warn-t">${clash} colleague${clash > 1 ? 's' : ''} in the same department already on leave</small>`}${l.reason && html`<small>“${l.reason}”</small>`}</div>${acts('leave', l)}</div>`; })}</section>
        <section className="card glass pad"><h3 className="card-title">All leave requests</h3>${leaves.length === 0 ? html`<p className="muted-p">No requests yet.</p>` : html`<div className="table-wrap"><table className="table"><thead><tr><th>Nurse</th><th>Type</th><th>Dates</th><th>Status</th></tr></thead><tbody>${leaves.map((l) => html`<tr key=${l.id}><td>${nm(l.userId)}</td><td>${LEAVE_TYPES[l.type]}</td><td>${D.short(l.start)} – ${D.short(l.end)}</td><td><${LeavePill} s=${l.status}/></td></tr>`)}</tbody></table></div>`}</section></div>`}
      ${decide && html`<${NoteModal} d=${decide} onClose=${() => setDecide(null)} onSubmit=${submit}/>`}</div>`;
  }
  function NoteModal({ d, onClose, onSubmit }) {
    const [note, setNote] = useState('');
    return html`<${Modal} title=${d.approve ? 'Approve request' : 'Reject request'} small onClose=${onClose} footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className=${d.approve ? 'btn btn-primary' : 'btn btn-danger'} onClick=${() => onSubmit(note)}>${d.approve ? 'Approve' : 'Reject'}</button>`}><${Field} label="Note to the nurse (optional)"><textarea className="textarea" rows="3" value=${note} onChange=${(e) => setNote(e.target.value)} autoFocus></textarea><//><//>`;
  }

  /* ----- reports ----- */
  // // Coverage, hours, shift mix and fatigue for the selected filters. CSV export and print supported.
  function Reports({ f }) {
    const st = useStore(); const { start, end } = f.range; const days = D.range(start, end);
    const nurses = nurseList(st, f.dept); const cov = Store.coverage(st, f.dept, days);
    const rows = nurses.map((n) => ({ n, a: Store.analyze(st, n.id, start, end) }));
    const depts = Object.keys(st.departments).filter((d) => f.dept === 'all' || d === f.dept);
    const pct = (rs) => { const need = rs.reduce((s, r) => s + r.need, 0); return need ? Math.round(rs.reduce((s, r) => s + Math.min(r.have, r.need), 0) / need * 100) : 100; };
    const totalCov = pct(cov); const hours = rows.reduce((s, r) => s + r.a.hours, 0); const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.a.score, 0) / rows.length) : 0;
    const dist = SHIFT_ORDER.map((s) => ({ s, n: rows.reduce((c, r) => c + days.filter((d) => st.schedule[r.n.id] && st.schedule[r.n.id][d] === s).length, 0) }));
    const maxD = Math.max(1, ...dist.map((x) => x.n));
    const lv = ['Low', 'Medium', 'High'].map((l) => ({ l, n: rows.filter((r) => r.a.level === l).length }));
    const csv = () => {
      const lines = [['Nurse', 'Department', 'Shifts', 'Hours', 'Night shifts', 'Overtime hrs', 'Workload %', 'Level'], ...rows.map(({ n, a }) => [n.name, n.dept, a.shifts, a.hours, a.nights, a.overtime, a.score, a.level])];
      download(`intellisched-report-${start}-to-${end}.csv`, lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); toast('Report exported');
    };
    return html`<div><${PageHead} title="Reports" sub=${`${D.long(start)} – ${D.long(end)}`} actions=${html`<button className="btn" onClick=${() => window.print()}><${Icon} n="print" size=${16}/>Print</button><button className="btn btn-primary" onClick=${csv}><${Icon} n="download" size=${16}/>Export CSV</button>`}/>
      <div className="dash-bar"><${FilterBar} f=${f} setF=${f.set}/></div>
      <div className="kpis four"><div className="card glass kpi static"><div><small>Coverage</small><strong>${totalCov}%</strong><span>of required shifts filled</span></div></div><div className="card glass kpi static"><div><small>Scheduled hours</small><strong>${hours}</strong><span>${rows.length} nurses</span></div></div><div className="card glass kpi static"><div><small>Average workload</small><strong>${avg}%</strong><span>across staff</span></div></div><div className="card glass kpi static"><div><small>Pending approvals</small><strong>${st.swaps.filter((w) => w.status === 'awaiting_chief').length + st.leaves.filter((l) => l.status === 'pending').length}</strong><span>swaps and leave</span></div></div></div>
      <div className="split">
        <section className="card glass pad"><h3 className="card-title">Coverage by department</h3>${depts.map((d) => { const p = pct(cov.filter((r) => r.dept === d)); return html`<div key=${d} className="bar-row"><span>${d}</span><div className="bar"><i className=${p < 100 ? 'warn' : ''} style=${{ width: p + '%' }}></i></div><strong>${p}%</strong></div>`; })}</section>
        <section className="card glass pad"><h3 className="card-title">Shifts by type</h3>${dist.map((x) => html`<div key=${x.s} className="bar-row"><span>${SHIFTS[x.s].label}</span><div className="bar"><i style=${{ width: x.n / maxD * 100 + '%' }}></i></div><strong>${x.n}</strong></div>`)}
          <h3 className="card-title sp">Fatigue levels</h3>${lv.map((x) => html`<div key=${x.l} className="bar-row"><span>${x.l}</span><div className="bar"><i className=${dotClass(x.l)} style=${{ width: (rows.length ? x.n / rows.length * 100 : 0) + '%' }}></i></div><strong>${x.n}</strong></div>`)}</section></div>
      <section className="card glass pad"><h3 className="card-title">Nurse workload</h3><div className="table-wrap tall"><table className="table"><thead><tr><th>Nurse</th><th>Dept</th><th>Shifts</th><th>Hours</th><th>Nights</th><th>Overtime</th><th>Workload</th></tr></thead><tbody>${rows.sort((a, b) => b.a.score - a.a.score).map(({ n, a }) => html`<tr key=${n.id}><td>${n.name}</td><td>${n.dept}</td><td>${a.shifts}</td><td>${a.hours}</td><td>${a.nights}</td><td>${a.overtime ? a.overtime + ' hrs' : '—'}</td><td><span className="load"><i className=${'dot ' + dotClass(a.level)}></i><strong>${a.score}%</strong><small>(${a.level})</small></span></td></tr>`)}</tbody></table></div></section></div>`;
  }

  /* ----- settings ----- */
  // // Minimum staffing per department/shift (drives open shifts and the generator), account forms, demo reset.
  function SettingsView({ me }) {
    const st = useStore();
    const reset = async () => { if (await confirm({ title: 'Reset demo data?', message: 'This replaces all nurses, schedules and requests with fresh sample data and signs everyone out.', confirmLabel: 'Reset data', danger: true })) { Store.resetData(); Store.logout(); location.href = 'login.html'; } };
    return html`<div><${PageHead} title="Settings" sub="Staffing rules drive open-shift detection and the shift generator."/>
      <section className="card glass pad"><h3 className="card-title">Minimum nurses per shift</h3><div className="table-wrap"><table className="table"><thead><tr><th>Department</th>${SHIFT_ORDER.map((s) => html`<th key=${s}>${SHIFTS[s].label}</th>`)}</tr></thead><tbody>${Object.keys(st.departments).map((d) => html`<tr key=${d}><td><strong>${d}</strong><small className="note-s">${st.departments[d].name}</small></td>${SHIFT_ORDER.map((s) => html`<td key=${s}><input className="input num" type="number" min="0" max="9" aria-label=${`${d} ${SHIFTS[s].label} minimum`} value=${st.departments[d].min[s]} onChange=${(e) => Store.updateDeptMin(d, s, e.target.value)}/></td>`)}</tr>`)}</tbody></table></div></section>
      <div className="split"><${ProfileForm} user=${me}/><${PasswordForm} user=${me}/></div>
      <section className="card glass pad"><h3 className="card-title">Demo data</h3><p className="muted-p">All data lives in this browser. Reset to start over with sample staff and schedules.</p><button className="btn btn-danger" onClick=${reset}>Reset demo data</button></section></div>`;
  }

  /* ----- app ----- */
  // // Root: guards the role, owns the shared filters and the assign/detail modals.
  function App() {
    const st = useStore(); const me = Store.currentUser(); const t = D.today();
    const [view, setView] = useHash('dashboard', VIEWS);
    const [flt, setFlt] = useState({ dept: 'all', range: { start: t, end: D.addDays(t, 6) } });
    const [assign, setAssign] = useState(null); const [detail, setDetail] = useState(null);
    if (!me || me.role !== 'chief') return null;
    const f = Object.assign({}, flt, { set: (p) => setFlt((x) => Object.assign({}, x, p)) });
    const pend = st.swaps.filter((w) => w.status === 'awaiting_chief').length + st.leaves.filter((l) => l.status === 'pending').length;
    const nav = [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { id: 'schedule', label: 'Schedule Overview', icon: 'calendar' }, { id: 'staff', label: 'Staff Management', icon: 'users' }, { id: 'generator', label: 'Shift Generator', icon: 'sparkle' }, { id: 'approvals', label: 'Approvals', icon: 'swap', badge: pend }, { id: 'reports', label: 'Reports', icon: 'file' }];
    const common = { f, me, go: setView, openAssign: setAssign, openDetail: setDetail };
    const V = { dashboard: Dashboard, schedule: Overview, staff: Staff, generator: Generator, approvals: Approvals, reports: Reports, settings: SettingsView }[view];
    return html`<${Shell} user=${me} nav=${nav} view=${view} onNav=${setView}><${V} ...${common}/>
      ${detail && html`<${DetailModal} uid=${detail} range=${f.range} onClose=${() => setDetail(null)} onAssign=${(a) => { setDetail(null); setAssign(a); }}/>`}
      ${assign && html`<${AssignModal} target=${assign} me=${me} onClose=${() => setAssign(null)}/>`}<//>`;
  }
  if (me0 && me0.role === 'chief') ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
})();
