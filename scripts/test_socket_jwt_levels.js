#!/usr/bin/env node
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'https://endearing-disposal-chivalry.ngrok-free.dev';
const API = `${BASE}/api/`;
const KEY = process.env.API_KEY || 'prac-youth-120982-7733774-848221';

const secret = fs
  .readFileSync(path.join(__dirname, '../env/live.env'), 'utf8')
  .match(/JWT_SECRET=(.+)/)?.[1]
  ?.trim();

async function socketEvents(token, label) {
  const events = [];
  await new Promise((resolve) => {
    const s = io(BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    s.on('tracking_auth_ok', (d) => events.push(`tracking_auth_ok:${d.role}`));
    s.on('error_msg', () => events.push('error_msg'));
    s.on('disconnect', (r) => events.push(`disconnect:${r}`));
    s.on('connect_error', (e) => events.push(`connect_error:${e.message}`));
    setTimeout(() => {
      s.disconnect();
      resolve();
    }, 2500);
    s.connect();
  });
  console.log(`${label}: ${events.join(' | ')}`);
}

(async () => {
  const oldToken = jwt.sign(
    { id: 1267, email: 'systemtest18@yahoo.com' },
    secret
  );
  await socketEvents(oldToken, 'JWT missing user_level (stale phleb app)');

  const r = await fetch(`${API}auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify({
      email: 'systemtest18@yahoo.com',
      password: 'systemtestwaj',
      isPleb: true,
    }),
  });
  const good = (await r.json()).token;
  await socketEvents(good, 'Fresh Sign in as Phleb token');
})();
