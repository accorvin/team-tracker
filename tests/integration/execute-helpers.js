/**
 * Execute-workspace helpers for Playwright tests.
 * Kept out of tests/integration/helpers.js so changing them does not
 * trip the shared-test-files path filter (which runs every module).
 */

/**
 * Demo-mode Execute pages often log 401/403/404 resource loads (missing
 * field-options fixtures, hygiene/config requiring planning-manager). Those
 * are handled in-app; ignore them when asserting on captured page.errors.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {object[]}
 */
function unexpectedDemoResourceErrors(page) {
  return (page.errors || []).filter(
    e => !(e.type === 'console.error' && /Failed to load resource.*\b40[134]\b/.test(e.message))
  );
}

/**
 * Dismiss the first-visit Feature Status / hygiene welcome modal if it is open.
 *
 * @param {import('@playwright/test').Page} page
 */
async function dismissHygieneWelcome(page) {
  const modal = page.locator('[data-testid="hygiene-welcome-modal"]').first();
  if (await modal.isVisible().catch(() => false)) {
    await modal.locator('button', { hasText: 'Got it' }).first().click().catch(() => {});
    await modal.waitFor({ state: 'hidden' }).catch(() => {});
  }
}

module.exports = {
  unexpectedDemoResourceErrors,
  dismissHygieneWelcome
};
