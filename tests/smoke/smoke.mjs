// Smoke test against a deployed site. Usage:
//   SMOKE_URL=https://laporan-funnel.psatyadarma2.workers.dev node tests/smoke/smoke.mjs
// Optional: ADMIN_KEY=... CHECK_AI=1 also generates one real AI test report (costs ~Rp1.000) and checks it's complete.
const base = (process.env.SMOKE_URL ?? '').replace(/\/$/, '');
if (!base) { console.error('Set SMOKE_URL'); process.exit(2); }
const failures = [];
const warn = [];
async function check(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); } catch (e) { failures.push(`${name}: ${e.message}`); console.log(`✗ ${name}: ${e.message}`); }
}
const get = async (path, init) => { const r = await fetch(base + path, init); return { status: r.status, text: await r.text(), r }; };
const json = (t) => { try { return JSON.parse(t); } catch { throw new Error(`not JSON: ${t.slice(0, 120)}`); } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

await check('health endpoint', async () => {
  const { status, text } = await get('/api/health');
  assert(status === 200, `status ${status}`);
  const h = json(text);
  for (const k of ['ADMIN_KEY', 'AI_API_KEY']) assert(h.settings[k] === 'set', `${k} is missing in Cloudflare Variables and Secrets`);
  const pay = h.settings.PAYMENT_PROVIDER;
  if (pay === 'midtrans' && h.settings.MIDTRANS_SERVER_KEY !== 'set') warn.push('MIDTRANS_SERVER_KEY missing: checkout shows "Pembayaran belum aktif"');
  if (pay === 'midtrans' && h.settings.MIDTRANS_PRODUCTION !== 'true') warn.push('Midtrans is in SANDBOX mode (no real payments)');
});
for (const slug of ['peta-rezeki', 'siap-nikah', 'pilih-jurusan']) {
  await check(`bet config ${slug}`, async () => {
    const { status, text } = await get(`/api/bets/${slug}`);
    assert(status === 200, `status ${status}`);
    const b = json(text);
    assert(b.hooks?.length > 0, 'no hooks');
    assert(!('score' in b) && !('reportPrompt' in b), 'server-only fields leaked');
  });
  await check(`lander page ${slug}`, async () => {
    const { status, text } = await get(`/${slug}?h=1`);
    assert(status === 200 && text.includes('<div id="root">'), `status ${status}`);
    const js = /src="(\/assets\/[^"]+\.js)"/.exec(text)?.[1];
    assert(js, 'no app script in HTML');
    assert((await get(js)).status === 200, 'app script missing');
  });
}
await check('admin is protected', async () => {
  assert((await get('/api/admin/stats')).status === 401, 'admin stats open without a key');
});
await check('mock payments are disabled in production', async () => {
  const { status } = await get('/api/mock/pay/anything', { method: 'POST' });
  assert(status === 403, `expected 403, got ${status}`);
});
await check('quiz session can start and score', async () => {
  const cfg = json((await get('/api/bets/peta-rezeki')).text);
  const s = json((await get('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bet: 'peta-rezeki', variant: '1', utm: { utm_source: 'smoke' }, visitorId: 'test-smoke' }) })).text);
  assert(s.id, 'no session id');
  const answers = {};
  for (const q of cfg.questions) if (!q.onlyForVariants) answers[q.id] = q.kind === 'choice' ? q.options[0].id : q.kind === 'date' ? '1995-03-10' : 'Smoke';
  const done = json((await get(`/api/sessions/${s.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, visitorId: 'test-smoke' }) })).text);
  assert(done.preview?.title, `no preview: ${JSON.stringify(done).slice(0, 120)}`);
});
if (process.env.CHECK_AI && process.env.ADMIN_KEY) {
  await check('real AI report is complete (costs ~Rp1.000)', async () => {
    const { status, text } = await get(`/api/admin/test-report?key=${encodeURIComponent(process.env.ADMIN_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const r = json(text);
    assert(status === 200, r.error ?? `status ${status}`);
    const all = JSON.stringify(r.content);
    assert(r.content.sections.filter((s) => s.heading).length >= 8, 'fewer than 8 sections');
    assert(!/\*/.test(all), 'markdown asterisks in report');
    assert(!/\bRIASEC\b|\(A = |skor [A-Z] /i.test(all), 'raw scores leaked into report');
    console.log(`  ${r.model}, ${Math.round(r.ms / 1000)}s, ${all.length} chars`);
  });
}
for (const w of warn) console.log(`! ${w}`);
if (failures.length) { console.log(`\n${failures.length} smoke check(s) failed`); process.exit(1); }
console.log('\nAll smoke checks passed');
