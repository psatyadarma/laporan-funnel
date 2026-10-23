import { test as base, expect } from '@playwright/test';

// Every test page skips external web fonts (Google Fonts). They don't affect behavior, and in sandboxes or
// slow networks waiting on them makes page timing random. The context-level route also covers extra pages.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    // Ad pixels: tests check our own calls to window.ttq / fbq, never the real ad networks.
    await context.route(/analytics\.tiktok\.com|connect\.facebook\.net/, (route) => route.abort());
    await use(context);
  },
});
export { expect };
