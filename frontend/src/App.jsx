import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

/* ── Fix Leaflet default marker icons (Vite doesn't resolve them automatically) ── */
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const VOLUNTEER_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const FOOD_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

/* ── API helper ── */
const api = async (path, { method = 'GET', body, token, isFormData } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isFormData ? body : body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};

/* ── WebPush VAPID base64 converter ── */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* ================================================================
   PUSH & SMS NOTIFICATION BANNER
   ================================================================ */
function NotificationManager({ token, onToast }) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setSubscribed(true);
    }
  }, []);

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      onToast('⚠️ Push notifications are not supported in this browser environment');
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        onToast('⚠️ Notification permission was denied');
        setLoading(false);
        return;
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID key
      const { publicKey } = await api('/notifications/vapid-public-key');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Save to backend
      await api('/notifications/subscribe', { method: 'POST', token, body: { subscription: sub } });
      setSubscribed(true);
      onToast('🔔 WebPush alerts enabled successfully!');
    } catch (err) {
      console.error(err);
      onToast(`Failed to enable push: ${err.message}`);
    }
    setLoading(false);
  };

  const testPush = async () => {
    try {
      await api('/notifications/test-push', { method: 'POST', token });
      onToast('📨 Test push sent! Check your notification center.');
    } catch (err) { onToast(err.message); }
  };

  const testSms = async () => {
    try {
      const phone = prompt('Enter recipient phone number for SMS test:');
      if (!phone) return;
      const res = await api('/notifications/test-sms', { method: 'POST', token, body: { phone } });
      onToast(`📱 ${res.message}`);
    } catch (err) { onToast(err.message); }
  };

  return (
    <div className="push-banner">
      <div className="push-banner-content">
        <span>🔔 <strong>Real-Time Alerts:</strong> {subscribed ? 'Active' : 'Get immediate volunteer & donation alerts'}</span>
      </div>
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
        {!subscribed ? (
          <button className="btn-green btn-sm" onClick={enablePush} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable WebPush'}
          </button>
        ) : (
          <button className="btn-outline btn-sm" onClick={testPush}>Test Push</button>
        )}
        <button className="btn-outline btn-sm" onClick={testSms}>Test SMS</button>
      </div>
    </div>
  );
}

/* ================================================================
   AUTH PAGE
   ================================================================ */
