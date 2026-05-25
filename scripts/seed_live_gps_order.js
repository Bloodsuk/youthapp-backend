#!/usr/bin/env node
/**
 * One-off: write phleb GPS for an order on production (for testing after stale UK rows).
 * Usage: ORDER_ID=20286 node scripts/seed_live_gps_order.js
 */
const { io } = require('socket.io-client');

const BASE = process.env.API_BASE || 'https://prapp.youth-revisited.co.uk';
const API = `${BASE}/api/`;
const KEY = process.env.API_KEY || 'prac-youth-120982-7733774-848221';
const ORDER_ID = Number(process.env.ORDER_ID || 20286);
const LAT = Number(process.env.LAT || 31.3535383);
const LNG = Number(process.env.LNG || 73.0688573);

const PHLEB = {
  email: process.env.PHLEB_EMAIL || 'systemtest18@yahoo.com',
  password: process.env.PHLEB_PASSWORD || 'systemtestwaj',
  isPleb: true,
};

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function get(url, token) {
  const r = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  return { status: r.status, json: await r.json() };
}

(async () => {
  const pl = await post(`${API}auth/login`, PHLEB);
  if (!pl.token) {
    console.error('Phleb login failed', pl);
    process.exit(1);
  }
  const jobsRes = await get(`${API}pleb_jobs/pleb/${pl.user.id}`, pl.token);
  const job = (jobsRes.json.data || []).find((j) => j.order_id === ORDER_ID);
  if (!job) {
    console.error(`No job for order_id=${ORDER_ID}`);
    process.exit(1);
  }

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket timeout')), 12000);
    const ph = io(BASE, {
      auth: { token: pl.token },
      transports: ['websocket', 'polling'],
    });
    ph.on('connect', () => {
      ph.emit('update_location', { job_id: job.id, lat: LAT, lng: LNG });
      setTimeout(() => {
        ph.disconnect();
        clearTimeout(t);
        resolve();
      }, 1500);
    });
    ph.on('error_msg', (e) => console.warn('error_msg', e));
  });

  const loc = await get(
    `${API}pleb_jobs/live_location/${ORDER_ID}?customer_lat=${LAT}&customer_lng=${LNG}`,
    pl.token
  );
  console.log('live_location', loc.status, JSON.stringify(loc.json, null, 2));
})();
