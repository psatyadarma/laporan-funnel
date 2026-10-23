import { expect, type Page, type APIRequestContext } from '@playwright/test';

export const AI = 'http://localhost:8790';
export const ADMIN_KEY = 'e2e-admin';

export async function setAiMode(request: APIRequestContext, mode: 'ok' | 'truncated' | 'noclosing' | 'error' | 'slow') {
  await request.post(`${AI}/__mode`, { data: { mode } });
}
export interface Outbox {
  emails: { auth: string; idempotencyKey?: string; from: string; to: string[]; subject: string; text: string; html: string }[];
  tiktok: { token: string; event_source_id: string; data: { event: string; event_id: string; user: Record<string, string> }[] }[];
}
/** Emails and TikTok server events the app sent to the fake services since the last setAiMode. */
export async function outbox(request: APIRequestContext): Promise<Outbox> {
  return (await request.get(`${AI}/__outbox`)).json();
}
export async function aiCalls(request: APIRequestContext): Promise<number> {
  return (await (await request.get(`${AI}/__calls`)).json()).calls;
}

/**
 * Clicks through the quiz like a buyer, one step at a time, following the "n / total" counter
 * (first option for choices; fills date/text steps), then waits for the results page.
 */
export async function completeQuiz(page: Page, { birthdate = '1995-03-10', name = 'Dimas' } = {}) {
  await page.getByRole('button', { name: /mulai tes|cek tipeku/i }).click();
  const counter = page.locator('.topbar .small');
  await expect(counter).toHaveText(/^1 \/ \d+$/);
  const total = Number((await counter.textContent())!.split('/')[1].trim());
  for (let step = 1; step <= total; step++) {
    await expect(counter).toHaveText(`${step} / ${total}`);
    const prompt = page.locator('.q-prompt');
    await expect(prompt).toBeVisible();
    const option = page.locator('button.option').first();
    if ((await page.locator('button.option').count()) > 0) {
      await option.click();
    } else {
      const field = page.locator('form input.field');
      await field.fill((await field.getAttribute('type')) === 'date' ? birthdate : name);
      await page.locator('form button.btn').first().click();
    }
  }
  await expect(page.locator('.result-hero')).toBeVisible({ timeout: 30_000 });
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
