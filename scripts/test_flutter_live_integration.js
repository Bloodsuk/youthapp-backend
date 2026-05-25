#!/usr/bin/env node
/**
 * Mirrors Flutter Urls + tracking integration against live API.
 * Run: node scripts/test_flutter_live_integration.js
 */
const { io } = require('socket.io-client');

const BASE = 'https://prapp.youth-revisited.co.uk';
const API = `${BASE}/api/`;
const KEY = 'prac-youth-120982-7733774-848221';

const PHLEB = { email: 'systemtest18@yahoo.com', password: 'systemtestwaj', isPleb: true };
const CUSTOMER = { email: 'systemtest18@yahoo.com', password: 'waj@18', isPleb: false };

const paths = {
  login: `${API}auth/login`,
  plebJobs: (plebId) => `${API}pleb_jobs/pleb/${plebId}`,
  liveLocation: (orderId) => `${API}pleb_jobs/live_location/${orderId}`,
};

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}

async function get(url, token) {
  const r = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: r.status, json };
}

function flutterHttpOk(httpStatus, body) {
  return httpStatus >= 200 && httpStatus < 300;
}

function apiOk(body) {
  if (!body || typeof body !== 'object') return false;
  if (!('success' in body)) return true;
  return body.success === true;
}

function apiData(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data;
  }
  return null;
}

(async () => {
  console.log('Flutter integration test (live)');
  console.log('API root:', API);
  console.log('Socket:', BASE);
  console.log('');

  const pl = await post(paths.login, PHLEB);
  const cl = await post(paths.login, CUSTOMER);
  if (!pl.json.token || !cl.json.token) {
    console.error('Login failed', pl.json, cl.json);
    process.exit(1);
  }
  console.log('PASS login — phleb', pl.json.user.id, 'customer', cl.json.user.id);

  const jobsRes = await get(paths.plebJobs(pl.json.user.id), pl.json.token);
  const jobs = jobsRes.json.data || [];
  const active = jobs.find((j) => !['Delivered', 'Cancelled'].includes(j.job_status));
  if (!active) {
    console.error('FAIL no active job');
    process.exit(1);
  }
  console.log('PASS pleb jobs — job', active.id, 'order', active.order_id, active.job_status);

  const locBefore = await get(paths.liveLocation(active.order_id), cl.json.token);
  const httpOk = flutterHttpOk(locBefore.status, locBefore.json);
  const beforeOk = httpOk && apiOk(locBefore.json);
  console.log(
    beforeOk ? 'PASS' : 'INFO',
    'live_location before GPS —',
    beforeOk ? 'has data' : locBefore.json.error || locBefore.status
  );

  const socketResult = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, err: 'timeout' }), 15000);
    const cust = io(BASE, {
      auth: { token: cl.json.token },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });
    const phleb = io(BASE, {
      auth: { token: pl.json.token },
      transports: ['websocket', 'polling'],
    });
    cust.on('connect', () => {
      cust.emit('track_job', {
        order_id: active.order_id,
        lat: 31.353518,
        lng: 73.068826,
      });
    });
    phleb.on('connect', () => {
      // Near typical device GPS in PK — do not write UK test coords to production DB.
      phleb.emit('update_location', {
        job_id: active.id,
        lat: 31.3535383,
        lng: 73.0688573,
      });
    });
    cust.on('location_update', (d) => {
      clearTimeout(t);
      resolve({ ok: true, d });
    });
    cust.on('connect_error', (e) => {
      clearTimeout(t);
      resolve({ ok: false, err: e.message });
    });
    cust.connect();
    phleb.connect();
  });

  if (!socketResult.ok) {
    console.error('FAIL socket', socketResult);
    process.exit(1);
  }
  console.log('PASS socket track_job + update_location —', socketResult.d.distance_text);

  const locAfter = await get(paths.liveLocation(active.order_id), cl.json.token);
  if (!flutterHttpOk(locAfter.status, locAfter.json) || !apiOk(locAfter.json)) {
    console.error('FAIL live_location after', locAfter);
    process.exit(1);
  }
  const data = apiData(locAfter.json);
  console.log('PASS live_location after —', data.pleb_lat, data.pleb_lng, data.distance_text);

  console.log('');
  console.log('ALL FLUTTER-MIRRORED TESTS PASSED');
  console.log('Use order_id', active.order_id, 'in PhlebTrackingScreen');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
