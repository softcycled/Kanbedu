// Portable benchmark script for task endpoints
// Usage: node C:\Users\homin\bench-tasks.mjs
// Env vars: BASE (default http://localhost:3000), BOARD_ID (default demo-board-seed-0001), RUNS, PATCH_RUNS, DELAY_MS

const BASE = process.env.BASE || "http://localhost:3000";
const BOARD_ID = process.env.BOARD_ID || "demo-board-seed-0001";
const RUNS = Number(process.env.RUNS || 20);
const PATCH_RUNS = Number(process.env.PATCH_RUNS || 10);
const DELAY_MS = Number(process.env.DELAY_MS || 100);
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'alice@demo.kanbedu';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'demo1234';

function wait(ms){ return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(){
  process.stdout.write(`Waiting for server ${BASE} `);
  for (let i=0;i<120;i++){
    try {
      // Check a public route (login) to avoid middleware redirects
      const res = await fetch(`${BASE}/api/auth/login`, { method: 'OPTIONS' });
      // OPTIONS may be rejected, but if the server responds at all, assume ready
      if (res) { console.log('\nServer ready'); return; }
    } catch (e) {}
    process.stdout.write('.');
    await wait(1000);
  }
  throw new Error('Server did not become ready');
}

async function getColumnId(){
  const r = await fetch(`${BASE}/api/columns?boardId=${BOARD_ID}`, { cache: 'no-store', headers: globalCookieHeader ? { Cookie: globalCookieHeader } : undefined });
  if (!r.ok) throw new Error(`Failed to fetch columns: ${r.status}`);
  const cols = await r.json();
  if (!Array.isArray(cols) || cols.length === 0) throw new Error('No columns returned');
  const col = cols.find(c => !c.isDone) || cols[0];
  console.log(`Using column: ${col.id} (${col.label})`);
  return col.id;
}

async function doLogin(){
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const setCookie = res.headers.get('set-cookie') || res.headers.get('Set-Cookie');
    if (!setCookie) {
      console.warn('No Set-Cookie header returned from login');
      return null;
    }
    const cookieValue = setCookie.split(';')[0];
    console.log('Logged in, cookie:', cookieValue.split('=')[0]);
    return cookieValue;
  } catch (err) {
    console.error('Login error:', err);
    return null;
  }
}

let globalCookieHeader = null;

async function benchPost(columnId){
  const results = [];
  const bodies = [];
  for (let i=0;i<RUNS;i++){
    const title = `bench-create-${Date.now()}-${i}`;
    const start = Date.now();
    let res, json=null, text=null;
    try {
      res = await fetch(`${BASE}/api/tasks`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, globalCookieHeader ? { Cookie: globalCookieHeader } : {}),
        body: JSON.stringify({ title, column: columnId }),
      });
      const dur = Date.now()-start;
      try { json = await res.json(); } catch (e) { try { text = await res.text(); } catch(e){} }
      results.push({ ok: res.ok, status: res.status, dur });
      bodies.push(json ?? text ?? null);
    } catch (err) {
      const dur = Date.now()-start;
      results.push({ ok: false, status: 0, dur, err: String(err) });
      bodies.push(null);
    }
    await wait(DELAY_MS);
  }
  return { results, bodies };
}

async function benchPatch(taskId){
  const results = [];
  for (let i=0;i<PATCH_RUNS;i++){
    const title = `bench-patch-${Date.now()}-${i}`;
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, globalCookieHeader ? { Cookie: globalCookieHeader } : {}),
        body: JSON.stringify({ title }),
      });
      const dur = Date.now()-start;
      results.push({ ok: res.ok, status: res.status, dur });
    } catch (err) {
      const dur = Date.now()-start;
      results.push({ ok: false, status: 0, dur, err: String(err) });
    }
    await wait(DELAY_MS);
  }
  return results;
}

function summarize(durs){
  const arr = durs.slice().sort((a,b)=>a-b);
  const len = arr.length;
  const sum = arr.reduce((s,v)=>s+v,0);
  const avg = sum/len;
  const median = arr[Math.floor(len/2)];
  const p95 = arr[Math.floor(len*0.95)];
  const p99 = arr[Math.floor(len*0.99)];
  return { count: len, avg, median, p95, p99, min: arr[0], max: arr[len-1] };
}

(async function main(){
  console.log('Benchmark starting', { BASE, BOARD_ID, RUNS, PATCH_RUNS, DELAY_MS });
  await waitForServer();
  // login to obtain session cookie so middleware won't redirect API requests
  const cookie = await doLogin();
  if (cookie) globalCookieHeader = cookie;
  const col = await getColumnId();

  console.log('\nRunning POST benchmark...');
  const post = await benchPost(col);
  const postDurs = post.results.map(r=>r.dur).filter((v)=>typeof v==='number');
  const postSummary = summarize(postDurs);
  console.log('POST summary:', postSummary);

  // find first successful created task id
  let createdId = null;
  for (const b of post.bodies){
    if (b && b.id) { createdId = b.id; break; }
  }
  if (!createdId) {
    console.warn('No successful created task id found; skipping PATCH benchmark');
    process.exit(0);
  }

  console.log('\nRunning PATCH benchmark on task', createdId);
  const patch = await benchPatch(createdId);
  const patchDurs = patch.map(r=>r.dur).filter((v)=>typeof v==='number');
  const patchSummary = summarize(patchDurs);
  console.log('PATCH summary:', patchSummary);

  console.log('\nDetailed results (first 10 POST entries):', post.results.slice(0,10));
  console.log('\nDetailed results (first 10 PATCH entries):', patch.slice(0,10));

  console.log('\nBenchmark complete');
  console.log(JSON.stringify({ postSummary, patchSummary }, null, 2));
})();