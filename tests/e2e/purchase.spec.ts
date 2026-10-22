import { test, expect } from '@playwright/test';
import { aiCalls, buyWithMockPayment, completeQuiz, expectNoHorizontalScroll, setAiMode } from './helpers';

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
