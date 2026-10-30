/*
 * Login page  (js/login.js)  ->  redirects to nurse.html or chief.html by role.
 */
(function () {
  'use strict';
  const { useState } = React;
  const { html, Icon, Logo, Modal, Field, Segmented, ToastHost, toast, cx, ShiftBadge } = UI;

  // // Where each role lands after signing in; already-signed-in users skip the form.
  const home = (u) => (u.role === 'chief' ? 'chief.html' : 'nurse.html');
  const existing = Store.currentUser();
  if (existing) { location.replace(home(existing)); }

  // // Demo credentials for the "Use demo account" shortcut. Remove for production.
  const DEMO = { nurse: { id: 'sarah', pw: 'nurse123', label: 'Nurse Sarah' }, chief: { id: 'chief', pw: 'chief123', label: 'Chief Nurse Ianne' } };

  // // Password reset dialog. Identity check = username/email + employee ID (demo only; use an emailed token in production).
  function Forgot({ onClose }) {
    const [f, setF] = useState({ id: '', emp: '', pw: '', pw2: '' }); const [err, setErr] = useState('');
    const set = (k) => (e) => setF(Object.assign({}, f, { [k]: e.target.value }));
    const submit = (e) => {
      e.preventDefault();
      if (f.pw !== f.pw2) return setErr('The new passwords do not match.');
      const r = Store.resetPasswordByIdentity(f.id, f.emp, f.pw);
      if (!r.ok) return setErr(r.error);
      toast('Password reset. You can log in now.'); onClose();
    };
    return html`<${Modal} title="Reset your password" onClose=${onClose} small footer=${html`<button className="btn" onClick=${onClose}>Cancel</button><button className="btn btn-primary" form="forgot" type="submit">Reset password</button>`}>
      <form id="forgot" onSubmit=${submit} noValidate>
        <p className="muted-p">Confirm your account with your employee ID (shown on your Profile page), then choose a new password.</p>
        <${Field} label="Email or username"><input className="input" value=${f.id} onChange=${set('id')} autoFocus/><//>
        <${Field} label="Employee ID"><input className="input" value=${f.emp} onChange=${set('emp')} placeholder="MVH-1001"/><//>
        <div className="grid-2"><${Field} label="New password"><input className="input" type="password" value=${f.pw} onChange=${set('pw')}/><//><${Field} label="Confirm"><input className="input" type="password" value=${f.pw2} onChange=${set('pw2')}/><//></div>
        ${err && html`<p className="form-err" role="alert">${err}</p>`}
      </form><//>`;
  }

  // // Login page. Store.login() validates the role too, so a nurse cannot open the chief portal.
  function App() {
    const [role, setRole] = useState('nurse');
    const [id, setId] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
    const [remember, setRemember] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const [forgot, setForgot] = useState(false);
    const submit = (e) => {
      e.preventDefault(); setErr('');
      const r = Store.login(id, pw, role, remember);
      if (!r.ok) return setErr(r.error);
      setBusy(true); location.href = home(r.user);
    };
    const fill = () => { setId(DEMO[role].id); setPw(DEMO[role].pw); setErr(''); };
    return html`<div className="login">
      <section className="login-hero">
        <div className="hero-brand"><${Logo} size=${44}/><span><strong>Metro Vigan Cooperative Hospital</strong><small>Quality Care. Healthier Tomorrow.</small></span></div>
        <div className="hero-copy">
          <h1>IntelliSched</h1><p className="hero-sub">Smart Schedule Generation</p>
          <ul><li>Smarter schedules.</li><li>Happier nurses.</li><li>Better patient care.</li></ul>
        </div>
        <div className="hero-foot">${role === 'chief' ? 'Chief Nurse Portal' : 'Nurse Portal'}</div>
      </section>
      <section className="login-pane">
        <form className="card glass login-card" onSubmit=${submit} noValidate>
          <${Logo} size=${52}/>
          <h2>Metro Vigan Cooperative Hospital</h2><p className="login-sub">IntelliSched Smart Schedule Generation</p>
          <${Segmented} label="Sign in as" value=${role} onChange=${(v) => { setRole(v); setErr(''); }} options=${[{ value: 'nurse', label: 'Nurse' }, { value: 'chief', label: 'Chief Nurse' }]}/>
          <${Field} label="Email or Username"><span className="input-wrap"><${Icon} n="mail" size=${16}/><input className="input" value=${id} onChange=${(e) => setId(e.target.value)} placeholder="Enter your email or username" autoComplete="username" autoFocus/></span><//>
          <${Field} label="Password"><span className="input-wrap"><${Icon} n="lock" size=${16}/><input className="input" type=${show ? 'text' : 'password'} value=${pw} onChange=${(e) => setPw(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="eye" aria-label=${show ? 'Hide password' : 'Show password'} onClick=${() => setShow(!show)}><${Icon} n=${show ? 'eye' : 'eyeOff'} size=${16}/></button></span><//>
          <div className="row-between">
            <label className="check"><input type="checkbox" checked=${remember} onChange=${(e) => setRemember(e.target.checked)}/>Remember me</label>
            <button type="button" className="link" onClick=${() => setForgot(true)}>Forgot Password?</button>
          </div>
          ${err && html`<p className="form-err" role="alert">${err}</p>`}
          <button className="btn btn-primary btn-lg" type="submit" disabled=${busy}>${busy ? 'Signing in…' : 'Log In'}</button>
          <button type="button" className="demo" onClick=${fill}><${Icon} n="key" size=${14}/>Use demo account: ${DEMO[role].label}</button>
        </form>
      </section>
      ${forgot && html`<${Forgot} onClose=${() => setForgot(false)}/>`}
      <${ToastHost}/>
    </div>`;
  }
  if (!existing) ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
})();
