import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const api = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'donor' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { onAuth(await api(`/auth/${mode}`, { method: 'POST', body: f })); }
    catch (x) { setErr(x.message); }
  };
  return (
    <main><section className="panel">
      <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
      <form onSubmit={submit}>
        {mode === 'register' && <>
          <label>Name<input value={f.name} onChange={set('name')} required /></label>
          <label>I am a
            <select value={f.role} onChange={set('role')}>
              <option value="donor">Donor (restaurant, hotel, store)</option>
              <option value="ngo">NGO or food bank</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </label></>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={8} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <p className="muted">
        {mode === 'login' ? 'New here? ' : 'Already registered? '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </a>
      </p>
    </section></main>
  );
}

function DonationForm({ token, onDone }) {
  const [f, setF] = useState({ foodName: '', quantity: 10, address: '', pickupFrom: '', pickupUntil: '', expiresAt: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/donations', { method: 'POST', token, body: { ...f, quantity: +f.quantity } }); onDone(); setErr(''); }
    catch (x) { setErr(x.message); }
  };
  return (
    <section className="panel">
      <h2>List surplus food</h2>
      <form onSubmit={submit}>
        <label>Food<input value={f.foodName} onChange={set('foodName')} required /></label>
        <label>Servings<input type="number" min="1" value={f.quantity} onChange={set('quantity')} required /></label>
        <label>Pickup address<input value={f.address} onChange={set('address')} /></label>
        <label>Pickup from<input type="datetime-local" value={f.pickupFrom} onChange={set('pickupFrom')} required /></label>
        <label>Pickup until<input type="datetime-local" value={f.pickupUntil} onChange={set('pickupUntil')} required /></label>
        <label>Food expires<input type="datetime-local" value={f.expiresAt} onChange={set('expiresAt')} required /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button>Publish donation</button>
      </form>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('fb') || 'null'));
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');
  const token = session?.token;
  const role = session?.user.role;

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems(role === 'volunteer' ? await api('/pickups/open', { token }) : await api('/donations', { token })); }
    catch { /* token expired etc. */ }
  }, [token, role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const s = io('/', { auth: { token } });
    const ping = (msg) => (p) => { setToast(typeof msg === 'function' ? msg(p) : msg); load(); setTimeout(() => setToast(''), 4000); };
    s.on('donation:new', ping((d) => `New donation: ${d.food_name}`));
    s.on('donation:claimed', ping('An NGO claimed your donation'));
    s.on('pickup:open', ping('A pickup needs a volunteer'));
    s.on('pickup:assigned', ping('A volunteer accepted your pickup'));
    return () => s.close();
  }, [token, load]);

  const auth = (s) => { localStorage.setItem('fb', JSON.stringify(s)); setSession(s); };
  const logout = () => { localStorage.removeItem('fb'); setSession(null); setItems([]); };
  const act = (path) => async () => { try { await api(path, { method: 'POST', token }); load(); } catch (e) { setToast(e.message); } };

  if (!session) return <><header><h1>FoodBridge</h1></header><AuthForm onAuth={auth} /></>;

  return (
    <>
      <header>
        <h1>FoodBridge</h1>
        <span>{session.user.name} ({role})<button className="ghost" onClick={logout}>Log out</button></span>
      </header>
      <main>
        {role === 'donor' && <DonationForm token={token} onDone={load} />}
        <section className="panel">
          <h2>{role === 'volunteer' ? 'Pickups waiting for a driver' : 'Food available now'}</h2>
          {items.length === 0 && <p className="muted">Nothing here yet.</p>}
          {items.map((i) => (
            <div className="item" key={i.id}>
              <div>
                <strong>{i.food_name}</strong> · {i.quantity} servings
                <div className="muted">{i.address || 'No address given'}{i.donor_name && ` · from ${i.donor_name}`}</div>
              </div>
              {role === 'ngo' && <button onClick={act(`/donations/${i.id}/claim`)}>Claim</button>}
              {role === 'volunteer' && <button onClick={act(`/pickups/${i.id}/accept`)}>Accept pickup</button>}
            </div>
          ))}
        </section>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
