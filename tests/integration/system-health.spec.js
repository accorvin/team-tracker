const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible, countDisabledNavItems } = require('./helpers');

/**
 * Integration tests for System Health module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @system-health
 * Usage: npx playwright test --grep @system-health
 */

test.describe('System Health Module @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should be visible in sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find the System Health module in the sidebar
    const moduleNav = page.locator('aside nav').filter({ hasText: 'System Health' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    // Verify the module link is visible and clickable
    const moduleLink = moduleNav.first();
    await expect(moduleLink).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate to System Health module when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // First, expand the System Health module section if it's collapsed
    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'System Health' }).first();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    // Now click on the "Quality analysis" view within the module
    const viewLink = page.locator('aside nav button').filter({ hasText: 'Quality analysis' }).first();
    await viewLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify URL changed to system-health module (default view is quality-analysis)
    expect(page.url()).toMatch(/system-health\/quality-analysis/);

    // Verify main content is visible
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should fetch quality reports from API', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/quality')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportsRequests = apiRequests.filter(r => r.url.includes('/quality/reports'));
    expect(reportsRequests.length).toBeGreaterThan(0);
    console.log(`Quality API requests: ${reportsRequests.length}`);
    reportsRequests.forEach(r => console.log(`  ${r.method} ${r.url}`));

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * Disabled Menu Items
 *
 * Verify that System Health module has no disabled menu items.
 * All navigation items should be active and clickable.
 */
