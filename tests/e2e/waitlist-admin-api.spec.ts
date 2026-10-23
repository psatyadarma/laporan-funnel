import { test, expect } from './fixtures';
import { ADMIN_KEY, expectNoHorizontalScroll } from './helpers';
import { createHash } from 'node:crypto';

test.describe('waitlist bets', () => {
  for (const slug of ['siap-nikah', 'pilih-jurusan']) {
    test(`${slug}: every hook lander loads and the waitlist accepts a signup`, async ({ page }) => {
      for (const h of ['1', '2', '3']) {
        await page.goto(`/${slug}?h=${h}`);
        await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
        await expectNoHorizontalScroll(page);
      }
      await page.getByPlaceholder(/WhatsApp atau email/).fill('081234567890');
      await page.getByRole('button', { name: /Daftar akses awal/ }).click();
      await expect(page.getByText('✓ Terdaftar')).toBeVisible();
    });
  }
  test('quiz URL of a waitlist bet sends people back to the lander', async ({ page }) => {
    await page.goto('/siap-nikah/quiz');
    await expect(page).toHaveURL(/\/siap-nikah$/);
  });
});

test.describe('legal pages', () => {
  test('privacy and terms load, show the operator and contact, and are linked from landers', async ({ page }) => {
    await page.goto('/peta-rezeki?h=1');
    await page.getByRole('link', { name: 'Privasi' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kebijakan Privasi');
    await expect(page.getByText('Lintang Wiyata').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'lintangwiyata@gmail.com' }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: /Syarat/ }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Syarat & Ketentuan');
    await expect(page.getByText(/Pengembalian dana/)).toBeVisible();
    await page.goto('/siap-nikah?h=1');
    await expect(page.getByRole('link', { name: 'Privasi' })).toBeVisible();
  });
});

test.describe('admin', () => {
  test('wrong password shows a clear error; right password shows stats and drop-off', async ({ page, request }) => {
    // seed one quiz start + answer so the funnel and drop-off tables have data even on a fresh database
    await request.post('/api/sessions', { data: { bet: 'peta-rezeki', variant: '1', visitorId: 'e2e-admin-seed' } });
    await request.post('/api/events', { data: { bet: 'peta-rezeki', variant: '1', name: 'quiz_q', value: 1, visitorId: 'e2e-admin-seed' } });
    await page.goto('/admin');
    await page.locator('input[type=password]').fill('wrong');
    await page.getByRole('button', { name: 'Load' }).click();
    await expect(page.getByText(/Wrong password, or ADMIN_KEY is missing/)).toBeVisible();
    await page.locator('input[type=password]').fill(`  ${ADMIN_KEY} `); // spaces are tolerated
    await page.getByRole('button', { name: 'Load' }).click();
    await expect(page.getByText('Paywall→paid %')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quiz drop-off by question' })).toBeVisible();
    await expect(page.getByRole('row', { name: /peta-rezeki/ }).first()).toBeVisible();
  });
});

test.describe('automated test traffic', () => {
  test('visits tagged as test traffic do not count in funnel stats', async ({ request }) => {
    const landerViews = async () => {
      const st = await (await request.get(`/api/admin/stats?key=${ADMIN_KEY}&days=1`)).json();
      return st.events.filter((e: { bet: string; name: string; uniq: number }) => e.bet === 'pilih-jurusan' && e.name === 'lp_view').reduce((n: number, e: { uniq: number }) => n + e.uniq, 0);
    };
    const before = await landerViews();
    for (const id of ['test-smoke', 'test-bot-1', 'smoke-test']) {
      await request.post('/api/events', { data: { bet: 'pilih-jurusan', name: 'lp_view', variant: '9', visitorId: id } });
    }
    expect(await landerViews()).toBe(before);
    await request.post('/api/events', { data: { bet: 'pilih-jurusan', name: 'lp_view', variant: '9', visitorId: 'real-visitor-1' } });
    expect(await landerViews()).toBe(before + 1);
  });
});

test.describe('API guards', () => {
  test('health reports settings without leaking values', async ({ request }) => {
    const h = await (await request.get('/api/health')).json();
    expect(h.settings.ADMIN_KEY).toBe('set');
    expect(JSON.stringify(h)).not.toContain(ADMIN_KEY);
  });
  test('admin endpoints reject missing or wrong keys', async ({ request }) => {
    expect((await request.get('/api/admin/stats')).status()).toBe(401);
    expect((await request.get('/api/admin/stats?key=nope')).status()).toBe(401);
    expect((await request.post('/api/admin/test-report?key=nope')).status()).toBe(401);
  });
  test('cannot complete a quiz with missing answers or order without a finished quiz', async ({ request }) => {
    const s = await (await request.post('/api/sessions', { data: { bet: 'peta-rezeki', variant: '1' } })).json();
    expect((await request.post(`/api/sessions/${s.id}/complete`, { data: { answers: { status: 'employee' } } })).status()).toBe(400);
    expect((await request.post('/api/orders', { data: { sessionId: s.id, name: 'x', email: 'x@y.co', mobile: '081234567890' } })).status()).toBe(400);
  });
  test('waitlist bets cannot start paid quiz sessions', async ({ request }) => {
    expect((await request.post('/api/sessions', { data: { bet: 'siap-nikah' } })).status()).toBe(400);
  });
  test('unknown report links and fake payment notifications are rejected', async ({ request }) => {
    expect((await request.get('/api/reports/not-a-real-token')).status()).toBe(404);
    // Midtrans isn't configured in e2e, so even a well-formed notification is refused
    const body = { order_id: 'x', status_code: '200', gross_amount: '99000.00' };
    const signature_key = createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + 'guess').digest('hex');
    expect((await request.post('/api/webhooks/midtrans', { data: { ...body, signature_key } })).status()).toBe(401);
  });
  test('event endpoint rejects forged purchases and unknown events', async ({ request }) => {
    expect((await request.post('/api/events', { data: { bet: 'peta-rezeki', name: 'purchase' } })).status()).toBe(400);
    expect((await request.post('/api/events', { data: { bet: 'peta-rezeki', name: 'hack' } })).status()).toBe(400);
    expect((await request.post('/api/events', { data: { bet: 'peta-rezeki', name: 'quiz_q', value: 999 } })).status()).toBe(400);
  });
});
