import { test as base, expect } from '@playwright/test';

// Every test page skips external web fonts (Google Fonts). They don't affect behavior, and in sandboxes or
// slow networks waiting on them makes page timing random. The context-level route also covers extra pages.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(context);
  },
});
export { expect };
