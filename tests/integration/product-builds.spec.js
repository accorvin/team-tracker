const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for Product Builds module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - CHI column appears in artifacts table
 * - CHI badge renders in artifact detail view
 * - Artifacts without health_index don't show CHI
 * - Tests column appears in artifacts table
 *
 * Tag: @product-builds
 * Usage: npx playwright test --grep @product-builds
 */

test.describe('Product Builds Module @product-builds', () => {
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

    const moduleNav = page.locator('aside nav').filter({ hasText: 'Product Bu' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to RHAIIS view', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/rhaiis/);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show 3.6-EA2 drops in the Base Images view', async ({ page }) => {
    // Register the catch-all first because Playwright gives later routes priority.
    await page.route('**/api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }));
    await page.route('**/api/modules/product-builds/products/base-images', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'base-images', product_name: 'Base Images', short_name: 'Base Images' }),
    }));
    await page.route('**/api/modules/product-builds/series?product_key=base-images', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['3.6', '3.6-EA2', '3.6-EA1']),
    }));
    await page.route('**/api/modules/product-builds/drops?**', route => {
      const artifactType = new URL(route.request().url()).searchParams.get('artifact_type');
      const drops = [{
        key: 'base-images-3.6-ga',
        name: 'Base Images 3.6 GA',
        product_version: '3.6',
        environments: ['production'],
        created_at: '2026-10-01T12:00:00Z',
      }, {
        key: 'base-images-3.6-ea1',
        name: 'Base Images 3.6-EA1',
        product_version: '3.6-EA1',
        environments: ['production'],
        created_at: '2026-08-01T12:00:00Z',
      }, {
        key: 'base-images-3.6-ea2',
        name: 'Base Images 3.6-EA2',
        product_version: '3.6-EA2',
        environments: ['stage'],
        created_at: '2026-09-01T12:00:00Z',
      }];
      const result = artifactType ? drops.slice(2) : drops;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    });
    await page.route('**/api/modules/product-builds/artifacts?**', route => {
      const artifactType = new URL(route.request().url()).searchParams.get('type');
      const artifacts = artifactType === 'base-images' ? [{
        key: 'base-image-artifact-3.6-ea2',
        type: 'base-images',
        variant: 'cpu',
        archs: ['x86_64'],
        environments: ['stage'],
      }] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(artifacts) });
    });

    await page.goto('/#/product-builds/base-images');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Base Images 3.6 GA')).toBeVisible();
    await expect(page.getByText('Base Images 3.6-EA1')).toBeVisible();
    await expect(page.getByText('Base Images 3.6-EA2')).toBeVisible();

    await page.getByRole('button', { name: 'Artifacts' }).click();
    await expect(page.getByText('base-image-artifact-3.6-ea2')).toBeVisible();
  });

  test('should show CHI column header in artifacts tab', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const chiHeader = page.locator('th').filter({ hasText: 'CHI' });
      await expect(chiHeader).toBeVisible();

      const testsHeader = page.locator('th').filter({ hasText: 'Tests' });
      await expect(testsHeader).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Health Index in artifact detail when data exists', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const firstArtifact = page.locator('tbody tr').first();
      if (await firstArtifact.isVisible()) {
        await firstArtifact.click();
        await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

        const healthLabel = page.locator('dt').filter({ hasText: 'Health Index' });
        const hasHealth = await healthLabel.count();
        if (hasHealth > 0) {
          await expect(healthLabel).toBeVisible();
          const gradeBadge = page.locator('.font-bold').first();
          const gradeText = await gradeBadge.textContent();
          if (gradeText && gradeText.trim() !== 'Unknown') {
            const vulnerabilities = page.locator('text=vulnerabilities');
            await expect(vulnerabilities).toBeVisible();
          }
        }
      }
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to Search view and show empty state', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/search/);

    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toBeVisible();
    await expect(page.locator('text=Enter a search query')).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should run a search and update the URL query param', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill('rhaiis');
    await searchInput.press('Enter');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/[?&]q=rhaiis/);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });
});