function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'donor', phone: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { onAuth(await api(`/auth/${mode}`, { method: 'POST', body: f })); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth-page">
      <div className="logo">🍽️ FoodBridge</div>
      <p className="tagline">Connecting surplus food with people who need it</p>
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <form onSubmit={submit}>
          {mode === 'register' && <>
            <label>Full name<input value={f.name} onChange={set('name')} required placeholder="Your name" /></label>
            <label>Phone (for SMS dispatch alerts)
              <input type="tel" value={f.phone} onChange={set('phone')} placeholder="+1 555 123 4567" />
            </label>
            <label>I am a
              <select value={f.role} onChange={set('role')}>
                <option value="donor">Donor (restaurant, hotel, store)</option>
                <option value="ngo">NGO or food bank</option>
                <option value="volunteer">Delivery volunteer</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </>}
          <label>Email<input type="email" value={f.email} onChange={set('email')} required placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={8} placeholder="Min 8 characters" /></label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn-primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p className="muted text-center" style={{ marginTop: '1rem' }}>
          {mode === 'login' ? 'New here? ' : 'Already registered? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}
             style={{ color: 'var(--green)', fontWeight: 600 }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </a>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   LOCATION PICKER MAP (click-to-set lat/lng)
   ================================================================ */
function LocationPicker({ lat, lng, onPick }) {
  function ClickHandler() {
    useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
    return null;
  }
  const center = lat && lng ? [lat, lng] : [19.076, 72.8777]; // default: Mumbai
  return (
    <div className="map-container" style={{ height: 220 }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <ClickHandler />
        {lat && lng && <Marker position={[lat, lng]} icon={FOOD_ICON}><Popup>Pickup location</Popup></Marker>}
      </MapContainer>
    </div>
  );
}

/* ================================================================
   DONATIONS MAP (all listings)
   ================================================================ */
function DonationsMap({ items }) {
  const mapped = items.filter(i => i.lat && i.lng);
  if (mapped.length === 0) return null;
  const center = [mapped[0].lat, mapped[0].lng];
  return (
    <div className="panel">
      <h2>📍 Food near you</h2>
      <div className="map-container">
        <MapContainer center={center} zoom={12} scrollWheelZoom={true}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          {mapped.map(i => (
            <Marker key={i.id} position={[i.lat, i.lng]} icon={FOOD_ICON}>
              <Popup>
                <strong>{i.food_name}</strong><br />
                {i.quantity} servings<br />
                <span style={{ color: '#666' }}>{i.address || 'No address'}</span>
                {i.freshness_score && <><br /><span style={{ color: 'var(--green)' }}>Freshness: {i.freshness_score}/100</span></>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

/* ================================================================
   TRACKING MAP (with OSRM Turn-by-Turn Polyline Route)
   ================================================================ */
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

function TrackingMap({ pickupLat, pickupLng, volunteerLat, volunteerLng, pickupAddress, polyline }) {
  const center = volunteerLat ? [volunteerLat, volunteerLng] : pickupLat ? [pickupLat, pickupLng] : [19.076, 72.8777];
  return (
    <div className="map-container" style={{ height: 320 }}>
      <MapContainer center={center} zoom={14} scrollWheelZoom={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <RecenterMap lat={volunteerLat || pickupLat} lng={volunteerLng || pickupLng} />

        {/* OSRM Route Polyline */}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} color="#1b8a52" weight={6} opacity={0.85} dashArray="2, 6" />
        )}

        {pickupLat && pickupLng && (
          <Marker position={[pickupLat, pickupLng]} icon={FOOD_ICON}>
            <Popup>📦 Pickup Destination: {pickupAddress || 'Location'}</Popup>
          </Marker>
        )}
        {volunteerLat && volunteerLng && (
          <Marker position={[volunteerLat, volunteerLng]} icon={VOLUNTEER_ICON}>
            <Popup>🚴 Courier / Volunteer Position</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

/* ================================================================
   AI FRESHNESS SCORE DISPLAY
   ================================================================ */
function FreshnessGauge({ score, label, model, recommendation, confidence }) {
  if (score == null) return null;
  const cls = label?.toLowerCase() || (score >= 85 ? 'fresh' : score >= 65 ? 'good' : score >= 45 ? 'okay' : 'wilted');
  return (
    <div style={{ display: 'grid', gap: '.4rem' }}>
      <div className="freshness-gauge">
        <div className={`freshness-ring ${cls}`}>{Math.round(score)}</div>
        <div className="freshness-info">
          <strong>{label || cls} ({score}/100)</strong>
          <span>{model || 'MobileNetV2 FoodVision'}{confidence ? ` · ${Math.round(confidence * 100)}% conf` : ''}</span>
        </div>
      </div>
      {recommendation && (
        <div style={{ fontSize: '.78rem', color: 'var(--slate-mid)', background: 'var(--bg)', padding: '.3rem .6rem', borderRadius: '4px', border: '1px solid var(--line-light)' }}>
          💡 {recommendation}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   DONATION FORM (with location picker + image upload)
   ================================================================ */
function DonationForm({ token, onDone }) {
  const [f, setF] = useState({ foodName: '', quantity: 10, address: '', pickupFrom: '', pickupUntil: '', expiresAt: '', lat: null, lng: null });
  const [err, setErr] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef();

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickLocation = (lat, lng) => setF({ ...f, lat, lng });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFreshness(null);
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const result = await api('/freshness/analyze', { method: 'POST', token, body: fd, isFormData: true });
      setFreshness(result);
    } catch (e) { setErr(e.message); }
    setAnalyzing(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const listing = await api('/donations', { method: 'POST', token, body: { ...f, quantity: +f.quantity } });
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        fd.append('listingId', listing.id);
        await api('/freshness/analyze', { method: 'POST', token, body: fd, isFormData: true });
      }
      onDone();
      setF({ foodName: '', quantity: 10, address: '', pickupFrom: '', pickupUntil: '', expiresAt: '', lat: null, lng: null });
      setImageFile(null); setImagePreview(null); setFreshness(null);
      setErr('');
    } catch (x) { setErr(x.message); }
  };

  return (
    <section className="panel">
      <h2>🍱 List surplus food</h2>
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Food name<input value={f.foodName} onChange={set('foodName')} required placeholder="e.g. Vegetable Biryani" /></label>
          <label>Servings<input type="number" min="1" value={f.quantity} onChange={set('quantity')} required /></label>
        </div>
        <label>Pickup address<input value={f.address} onChange={set('address')} placeholder="Building, street, area" /></label>
        <div className="location-hint">📍 Click the map to set the exact pickup location</div>
        <LocationPicker lat={f.lat} lng={f.lng} onPick={pickLocation} />
        {f.lat && <p className="muted" style={{ marginTop: '.25rem' }}>📌 {f.lat.toFixed(5)}, {f.lng.toFixed(5)}</p>}
        <div className="form-row">
          <label>Pickup from<input type="datetime-local" value={f.pickupFrom} onChange={set('pickupFrom')} required /></label>
          <label>Pickup until<input type="datetime-local" value={f.pickupUntil} onChange={set('pickupUntil')} required /></label>
        </div>
        <label>Food expires<input type="datetime-local" value={f.expiresAt} onChange={set('expiresAt')} required /></label>

        {/* Image upload for freshness */}
        <div className={`upload-area ${imageFile ? 'has-file' : ''}`} onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} accept="image/*" onChange={handleImageChange} />
          {imagePreview ? (
            <img src={imagePreview} alt="Food preview" className="upload-preview" />
          ) : (
            <><div className="upload-icon">📸</div><p>Upload photo for MobileNet AI Freshness evaluation</p></>
          )}
        </div>
        {imageFile && !freshness && (
          <button type="button" className="btn-blue btn-sm" onClick={analyzeImage} disabled={analyzing}>
            {analyzing ? '🔬 MobileNet Analyzing...' : '🧠 Run MobileNet AI Freshness'}
          </button>
        )}
        {freshness && (
          <FreshnessGauge
            score={freshness.score}
            label={freshness.label}
            model={freshness.model}
            recommendation={freshness.recommendation}
            confidence={freshness.confidence}
          />
        )}

        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn-primary">Publish donation</button>
      </form>
    </section>
  );
}

/* ================================================================
   VOLUNTEER TRACKING & OSRM TURN-BY-TURN PANEL
   ================================================================ */
function VolunteerTrackingPanel({ token, socket }) {
  const [active, setActive] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const loadActive = useCallback(async () => {
    try { setActive(await api('/pickups/my-active', { token })); } catch {}
  }, [token]);

  useEffect(() => { loadActive(); }, [loadActive]);

  // Load OSRM optimal route
  const loadRoute = useCallback(async (pickupId) => {
    setLoadingRoute(true);
    try {
      const data = await api(`/tracking/${pickupId}/route`, { token });
      setRouteInfo(data);
    } catch (e) {
      console.warn('Could not load route:', e);
    }
    setLoadingRoute(false);
  }, [token]);

  // Listen for real-time tracking updates
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.pickupId === selectedPickup) {
        setTrackingInfo(prev => ({ ...prev, lat: data.lat, lng: data.lng }));
        loadRoute(data.pickupId);
      }
    };
    socket.on('tracking:location', handler);
    return () => socket.off('tracking:location', handler);
  }, [socket, selectedPickup, loadRoute]);

  const sendLocation = async (pickupId) => {
    setSending(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
      await api(`/tracking/${pickupId}/location`, {
        method: 'POST', token,
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
      loadRoute(pickupId);
    } catch (e) { console.error('Location error:', e); }
    setSending(false);
  };

  const confirmDelivery = async (pickupId) => {
    const note = prompt('Any delivery notes? (optional)');
    try {
      await api(`/tracking/${pickupId}/confirm-delivery`, { method: 'POST', token, body: { note } });
      loadActive();
    } catch (e) { alert(e.message); }
  };

  const advanceStatus = async (pickupId) => {
    try { await api(`/pickups/${pickupId}/advance`, { method: 'PATCH', token }); loadActive(); }
    catch (e) { alert(e.message); }
  };

  const loadTracking = async (pickupId) => {
    setSelectedPickup(pickupId);
    try {
      const loc = await api(`/tracking/${pickupId}/location`, { token });
      setTrackingInfo(loc);
      loadRoute(pickupId);
    } catch {
      setTrackingInfo(null);
    }
  };

  const STEPS = ['pending', 'assigned', 'in_transit', 'delivered'];
  const stepLabels = { pending: '📋 Claimed', assigned: '✋ Accepted', in_transit: '🚴 In Transit', delivered: '✅ Delivered' };

  return (
    <div>
      <section className="panel" style={{ marginBottom: '1.25rem' }}>
        <h2>🚚 My Active Deliveries</h2>
        {active.length === 0 && <div className="empty-state"><div className="empty-icon">📦</div><p>No active deliveries. Accept a pickup first!</p></div>}
        {active.map(a => {
          const idx = STEPS.indexOf(a.status);
          return (
            <div className="item-card" key={a.id}>
              <div className="item-info">
                <strong>{a.food_name}</strong>
                <div className="item-meta">{a.quantity} servings · {a.address || 'No address'}</div>
                <div className="item-meta">From {a.donor_name} → {a.ngo_name}</div>
                <div className="status-steps" style={{ marginTop: '.5rem' }}>
                  {STEPS.map((s, i) => (
                    <div key={s} className={`status-step ${i < idx ? 'reached' : ''} ${i === idx ? 'current' : ''}`}>
                      {stepLabels[s]}
                    </div>
                  ))}
                </div>
              </div>
              <div className="item-actions" style={{ flexDirection: 'column', gap: '.35rem' }}>
                <button className="btn-blue btn-sm" onClick={() => sendLocation(a.id)} disabled={sending}>
                  {sending ? '📡...' : '📡 Send GPS'}
                </button>
                {a.status === 'assigned' && (
                  <button className="btn-green btn-sm" onClick={() => advanceStatus(a.id)}>🚴 Start Transit</button>
                )}
                {a.status === 'in_transit' && (
                  <button className="btn-green btn-sm" onClick={() => confirmDelivery(a.id)}>✅ Delivered</button>
                )}
                <button className="btn-outline btn-sm" onClick={() => loadTracking(a.id)}>🗺️ OSRM Route</button>
              </div>
            </div>
          );
        })}
      </section>

      {selectedPickup && trackingInfo && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
            <h2>🗺️ OSRM Turn-by-Turn Navigation</h2>
            <button className="btn-outline btn-sm" onClick={() => loadRoute(selectedPickup)} disabled={loadingRoute}>
              {loadingRoute ? 'Calculating...' : '🔄 Refresh Route'}
            </button>
          </div>

          <TrackingMap
            pickupLat={trackingInfo.pickup_lat}
            pickupLng={trackingInfo.pickup_lng}
            volunteerLat={trackingInfo.lat}
            volunteerLng={trackingInfo.lng}
            pickupAddress={trackingInfo.pickup_address}
            polyline={routeInfo?.polyline}
          />

          {/* OSRM Route Summary */}
          {routeInfo && (
            <div>
              <div className="route-summary">
                <div className="route-metric">
                  <strong>{routeInfo.distanceKm} km</strong>
                  <span>Distance</span>
                </div>
                <div className="route-metric">
                  <strong>~{routeInfo.durationMin} min</strong>
                  <span>Est. Time</span>
                </div>
                <div>
                  <span className="badge badge-green">🚀 {routeInfo.source} Waypoints</span>
                </div>
              </div>

              {/* Turn-by-turn maneuvers */}
              {routeInfo.steps && routeInfo.steps.length > 0 && (
                <div className="route-steps-container">
                  {routeInfo.steps.map((st, i) => (
                    <div key={i} className="route-step-item">
                      <div className="route-step-icon">
                        {st.type === 'arrive' ? '🏁' : st.modifier?.includes('left') ? '⬅️' : st.modifier?.includes('right') ? '➡️' : '⬆️'}
                      </div>
                      <div className="route-step-info">
                        <strong>{st.instruction}</strong>
                      </div>
                      <div className="route-step-dist">{st.distanceMeters}m</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '.75rem' }}>
            <span className="badge badge-blue">{trackingInfo.status}</span>
            <span className="muted" style={{ marginLeft: '.5rem' }}>
              Volunteer: {trackingInfo.volunteer_name}
              {trackingInfo.location_updated_at && ` · Last update: ${new Date(trackingInfo.location_updated_at).toLocaleTimeString()}`}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

/* ================================================================
   ADMIN PANEL
   ================================================================ */
function AdminPanel({ token }) {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);

  const loadPending = useCallback(async () => {
    try { setPending(await api('/admin/users/pending', { token })); } catch {}
  }, [token]);
  const loadUsers = useCallback(async () => {
    try { setAllUsers(await api('/admin/users', { token })); } catch {}
  }, [token]);
  const loadStats = useCallback(async () => {
    try { setStats(await api('/admin/stats', { token })); } catch {}
  }, [token]);

  useEffect(() => { loadPending(); loadStats(); }, [loadPending, loadStats]);

  const verify = async (id) => {
    await api(`/admin/users/${id}/verify`, { method: 'POST', token });
    loadPending(); loadUsers(); loadStats();
  };
  const reject = async (id) => {
    const reason = prompt('Reason for rejection (optional):');
    await api(`/admin/users/${id}/reject`, { method: 'POST', token, body: { reason } });
    loadPending();
  };

  return (
    <div>
      {/* Stats */}
      {stats && (
        <section className="panel" style={{ marginBottom: '1.25rem' }}>
          <h2>📊 Platform Analytics</h2>
          <div className="stats-grid">
            {stats.usersByRole.map(r => (
              <div className="stat-card" key={r.role}>
                <div className="stat-value">{r.count}</div>
                <div className="stat-label">{r.role}s</div>
              </div>
            ))}
            <div className="stat-card">
              <div className="stat-value">{stats.listings.total || 0}</div>
              <div className="stat-label">Total Listings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.listings.delivered || 0}</div>
              <div className="stat-label">Delivered</div>
            </div>
          </div>
          {stats.pickupsByStatus.length > 0 && (
            <div>
              <h3>Pickup Status Breakdown</h3>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                {stats.pickupsByStatus.map(p => (
                  <span key={p.status} className={`badge ${p.status === 'delivered' ? 'badge-green' : 'badge-orange'}`}>
                    {p.status}: {p.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tabs */}
      <div className="nav-tabs" style={{ background: 'transparent', borderBottom: 'none', padding: 0, marginBottom: '.75rem' }}>
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          ⏳ Pending Verification ({pending.length})
        </button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => { setTab('all'); loadUsers(); }}>
          👥 All Users
        </button>
      </div>

      {tab === 'pending' && (
        <section className="panel">
          <h2>⏳ Users awaiting verification</h2>
          {pending.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div><p>All caught up! No pending verifications.</p></div>}
          {pending.map(u => (
            <div className="item-card" key={u.id}>
              <div className="item-info">
                <strong>{u.name}</strong>
                <div className="item-meta">{u.email} · <span className="badge badge-blue">{u.role}</span></div>
                <div className="item-meta">Registered {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="item-actions">
                <button className="btn-green btn-sm" onClick={() => verify(u.id)}>✓ Approve</button>
                <button className="btn-red btn-sm" onClick={() => reject(u.id)}>✗ Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'all' && (
        <section className="panel">
          <h2>👥 All Users</h2>
          <table className="user-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Joined</th></tr></thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-blue">{u.role}</span></td>
                  <td>{u.is_verified ? <span className="badge badge-green">✓ Verified</span> : <span className="badge badge-orange">Pending</span>}</td>
                  <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/* ================================================================
   MAIN APP
   ================================================================ */
export default function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('fb') || 'null'));
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('listings');
  const [socketRef, setSocketRef] = useState(null);
  const token = session?.token;
  const role = session?.user.role;

  // Set default tab based on role
  useEffect(() => {
    if (role === 'admin') setActiveTab('admin');
    else if (role === 'volunteer') setActiveTab('pickups');
    else setActiveTab('listings');
  }, [role]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems(role === 'volunteer' ? await api('/pickups/open', { token }) : await api('/donations', { token })); }
    catch { /* token expired etc. */ }
  }, [token, role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const s = io('/', { auth: { token } });
    setSocketRef(s);
    const ping = (msg) => (p) => { setToast(typeof msg === 'function' ? msg(p) : msg); load(); setTimeout(() => setToast(''), 4000); };
    s.on('donation:new', ping((d) => `🍽️ New donation: ${d.food_name}`));
    s.on('donation:claimed', ping('✅ An NGO claimed your donation'));
    s.on('pickup:open', ping('📦 A pickup needs a volunteer'));
    s.on('pickup:assigned', ping('🚴 A volunteer accepted your pickup'));
    s.on('delivery:confirmed', ping('✅ Delivery confirmed!'));
    s.on('pickup:status', () => { load(); });
    s.on('tracking:location', () => {});
    s.on('account:verified', ping('🎉 Your account has been verified!'));
    return () => { s.close(); setSocketRef(null); };
  }, [token, load]);

  const auth = (s) => { localStorage.setItem('fb', JSON.stringify(s)); setSession(s); };
  const logout = () => { localStorage.removeItem('fb'); setSession(null); setItems([]); };
  const act = (path, method = 'POST') => async () => {
    try { await api(path, { method, token }); load(); }
    catch (e) { setToast(e.message); setTimeout(() => setToast(''), 4000); }
  };

  if (!session) return <AuthForm onAuth={auth} />;

  const tabs = [];
  if (role === 'donor') tabs.push({ id: 'listings', icon: '🍱', label: 'My Listings' }, { id: 'map', icon: '🗺️', label: 'Map' });
  if (role === 'ngo') tabs.push({ id: 'listings', icon: '🍽️', label: 'Available Food' }, { id: 'map', icon: '🗺️', label: 'Map' });
  if (role === 'volunteer') tabs.push({ id: 'pickups', icon: '📦', label: 'Open Pickups' }, { id: 'tracking', icon: '🚚', label: 'My Deliveries' }, { id: 'map', icon: '🗺️', label: 'Map' });
  if (role === 'admin') tabs.push({ id: 'admin', icon: '🛡️', label: 'Admin Panel' });

  return (
    <>
      <header>
        <h1><span className="emoji">🍽️</span>FoodBridge</h1>
        <div className="header-right">
          <span className="user-badge">{session.user.name} · {role}</span>
          <button className="btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <nav className="nav-tabs">
        {tabs.map(t => (
          <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => setActiveTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <main>
        {/* Push Notification Manager for all logged in users */}
        <NotificationManager token={token} onToast={(m) => { setToast(m); setTimeout(() => setToast(''), 4500); }} />

        {/* DONOR: New listing form */}
        {role === 'donor' && activeTab === 'listings' && <DonationForm token={token} onDone={load} />}

        {/* LISTINGS (donor & NGO) */}
        {(activeTab === 'listings' && role !== 'volunteer') && (
          <section className="panel">
            <h2>{role === 'donor' ? '📋 Your active listings' : '🍽️ Food available now'}</h2>
            {items.length === 0 && <div className="empty-state"><div className="empty-icon">🍃</div><p>Nothing here yet.</p></div>}
            {items.map((i) => (
              <div className="item-card" key={i.id}>
                <div className="item-info">
                  <strong>{i.food_name}</strong>
                  <div className="item-meta">
                    {i.quantity} servings · {i.address || 'No address given'}
                    {i.donor_name && ` · from ${i.donor_name}`}
                  </div>
                  {i.freshness_score && (
                    <div style={{ marginTop: '.35rem' }}>
                      <FreshnessGauge score={i.freshness_score} label={i.freshness_label} />
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  {role === 'ngo' && <button className="btn-primary btn-sm" onClick={act(`/donations/${i.id}/claim`)}>Claim</button>}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* VOLUNTEER: Open pickups */}
        {activeTab === 'pickups' && role === 'volunteer' && (
          <section className="panel">
            <h2>📦 Pickups waiting for a driver</h2>
            {items.length === 0 && <div className="empty-state"><div className="empty-icon">✨</div><p>No open pickups right now.</p></div>}
            {items.map((i) => (
              <div className="item-card" key={i.id}>
                <div className="item-info">
                  <strong>{i.food_name}</strong>
                  <div className="item-meta">{i.quantity} servings · {i.address || 'No address'}{i.ngo_name && ` · for ${i.ngo_name}`}</div>
                </div>
                <div className="item-actions">
                  <button className="btn-green btn-sm" onClick={act(`/pickups/${i.id}/accept`)}>Accept pickup</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* VOLUNTEER: Tracking & Turn-by-Turn Routing panel */}
        {activeTab === 'tracking' && role === 'volunteer' && (
          <VolunteerTrackingPanel token={token} socket={socketRef} />
        )}

        {/* MAP tab (all roles except admin) */}
        {activeTab === 'map' && role !== 'admin' && (
          <DonationsMap items={items} />
        )}

        {/* ADMIN PANEL */}
        {activeTab === 'admin' && role === 'admin' && (
          <AdminPanel token={token} />
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
