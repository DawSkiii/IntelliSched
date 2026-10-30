/*
 * Shared UI kit  (js/ui.js)
 * Reusable React pieces used by login.js, nurse.js and chief.js: icons, shell layout,
 * calendar, modal/toast/confirm, form helpers. Loaded after store.js and before the page script.
 * Exposed as window.UI.
 */
/* Shared UI kit: icons, shell (header + sidebar), calendar, modals, toasts, forms. */
(function (global) {
  'use strict';
  const { useState, useEffect, useRef, useSyncExternalStore } = React;
  // // `html` is htm bound to React.createElement: write JSX-like markup in tagged templates.
  // // Components are referenced as <${Component} prop=${value}/> and closed with <//>.
  // // Use className (not class) and htmlFor (not for) so React does not warn.
  const html = htm.bind(React.createElement);
  const { Dates: D, SHIFTS, SHIFT_NAME, SWAP_STATUS, LEAVE_STATUS } = Store;
  const cx = (...a) => a.filter(Boolean).join(' ');
  // // Hospital logo, used by <Logo/> (falls back to a heart icon if the image fails to load).
  const LOGO_URL = 'https://cdn-healthcare.hellohealthgroup.com/hospitals/ph/metro-vigan-cooperative-hospital20220211.png?w=256&q=75';

  // // Subscribes a component to the Store; it re-renders whenever any Store action commits.
  const useStore = () => useSyncExternalStore(Store.subscribe, Store.getState);

  /* ---------- icons ---------- */
  const r = (x, y, w, h, rx) => ['rect', { x, y, width: w, height: h, rx }];
  const c = (cx_, cy, rr) => ['circle', { cx: cx_, cy, r: rr }];
  // // Inline SVG icon set (24x24 grid, stroke style). Each entry is a list of parts:
  // // a string is a <path d>, an array is [tagName, attributes]. Add new icons here, use <${Icon} n="name"/>.
  const ICONS = {
    dashboard: [r(3, 3, 7, 7, 1.5), r(14, 3, 7, 7, 1.5), r(14, 14, 7, 7, 1.5), r(3, 14, 7, 7, 1.5)],
    calendar: [r(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18'],
    swap: ['M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3'],
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M16 13H8M16 17H8M10 9H8'],
    user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', c(12, 7, 4)],
    users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', c(9, 7, 4), 'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
    settings: [c(12, 12, 3), 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'],
    bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
    left: ['M15 18l-6-6 6-6'], right: ['M9 18l6-6-6-6'], down: ['M6 9l6 6 6-6'],
    building: [r(4, 2, 16, 20, 2), 'M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4M12 17h.01'],
    sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 3v4M21 5h-4M5 17v4M7 19H3'],
    mail: [r(2, 4, 20, 16, 2), 'M22 7l-10 6L2 7'],
    lock: [r(3, 11, 18, 11, 2), 'M7 11V7a5 5 0 0 1 10 0v4'],
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', c(12, 12, 3)],
    eyeOff: ['M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'],
    logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
    plus: ['M12 5v14M5 12h14'], x: ['M18 6L6 18M6 6l12 12'], check: ['M20 6L9 17l-5-5'],
    clock: [c(12, 12, 10), 'M12 6v6l4 2'],
    search: [c(11, 11, 8), 'M21 21l-4.3-4.3'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
    menu: ['M3 12h18M3 6h18M3 18h18'],
    more: [c(12, 12, 1), c(12, 5, 1), c(12, 19, 1)],
    trash: ['M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'],
    edit: ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
    chart: ['M3 3v18h18M7 15v3M12 9v9M17 5v13'],
    key: [c(7.5, 15.5, 4.5), 'M10.7 12.3L21 2M16 7l3 3'],
    info: [c(12, 12, 10), 'M12 16v-4M12 8h.01'],
    heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z'],
    print: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', r(6, 14, 12, 8, 1)],
  };
  function Icon({ n, size = 18 }) {
    const parts = ICONS[n] || [];
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false, className: 'ico' },
      parts.map((p, i) => (typeof p === 'string' ? React.createElement('path', { key: i, d: p }) : React.createElement(p[0], Object.assign({ key: i }, p[1])))));
  }

  /* ---------- hooks ---------- */
  // // Calls cb when the user presses outside ref's element (used by dropdowns and popovers).
  function useClickAway(ref, cb) {
    const cbRef = useRef(cb); cbRef.current = cb;
    useEffect(() => {
      const f = (e) => { if (ref.current && !ref.current.contains(e.target)) cbRef.current(); };
      document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
    }, [ref]);
  }
  // // Tiny hash router: '#schedule' etc. Returns [currentView, setView]. Unknown hashes fall back to def.
  function useHash(def, valid) {
    const read = () => { const h = location.hash.slice(1); return valid.includes(h) ? h : def; };
    const [v, setV] = useState(read);
    useEffect(() => { const f = () => setV(read()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
    return [v, (id) => { location.hash = id; window.scrollTo({ top: 0 }); }];
  }

  /* ---------- toast + confirm ---------- */
  // // Toasts: call UI.toast('message', 'ok' | 'bad') from anywhere. <ToastHost/> (mounted in Shell) renders them.
  const toastBus = new Set();
  function toast(msg, type) { toastBus.forEach((f) => f({ id: Math.random(), msg, type: type || 'ok' })); }
  function ToastHost() {
    const [list, setList] = useState([]);
    useEffect(() => {
      const f = (t) => { setList((l) => l.concat(t)); setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3800); };
      toastBus.add(f); return () => toastBus.delete(f);
    }, []);
    return html`<div className="toasts" role="status" aria-live="polite">${list.map((t) => html`<div key=${t.id} className=${'toast ' + t.type}><${Icon} n=${t.type === 'bad' ? 'alert' : 'check'} size=${16}/>${t.msg}</div>`)}</div>`;
  }
  // // UI.confirm({ title, message, confirmLabel, danger }) returns a Promise<boolean>. Rendered by <ConfirmHost/>.
  let confirmHandler = null;
  const confirm = (opts) => new Promise((res) => (confirmHandler ? confirmHandler(Object.assign({ res }, opts)) : res(window.confirm(opts.message))));
  function ConfirmHost() {
    const [c, setC] = useState(null);
    useEffect(() => { confirmHandler = setC; return () => { confirmHandler = null; }; }, []);
    if (!c) return null;
    const done = (v) => { c.res(v); setC(null); };
    return html`<${Modal} title=${c.title} small onClose=${() => done(false)} footer=${html`<button className="btn" onClick=${() => done(false)}>Cancel</button><button className=${c.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick=${() => done(true)}>${c.confirmLabel || 'Confirm'}</button>`}><p className="muted-p">${c.message}</p><//>`;
  }

  /* ---------- primitives ---------- */
  // // Accessible dialog: closes on Escape or backdrop click and locks page scroll while open.
  // // Props: title, onClose, footer (buttons), wide / small sizes.
  function Modal({ title, onClose, children, footer, wide, small }) {
    const ref = useRef(onClose); ref.current = onClose;
    useEffect(() => {
      const k = (e) => { if (e.key === 'Escape') ref.current(); };
      document.addEventListener('keydown', k); document.body.classList.add('no-scroll');
      return () => { document.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
    }, []);
    return html`<div className="scrim" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
      <div className=${cx('modal glass', wide && 'wide', small && 'small')} role="dialog" aria-modal="true" aria-label=${title}>
        <div className="modal-h"><h3>${title}</h3><button className="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} n="x"/></button></div>
        <div className="modal-b">${children}</div>
        ${footer && html`<div className="modal-f">${footer}</div>`}
      </div></div>`;
  }
  // // Label + control wrapper with optional hint and error text.
  function Field({ label, error, hint, children }) {
    return html`<label className="field"><span className="field-l">${label}</span>${children}${hint && html`<span className="field-h">${hint}</span>`}${error && html`<span className="field-e">${error}</span>`}</label>`;
  }
  function Segmented({ options, value, onChange, label }) {
    return html`<div className="seg" role="group" aria-label=${label}>${options.map((o) => html`<button key=${o.value} type="button" className=${cx('seg-b', o.value === value && 'on')} aria-pressed=${o.value === value} onClick=${() => onChange(o.value)}>${o.label}</button>`)}</div>`;
  }
  function Toggle({ checked, onChange, label, hint }) {
    return html`<label className="toggle-row"><span><strong>${label}</strong>${hint && html`<small>${hint}</small>`}</span><input type="checkbox" className="switch" checked=${checked} onChange=${(e) => onChange(e.target.checked)}/></label>`;
  }
  const initials = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  function Avatar({ name, size = 34 }) { return html`<span className="avatar" style=${{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">${initials(name)}</span>`; }
  function Pill({ kind, children }) { return html`<span className=${'pill ' + (kind || '')}>${children}</span>`; }
  function SwapPill({ s }) { const [t, k] = SWAP_STATUS[s]; return html`<${Pill} kind=${k}>${t}<//>`; }
  function LeavePill({ s }) { const [t, k] = LEAVE_STATUS[s]; return html`<${Pill} kind=${k}>${t}<//>`; }
  function ShiftBadge({ s, size }) { return html`<span className=${cx('sb', 'sb-' + s, size === 'lg' && 'lg')} title=${SHIFT_NAME[s]}>${s}</span>`; }
  function ShiftTag({ s }) { return s === 'L' ? html`<span className="tag tag-L">On leave</span>` : html`<span className=${'tag tag-' + s}>${SHIFTS[s].name}</span>`; }
  function Empty({ icon, title, text, action }) {
    return html`<div className="empty"><span className="empty-ico"><${Icon} n=${icon || 'info'} size=${22}/></span><strong>${title}</strong>${text && html`<p>${text}</p>`}${action}</div>`;
  }
  function PageHead({ title, sub, actions }) {
    return html`<div className="page-head"><div><h1>${title}</h1>${sub && html`<p>${sub}</p>`}</div>${actions && html`<div className="page-actions">${actions}</div>`}</div>`;
  }
  function Logo({ size = 40 }) {
    const [bad, setBad] = useState(false);
    return html`<span className="logo-tile" style=${{ width: size, height: size }}>${bad ? html`<${Icon} n="heart" size=${size * 0.55}/>` : html`<img src=${LOGO_URL} alt="Metro Vigan Cooperative Hospital logo" onError=${() => setBad(true)}/>`}</span>`;
  }
  // // Kebab menu. The popup uses position: fixed so tables with overflow scrolling cannot clip it.
  function Menu({ items, label }) {
    const [pos, setPos] = useState(null); const ref = useRef(null);
    useClickAway(ref, () => setPos(null));
    useEffect(() => { if (!pos) return; const f = () => setPos(null); addEventListener('scroll', f, true); addEventListener('resize', f); return () => { removeEventListener('scroll', f, true); removeEventListener('resize', f); }; }, [pos]);
    const toggle = (e) => { if (pos) return setPos(null); const b = e.currentTarget.getBoundingClientRect(); setPos({ top: b.bottom + 6, right: window.innerWidth - b.right }); };
    return html`<div className="menu" ref=${ref}><button className="icon-btn" aria-label=${label || 'More actions'} aria-expanded=${!!pos} onClick=${toggle}><${Icon} n="more"/></button>
      ${pos && html`<div className="menu-pop glass" role="menu" style=${{ top: pos.top, right: pos.right }}>${items.filter(Boolean).map((it, i) => html`<button key=${i} role="menuitem" className=${cx('menu-item', it.danger && 'danger')} onClick=${() => { setPos(null); it.onClick(); }}>${it.icon && html`<${Icon} n=${it.icon} size=${16}/>`}${it.label}</button>`)}</div>`}</div>`;
  }
  const ago = (ts) => {
    const m = Math.round((Date.now() - ts) / 6e4);
    if (m < 1) return 'Just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' hr ago';
    return Math.round(m / 1440) + ' d ago';
  };
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  /* ---------- calendar ---------- */
  // // Calendar pieces. `cell(date)` callbacks return { shift, pending } so MonthGrid / WeekStrip stay
  // // data-agnostic and can be reused by any page.
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function MonthGrid({ month, cell, onSelect }) {
    const today = D.today(); const lead = D.dow(month); const rows = Math.ceil((lead + D.daysInMonth(month)) / 7);
    const start = D.startOfWeek(month);
    const days = Array.from({ length: rows * 7 }, (_, i) => D.addDays(start, i));
    return html`<div className="cal" role="grid" aria-label=${D.month(month)}>
      ${DOW.map((w) => html`<div key=${w} className="cal-dow" role="columnheader">${w}</div>`)}
      ${days.map((d) => {
        const k = cell(d) || {}; const inMonth = d.slice(0, 7) === month.slice(0, 7);
        return html`<button key=${d} className=${cx('cal-cell', !inMonth && 'out', d === today && 'today')} onClick=${() => onSelect && onSelect(d)} aria-label=${D.medium(d) + (k.shift ? ', ' + SHIFT_NAME[k.shift] : ', no shift') + (k.pending ? ', pending request' : '')}>
          <span className="cal-num">${D.parse(d).getDate()}${d === today && html`<i className="today-dot"></i>`}</span>
          <span className="cal-marks">${k.shift && html`<${ShiftBadge} s=${k.shift}/>`}${k.pending && html`<span className="sb sb-pending" title="Pending request"><i></i></span>`}</span></button>`;
      })}</div>`;
  }
  function WeekStrip({ start, cell, onSelect }) {
    const today = D.today();
    return html`<div className="week">${Array.from({ length: 7 }, (_, i) => D.addDays(start, i)).map((d) => {
      const k = cell(d) || {};
      return html`<button key=${d} className=${cx('week-day', d === today && 'today')} onClick=${() => onSelect && onSelect(d)}>
        <span className="wd-n">${DOW[D.dow(d)]}</span><strong>${D.parse(d).getDate()}</strong>
        ${k.shift ? html`<${ShiftBadge} s=${k.shift} size="lg"/><small>${k.shift === 'L' ? 'Leave' : SHIFTS[k.shift].time}</small>` : html`<small className="dim">Day off</small>`}
        ${k.pending && html`<span className="sb sb-pending" title="Pending request"><i></i></span>`}</button>`;
    })}</div>`;
  }

  /* ---------- shell ---------- */
  // // Page frame shared by the nurse and chief pages: top bar (brand, notifications, user menu),
  // // sidebar navigation (drawer on mobile) and the main content area.
  // // nav items: { id, label, icon, badge? }. Settings is always pinned at the bottom of the sidebar.
  function Shell({ user, nav, view, onNav, children }) {
    const st = useStore();
    const [drawer, setDrawer] = useState(false), [bell, setBell] = useState(false), [um, setUm] = useState(false);
    const bellRef = useRef(null), umRef = useRef(null);
    useClickAway(bellRef, () => setBell(false)); useClickAway(umRef, () => setUm(false));
    const notes = st.notifications.filter((n) => n.uid === user.id);
    const unread = notes.filter((n) => !n.read).length;
    const go = (id) => { setDrawer(false); setUm(false); onNav(id); };
    const logout = () => { Store.logout(); location.href = 'login.html'; };
    const item = (n) => html`<button key=${n.id} className=${cx('nav-item', view === n.id && 'on')} aria-current=${view === n.id ? 'page' : undefined} onClick=${() => go(n.id)}><${Icon} n=${n.icon}/><span>${n.label}</span>${n.badge ? html`<em className="nav-badge">${n.badge}</em>` : null}</button>`;
    const short = (user.role === 'chief' ? 'Chief Nurse ' : 'Nurse ') + Store.first(user);
    return html`<div className="app">
      <header className="topbar">
        <button className="icon-btn menu-toggle" aria-label="Open navigation" onClick=${() => setDrawer(true)}><${Icon} n="menu"/></button>
        <a className="brand" href="#dashboard" onClick=${(e) => { e.preventDefault(); go('dashboard'); }}><${Logo} size=${40}/><span><strong>Metro Vigan Cooperative Hospital</strong><small>Quality Care. Healthier Tomorrow.</small></span></a>
        <div className="topbar-right">
          <div className="dd" ref=${bellRef}>
            <button className="icon-btn light" aria-label=${'Notifications, ' + unread + ' unread'} aria-expanded=${bell} onClick=${() => setBell((b) => !b)}><${Icon} n="bell" size=${20}/>${unread > 0 && html`<em className="bell-badge">${unread > 9 ? '9+' : unread}</em>`}</button>
            ${bell && html`<div className="dd-pop glass notes" role="dialog" aria-label="Notifications">
              <div className="dd-h"><strong>Notifications</strong><span>${unread > 0 && html`<button className="link" onClick=${() => Store.markRead(user.id)}>Mark all read</button>`}${notes.length > 0 && html`<button className="link" onClick=${() => Store.clearNotes(user.id)}>Clear</button>`}</span></div>
              <div className="notes-list">${notes.length === 0 ? html`<p className="dd-empty">You're all caught up.</p>` : notes.slice(0, 20).map((n) => html`<button key=${n.id} className=${cx('note', !n.read && 'unread')} onClick=${() => Store.markRead(user.id, n.id)}><i></i><span>${n.text}<small>${ago(n.ts)}</small></span></button>`)}</div></div>`}
          </div>
          <div className="dd" ref=${umRef}>
            <button className="user-chip" aria-expanded=${um} onClick=${() => setUm((b) => !b)}><span className="avatar light"><${Icon} n="user" size=${18}/></span><span className="uname">${short}</span><${Icon} n="down" size=${14}/></button>
            ${um && html`<div className="dd-pop glass user-pop"><div className="dd-h col"><strong>${user.name}</strong><small>${user.title} · ${user.empId}</small></div>
              <button className="menu-item" onClick=${() => go(user.role === 'chief' ? 'settings' : 'profile')}><${Icon} n="user" size=${16}/>${user.role === 'chief' ? 'My account' : 'Profile'}</button>
              <button className="menu-item" onClick=${() => go('settings')}><${Icon} n="settings" size=${16}/>Settings</button>
              <button className="menu-item danger" onClick=${logout}><${Icon} n="logout" size=${16}/>Log out</button></div>`}
          </div>
        </div>
      </header>
      <div className=${cx('drawer-scrim', drawer && 'show')} onClick=${() => setDrawer(false)}></div>
      <aside className=${cx('sidebar glass', drawer && 'open')} aria-label="Main navigation">
        <nav>${nav.map(item)}</nav>
        <div className="side-foot">${item({ id: 'settings', label: 'Settings', icon: 'settings' })}</div>
      </aside>
      <main className="main" id="main">${children}</main>
      <${ToastHost}/><${ConfirmHost}/>
    </div>`;
  }

  /* ---------- account forms (shared) ---------- */
  // // Account forms shared by the nurse Profile page and the chief Settings page.
  function ProfileForm({ user }) {
    const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '' });
    const [err, setErr] = useState('');
    const save = (e) => { e.preventDefault(); const r = Store.updateProfile(user.id, f); if (!r.ok) return setErr(r.error); setErr(''); toast('Profile saved'); };
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
    return html`<form className="card glass pad" onSubmit=${save} noValidate>
      <h3 className="card-title">Personal details</h3>
      <div className="grid-2"><${Field} label="Full name"><input className="input" value=${f.name} onChange=${set('name')}/><//><${Field} label="Phone"><input className="input" value=${f.phone} onChange=${set('phone')} inputMode="tel"/><//></div>
      <${Field} label="Email"><input className="input" type="email" value=${f.email} onChange=${set('email')}/><//>
      ${err && html`<p className="form-err" role="alert">${err}</p>`}
      <div className="form-actions"><button className="btn btn-primary" type="submit">Save changes</button></div></form>`;
  }
  function PasswordForm({ user }) {
    const [f, setF] = useState({ cur: '', next: '', again: '' }); const [err, setErr] = useState('');
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
    const save = (e) => {
      e.preventDefault();
      if (f.next !== f.again) return setErr('The new passwords do not match.');
      const r = Store.changePassword(user.id, f.cur, f.next); if (!r.ok) return setErr(r.error);
      setErr(''); setF({ cur: '', next: '', again: '' }); toast('Password updated');
    };
    return html`<form className="card glass pad" onSubmit=${save} noValidate>
      <h3 className="card-title">Change password</h3>
      <${Field} label="Current password"><input className="input" type="password" autoComplete="current-password" value=${f.cur} onChange=${set('cur')}/><//>
      <div className="grid-2"><${Field} label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" value=${f.next} onChange=${set('next')}/><//><${Field} label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value=${f.again} onChange=${set('again')}/><//></div>
      ${err && html`<p className="form-err" role="alert">${err}</p>`}
      <div className="form-actions"><button className="btn btn-primary" type="submit">Update password</button></div></form>`;
  }

  // // Everything other scripts may use. Add new shared components to this export list.
  global.UI = { html, cx, Icon, useStore, useClickAway, useHash, toast, confirm, Modal, Field, Segmented, Toggle, Avatar, Pill, SwapPill, LeavePill, ShiftBadge, ShiftTag, Empty, PageHead, Logo, Menu, ago, download, MonthGrid, WeekStrip, Shell, ProfileForm, PasswordForm, ToastHost, ConfirmHost, DOW };
})(window);
