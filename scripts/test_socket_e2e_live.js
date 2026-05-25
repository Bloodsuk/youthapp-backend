#!/usr/bin/env node
/**
 * Real Socket.io E2E test against production with phleb + customer accounts.
 * Run: node scripts/test_socket_e2e_live.js
 */
const { io } = require('socket.io-client');

const BASE = process.env.API_BASE || 'https://prapp.youth-revisited.co.uk';
const API = `${BASE}/api/`;
const KEY = process.env.API_KEY || 'prac-youth-120982-7733774-848221';

const PHLEB = {
  email: process.env.PHLEB_EMAIL || 'systemtest18@yahoo.com',
  password: process.env.PHLEB_PASSWORD || 'systemtestwaj',
  isPleb: true,
};
const CUSTOMER = {
  email: process.env.CUSTOMER_EMAIL || 'systemtest18@yahoo.com',
  password: process.env.CUSTOMER_PASSWORD || 'waj@18',
  isPleb: false,
};
const PK = { lat: 31.3535393, lng: 73.0688578 };
const CUST = { lat: 31.353521, lng: 73.068876 };

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

function ts() {
  return new Date().toISOString().slice(11, 23);
}

(async () => {
  console.log('=== Live Socket.io E2E Test ===');
  console.log('Server:', BASE);
  console.log('Time:', new Date().toISOString());
  console.log('');

  const pl = await post(`${API}auth/login`, PHLEB);
  const cl = await post(`${API}auth/login`, CUSTOMER);
  if (!pl.json.token || !cl.json.token) {
    console.error('FAIL login', { phleb: pl.json, customer: cl.json });
    process.exit(1);
  }
  console.log(
    'PASS login — phleb id=%s (%s) customer id=%s (%s)',
    pl.json.user.id,
    pl.json.user.user_level,
    cl.json.user.id,
    cl.json.user.user_level
  );

  const jobs = await get(`${API}pleb_jobs/pleb/${pl.json.user.id}`, pl.json.token);
  const active = (jobs.json.data || []).find(
    (j) => !['Delivered', 'Cancelled'].includes(j.job_status)
  );
  if (!active) {
    console.error('FAIL no active pleb job');
    process.exit(1);
  }
  console.log(
    'PASS active job — job_id=%s order_id=%s status=%s',
    active.id,
    active.order_id,
    active.job_status
  );

  const locBefore = await get(
    `${API}pleb_jobs/live_location/${active.order_id}?customer_lat=${CUST.lat}&customer_lng=${CUST.lng}`,
    cl.json.token
  );
  console.log(
    '[REST before] HTTP %s — %s',
    locBefore.status,
    locBefore.json.success
      ? `pleb ${locBefore.json.data.pleb_lat},${locBefore.json.data.pleb_lng} dist=${locBefore.json.data.distance_text}`
      : locBefore.json.error
  );
  console.log('');

  const result = await new Promise((resolve) => {
    let customerConnected = false;
    let phlebConnected = false;
    let trackJobSent = false;
    let phlebUpdateSent = false;
    let locationUpdate = null;

    const log = (msg) => console.log(`[${ts()}] ${msg}`);

    const timeout = setTimeout(() => {
      resolve({
        ok: false,
        reason: 'timeout 20s',
        customerConnected,
        phlebConnected,
        trackJobSent,
        phlebUpdateSent,
        locationUpdate,
      });
    }, 20000);

    const cust = io(BASE, {
      auth: { token: cl.json.token },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });
    const phleb = io(BASE, {
      auth: { token: pl.json.token },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    cust.on('connect', () => {
      customerConnected = true;
      log(`CUSTOMER connected socket_id=${cust.id}`);
      cust.emit('track_job', {
        order_id: active.order_id,
        lat: CUST.lat,
        lng: CUST.lng,
      });
      trackJobSent = true;
      log(
        `CUSTOMER EMIT track_job order_id=${active.order_id} lat=${CUST.lat} lng=${CUST.lng}`
      );
    });

    cust.on('location_update', (data) => {
      if (!locationUpdate) {
        locationUpdate = data;
        log(
          `CUSTOMER RECEIVE location_update pleb=${data.pleb_lat},${data.pleb_lng} dist=${data.distance_text} (${data.distance_value}m)`
        );
      }
    });

    cust.on('tracking_ended', (data) => {
      log(`CUSTOMER RECEIVE tracking_ended ${JSON.stringify(data)}`);
    });

    cust.on('error_msg', (data) => log(`CUSTOMER error_msg ${JSON.stringify(data)}`));
    cust.on('connect_error', (e) => log(`CUSTOMER connect_error ${e.message || e}`));

    phleb.on('error_msg', (data) => log(`PHLEB error_msg ${JSON.stringify(data)}`));
    phleb.on('connect_error', (e) => log(`PHLEB connect_error ${e.message || e}`));

    // Phleb shares GPS first, then customer subscribes (correct flow).
    phleb.on('connect', () => {
      phlebConnected = true;
      log(`PHLEB connected socket_id=${phleb.id}`);
      phleb.emit('update_location', {
        job_id: active.id,
        lat: PK.lat,
        lng: PK.lng,
      });
      phlebUpdateSent = true;
      log(
        `PHLEB EMIT update_location job_id=${active.id} lat=${PK.lat} lng=${PK.lng}`
      );
      setTimeout(() => {
        log('CUSTOMER connecting after phleb GPS...');
        cust.connect();
      }, 1500);
    });

    phleb.connect();

    setTimeout(async () => {
      const locMid = await get(
        `${API}pleb_jobs/live_location/${active.order_id}?customer_lat=${CUST.lat}&customer_lng=${CUST.lng}`,
        cl.json.token
      );
      log(
        `REST mid-test HTTP ${locMid.status} — ${
          locMid.json.success
            ? `pleb ${locMid.json.data.pleb_lat},${locMid.json.data.pleb_lng} dist=${locMid.json.data.distance_text}`
            : locMid.json.error
        }`
      );

      clearTimeout(timeout);
      cust.disconnect();
      phleb.disconnect();
      resolve({
        ok: !!locationUpdate,
        customerConnected,
        phlebConnected,
        trackJobSent,
        phlebUpdateSent,
        locationUpdate,
        reason: locationUpdate ? null : 'no location_update received within 8s',
      });
    }, 8000);
  });

  console.log('');
  console.log('=== SOCKET TEST SUMMARY ===');
  console.log('Customer connected:', result.customerConnected);
  console.log('Phleb connected:', result.phlebConnected);
  console.log('track_job sent:', result.trackJobSent);
  console.log('update_location sent:', result.phlebUpdateSent);

  if (result.locationUpdate) {
    const d = result.locationUpdate;
    console.log('PASS location_update received');
    console.log('  pleb:', d.pleb_lat, d.pleb_lng);
    console.log('  distance:', d.distance_text, `(${d.distance_value} m)`);
    console.log('  ETA:', d.duration_text);
    console.log('  updated_at:', d.updated_at);
    if (d.distance_value > 100000) {
      console.log('WARN distance >100km — stale DB or address mismatch');
    } else if (d.distance_value < 500) {
      console.log('PASS distance plausible for nearby devices');
    }
  } else {
    console.log('FAIL', result.reason);
  }

  console.log('');
  console.log('[Disconnect persistence test] phleb connects 3s then disconnects...');
  await new Promise((resolve) => {
    const ph = io(BASE, {
      auth: { token: pl.json.token },
      transports: ['websocket', 'polling'],
    });
    ph.on('connect', () => {
      ph.emit('update_location', { job_id: active.id, lat: PK.lat, lng: PK.lng });
      setTimeout(async () => {
        ph.disconnect();
        await new Promise((r) => setTimeout(r, 2000));
        const loc = await get(
          `${API}pleb_jobs/live_location/${active.order_id}?customer_lat=${CUST.lat}&customer_lng=${CUST.lng}`,
          cl.json.token
        );
        if (loc.json.success) {
          console.log(
            'PASS REST after phleb disconnect — GPS retained:',
            loc.json.data.distance_text
          );
        } else {
          console.log('FAIL REST after phleb disconnect —', loc.json.error);
          console.log('  → Deploy backend fix (stop deleting GPS on disconnect)');
        }
        resolve();
      }, 3000);
    });
    ph.connect();
  });

  process.exit(result.ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
