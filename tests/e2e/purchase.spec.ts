import { test, expect } from './fixtures';
import { aiCalls, buyWithMockPayment, completeQuiz, expectNoHorizontalScroll, outbox, setAiMode } from './helpers';

test.describe('Peta Rezeki purchase flow', () => {
  test('lander → quiz → preview → pay → full AI report', async ({ page, request }) => {
    await setAiMode(request, 'ok');
    await page.goto('/peta-rezeki?h=1&utm_source=e2e');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Kerja keras tapi rezeki/);
    await expectNoHorizontalScroll(page);

    await completeQuiz(page);
    await expect(page.getByText('Hasil awalmu')).toBeVisible();
    await expect(page.locator('.result-hero h1')).not.toBeEmpty();
    await expect(page.locator('.checks li')).toHaveCount(3 + 6); // 3 free insights + 6 paywall items
    await expect(page.getByText(/Jalur rezeki #1 untukmu/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await buyWithMockPayment(page);
    await expect(page.locator('.report section').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/\(AI\)/);
    const headings = await page.locator('.report section h2').allTextContents();
    expect(headings).toEqual(expect.arrayContaining(['Profilmu', 'Rencana 90 hari']));
    const text = await page.locator('.report').innerText();
    expect(text).not.toMatch(/\*/); // markdown stripped
    expect(text).toContain('Penutup dari AI palsu.');
    await expectNoHorizontalScroll(page);
    expect(await aiCalls(request)).toBe(1); // exactly one paid AI call per order

    // Report link keeps working on reload
    await page.reload();
    await expect(page.locator('.report section').first()).toBeVisible();
    expect(await aiCalls(request)).toBe(1);
  });

  test('after payment: one report email + one TikTok CompletePayment matching the browser pixel', async ({ page, request }) => {
    await setAiMode(request, 'ok');
    await page.goto('/peta-rezeki?h=2&utm_source=tiktok&ttclid=click-e2e');
    await completeQuiz(page);
    await expect(page.getByPlaceholder('Email (link laporan dikirim ke sini)')).toBeVisible();
    await buyWithMockPayment(page);
    const reportUrl = page.url();

    await expect.poll(async () => (await outbox(request)).emails.length, { timeout: 15_000 }).toBe(1);
    await expect.poll(async () => (await outbox(request)).tiktok.length, { timeout: 15_000 }).toBe(1);
    const box = await outbox(request);

    const mail = box.emails[0];
    expect(mail.to).toEqual(['dimas@example.com']);
    expect(mail.from).toBe('Peta Rezeki <laporan@example.test>');
    expect(mail.auth).toBe('Bearer re_fake');
    expect(mail.subject).toContain('Peta Rezeki');
    expect(mail.text).toContain('Halo Dimas,');
    expect(mail.text).toContain(reportUrl); // the link in the email opens this same report

    const tt = box.tiktok[0];
    expect(tt.token).toBe('tt_fake');
    expect(tt.event_source_id).toBe('TTPIXELTEST');
    expect(tt.data[0].event).toBe('CompletePayment');
    expect(tt.data[0].user.ttclid).toBe('click-e2e');
    expect(tt.data[0].user.email).toMatch(/^[0-9a-f]{64}$/);

    // The browser pixel queued the same purchase with the same event id, so TikTok counts it once.
    const browserIds = await page.evaluate(() => (window as unknown as { ttq: unknown[] }).ttq
      .filter((c): c is unknown[] => Array.isArray(c) && c[0] === 'track' && c[1] === 'CompletePayment')
      .map((c) => (c[3] as { event_id?: string } | undefined)?.event_id));
    expect(browserIds).toEqual([tt.data[0].event_id]);

    // Reloading the report or the cron path never sends a second email.
    await page.reload();
    await expect(page.locator('.report section').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/juga sudah dikirim ke emailmu/)).toBeVisible();
    expect((await outbox(request)).emails.length).toBe(1);
  });

  test('weton variant asks birth date + maghrib and adds the weton section', async ({ page, request }) => {
    await setAiMode(request, 'ok');
    await page.goto('/peta-rezeki?h=weton');
    await expect(page.getByText('Bukan ramalan.')).toBeVisible();
    await completeQuiz(page, { birthdate: '1945-08-17' });
    await expect(page.getByText(/Wetonmu \(Jumat Legi\) dalam tradisi Jawa/)).toBeVisible();
  });
});

test.describe('AI failures never leave a buyer without a report', () => {
  for (const mode of ['truncated', 'noclosing', 'error'] as const) {
    test(`AI ${mode} → retries, then the complete template report`, async ({ page, request }) => {
      await setAiMode(request, mode);
      await page.goto('/peta-rezeki?h=2');
      await completeQuiz(page);
      await buyWithMockPayment(page);
      await expect(page.locator('.report section').first()).toBeVisible({ timeout: 90_000 });
      const headings = await page.locator('.report section h2').allTextContents();
      expect(headings).toEqual(expect.arrayContaining(['Profilmu', 'Kekuatan utamamu', 'Rencana 90 hari']));
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/\(AI\)/); // template, not the broken AI text
      expect(await aiCalls(request)).toBe(3); // 3 attempts, then fallback
    });
  }

  test('slow AI: refreshing the report page does not start extra AI calls', async ({ page, request, context }) => {
    await setAiMode(request, 'slow');
    await page.goto('/peta-rezeki?h=1');
    await completeQuiz(page);
    await buyWithMockPayment(page);
    const second = await context.newPage();
    await second.goto(page.url()); // buyer opens the link twice while it's being written
    await expect(page.locator('.report section').first()).toBeVisible({ timeout: 90_000 });
    await second.reload();
    await expect(second.locator('.report section').first()).toBeVisible({ timeout: 30_000 });
    expect(await aiCalls(request)).toBe(1);
  });
});
