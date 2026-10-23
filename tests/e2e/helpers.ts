import { expect, type Page, type APIRequestContext } from '@playwright/test';

export const AI = 'http://localhost:8790';
export const ADMIN_KEY = 'e2e-admin';

export async function setAiMode(request: APIRequestContext, mode: 'ok' | 'truncated' | 'noclosing' | 'error' | 'slow') {
  await request.post(`${AI}/__mode`, { data: { mode } });
}
export async function aiCalls(request: APIRequestContext): Promise<number> {
  return (await (await request.get(`${AI}/__calls`)).json()).calls;
}

/** Clicks through the quiz like a buyer (first option each time; fills date/text steps). */
export async function completeQuiz(page: Page, { birthdate = '1995-03-10', name = 'Dimas' } = {}) {
  await page.getByRole('button', { name: /mulai tes|cek tipeku/i }).click();
  await expect(page.locator('.q-prompt')).toBeVisible();
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.result-hero').isVisible()) return;
    if (await page.locator('.spinner').isVisible()) { await page.waitForTimeout(500); continue; }
    const counter = await page.locator('.topbar .small').textContent().catch(() => null);
    const option = page.locator('button.option').first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      // wait for the next step (counter changes) or the analyzing screen
      await expect(async () => {
        const now = await page.locator('.topbar .small').textContent({ timeout: 1000 }).catch(() => null);
        const busy = await page.locator('.spinner').isVisible();
        const done = await page.locator('.result-hero').isVisible();
        expect(busy || done || now !== counter).toBeTruthy();
      }).toPass({ timeout: 15_000 });
      continue;
    }
    const field = page.locator('form input.field');
    if (await field.isVisible().catch(() => false)) {
      await field.fill((await field.getAttribute('type')) === 'date' ? birthdate : name);
      await page.locator('form button.btn').click();
      continue;
    }
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.result-hero')).toBeVisible({ timeout: 20_000 });
}

/** Fills checkout, pays on the mock payment page, and lands on the report page. */
export async function buyWithMockPayment(page: Page) {
  await page.getByPlaceholder('Nama').fill('Dimas Uji');
  await page.getByPlaceholder(/Email/).fill('dimas@example.com');
  await page.getByPlaceholder('Nomor WhatsApp').fill('0812-3456-7890');
  await page.getByRole('button', { name: /Bayar/ }).click();
  await page.waitForURL(/\/mock-pay\//);
  await page.getByRole('button', { name: /Bayar sekarang/ }).click();
  await page.waitForURL(/\/r\//, { timeout: 30_000 });
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll sideways on a phone').toBeLessThanOrEqual(1);
}
