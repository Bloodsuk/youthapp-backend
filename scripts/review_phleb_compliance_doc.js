#!/usr/bin/env node
/**
 * Admin: approve or reject a phleb compliance upload (also updates npn_phleb_signoffs).
 *
 * Usage:
 *   DOCUMENT_ID=1 ACTION=approved node scripts/review_phleb_compliance_doc.js
 *   DOCUMENT_ID=1 ACTION=rejected NOTES="Please re-upload clearer scan" node scripts/review_phleb_compliance_doc.js
 *
 * Requires ADMIN_EMAIL and ADMIN_PASSWORD env vars (or edit below).
 */
const http = require('http');

const BASE = process.env.API_BASE || 'http://127.0.0.1:7020';
const API_KEY = process.env.API_KEY || 'prac-youth-120982-7733774-848221';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@youth-revisited.co.uk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DOCUMENT_ID = Number(process.env.DOCUMENT_ID);
const ACTION = process.env.ACTION || 'approved';
const NOTES = process.env.NOTES || '';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 7020,
        path,
        method,
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  if (!DOCUMENT_ID) {
    console.error('Set DOCUMENT_ID');
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    console.error('Set ADMIN_PASSWORD');
    process.exit(1);
  }

  const login = await req('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const loginJson = JSON.parse(login.body);
  const token = loginJson.token || loginJson.data?.token;
  if (!token) {
    console.error('Admin login failed:', login.body);
    process.exit(1);
  }

  const review = await req(
    'PATCH',
    `/api/phlebotomists/compliance/documents/${DOCUMENT_ID}/review`,
    { status: ACTION, notes: NOTES || undefined },
    token
  );
  console.log(review.status, review.body);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