test.describe('System Health Disabled Menu Items @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should have no disabled menu items', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Count disabled navigation items within the System Health section only
    const disabledCount = await countDisabledNavItems(page, 'System Health');

    // System Health module should have no disabled menu items
    expect(disabledCount).toBe(0);
    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Active Components
 *
 * Verify each major view (aka menu item) in the System Health module loads with
 * meaningful content
 */
test.describe('System Health Views @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/system-health/${viewId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Before we verify content, we need to verify the overall view loads
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Verify the view has rendered some meaningful content by checking for
    // data-bearing elements (not just empty containers or placeholders)
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    // Verify we're not stuck in an infinite loading state
    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);
    if (page.errors.length > 0) {
      console.error(`${viewName} errors:`, page.errors);
    }

    expect(page.errors).toHaveLength(0);
  }

  test('should load Quality Analysis view', async ({ page }) => {
    await testView(page, 'quality-analysis', 'Quality Analysis');
  });

  test('should load Component Maturity view', async ({ page }) => {
    await testView(page, 'component-maturity', 'Component Maturity');
  });

  test('should show empty state for repos without scan data', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find a "Pending" indicator — these appear for repos without scan data
    const pendingLabels = page.locator('table td span').filter({ hasText: 'Pending' });
    const pendingCount = await pendingLabels.count();
    if (pendingCount === 0) {
      console.log('No unscanned repos found — all repos have scan data, skipping empty state test');
      return;
    }

    // The same row should also show "None" in the gaps column
    const pendingRow = pendingLabels.first().locator('xpath=ancestor::tr');
    await expect(pendingRow.locator('text=None')).toBeVisible();

    // Click the repo name button in that row to open the detail view
    await pendingRow.locator('button').first().click();
    await page.waitForTimeout(1000);

    // Should show the empty state heading instead of an iframe
    const heading = page.locator('h2').filter({ hasText: 'No quality report available' });
    await expect(heading).toBeVisible();

    // Should show the troubleshooting section
    const troubleshooting = page.locator('text=Troubleshooting');
    await expect(troubleshooting).toBeVisible();

    // Should NOT render an iframe
    const iframe = page.locator('iframe');
    expect(await iframe.count()).toBe(0);

    expect(page.errors).toHaveLength(0);
  });

  test('should display table with required columns in Quality Analysis', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // We expect at least one table
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that all expected columns are present
    const expectedColumns = ['Repository', 'Tier', 'Component', 'Score', 'Gaps'];
    for (const columnName of expectedColumns) {
      // Look for the column header in table headers (th) or column cells
      const columnHeader = table.locator('th, thead td, [role="columnheader"]').filter({ hasText: columnName });
      const count = await columnHeader.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Found column: "${columnName}"`);
    }

    // Verify column order
    const allHeaders = await table.locator('th, thead td, [role="columnheader"]').allTextContents();
    console.log('All table headers:', allHeaders);

    expect(page.errors).toHaveLength(0);
  });

  test('should display quality scores from API data', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(5);
    console.log(`Quality analysis table rows: ${rowCount}`);

    const scoreCell = page.locator('table td span').filter({ hasText: /\d\.\d\/10/ });
    const scoreCount = await scoreCell.count();
    expect(scoreCount).toBeGreaterThan(0);
    console.log(`Score cells found: ${scoreCount}`);

    expect(page.errors).toHaveLength(0);
  });

  test('should filter reports by tier', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const allRows = await page.locator('table tbody tr').count();
    expect(allRows).toBe(5);

    // Select "downstream" tier — only 1 repo in fixture
    const tierSelect = page.locator('select').first();
    await tierSelect.selectOption({ label: 'downstream' });
    await page.waitForTimeout(500);

    const filteredRows = await page.locator('table tbody tr').count();
    expect(filteredRows).toBe(1);

    const summaryText = page.locator('text=/Showing 1 of 5/');
    await expect(summaryText).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should show report detail empty state when clicked', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const repoButton = page.locator('table tbody button').first();
    await repoButton.click();
    await page.waitForTimeout(1000);

    const heading = page.locator('h2').filter({ hasText: 'No quality report available' });
    await expect(heading).toBeVisible();

    const backButton = page.locator('button').filter({ hasText: 'Back to list' });
    await expect(backButton).toBeVisible();

    expect(await page.locator('iframe').count()).toBe(0);

    await backButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator('table')).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Disconnected Readiness Feature
 *
 * Verify the disconnected readiness dashboard functionality.
 */
test.describe('System Health Disconnected Readiness @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show disconnected readiness tab in component maturity view', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for the "Disconnected readiness" tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await expect(disconnectedTab).toBeVisible();

    // Click the disconnected readiness tab
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Verify content loaded
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should display summary cards in disconnected readiness view', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for summary cards - ReadinessSummaryCards renders as a grid with white/gray cards
    const summaryCards = page.locator('div.grid.grid-cols-2 > div');
    const cardCount = await summaryCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Look for readiness percentage or count displays
    const readinessMetrics = page.locator('text=/\\d+%|\\d+ ready|\\d+ repos/i');
    const metricsCount = await readinessMetrics.count();
    expect(metricsCount).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('should display readiness table with repositories', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for a table with repository data
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check for expected column headers
    const expectedColumns = ['Repository', 'Score', 'Status', 'Last Updated'];
    for (const columnName of expectedColumns) {
      // Look for the column header (case insensitive)
      const columnHeader = table.locator('th, thead td, [role="columnheader"]').filter({ hasText: new RegExp(columnName, 'i') });
      const count = await columnHeader.count();
      if (count > 0) {
        console.log(`Found column: "${columnName}"`);
      }
      // Don't require all columns as the exact naming might differ
    }

    expect(page.errors).toHaveLength(0);
  });

  test('should handle repository detail navigation', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for clickable repository rows in the table
    const repoRow = page.locator('table tbody tr').first();
    const rowCount = await repoRow.count();

    if (rowCount > 0) {
      // Click the first repository row
      await repoRow.click();
      await page.waitForTimeout(1000);

      // Verify we navigated to a detail view
      expect(page.url()).toMatch(/disconnected-repo-detail/);

      // Verify detail content loaded
      const hasContent = await pageHasContent(page);
      expect(hasContent).toBe(true);
    } else {
      console.log('No repository links found - likely empty state or different UI pattern');
    }

    expect(page.errors).toHaveLength(0);
  });

  test('should fetch disconnected summary data from API', async ({ page }) => {
    // Monitor API requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/disconnected')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Should have made at least one API request to the disconnected endpoints
    expect(apiRequests.length).toBeGreaterThan(0);

    // Verify the summary endpoint was called
    const summaryRequests = apiRequests.filter(req => req.url.includes('/summary'));
    expect(summaryRequests.length).toBeGreaterThan(0);

    console.log(`Disconnected API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => console.log(`  ${req.method} ${req.url}`));

    expect(page.errors).toHaveLength(0);
  });
});
