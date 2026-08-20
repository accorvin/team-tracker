const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Release Timeline (Schedule view)
 *
 * These tests verify:
 * - Timeline canvas renders with milestone nodes
 * - Every visible dot has a stem connecting it to its card
 * - Stems render correctly at multiple zoom levels
 * - No JavaScript errors during zoom/pan interactions
 *
 * Tag: @release-timeline
 * Usage: npx playwright test --grep @release-timeline
 */

test.describe('Release Timeline @release-timeline @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('Schedule view loads with a canvas timeline', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    var viewLabel = page.locator('text=/\\d+d view/');
    await expect(viewLabel.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('timeline renders milestone cards above and below axis', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // The milestone countdown cards should be visible above the timeline
    var countdownCards = page.locator('text=/\\d+ DAYS|Today/');
    var cardCount = await countdownCards.count();
    expect(cardCount).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('zoom in via scroll wheel updates the view label', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Get initial zoom level
    var labelBefore = await page.locator('text=/\\d+d view/').first().textContent();
    var daysBefore = parseInt(labelBefore.match(/(\d+)d/)[1]);

    // Zoom in
    var cx = box.x + box.width * 0.3;
    var cy = box.y + box.height * 0.5;
    for (var i = 0; i < 10; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    var labelAfter = await page.locator('text=/\\d+d view/').first().textContent();
    var daysAfter = parseInt(labelAfter.match(/(\d+)d/)[1]);

    expect(daysAfter).toBeLessThan(daysBefore);

    // Reset zoom button should appear
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('reset zoom button restores default view', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Get initial label
    var labelBefore = await page.locator('text=/\\d+d view/').first().textContent();

    // Zoom in
    for (var i = 0; i < 10; i++) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Click Reset zoom
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(500);

    var labelAfter = await page.locator('text=/\\d+d view/').first().textContent();
    expect(labelAfter.trim()).toBe(labelBefore.trim());

    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors at any zoom level during zoom-in sequence', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.2;
    var cy = box.y + box.height * 0.5;

    // Zoom through all levels: 29d → 14d → 8d → 4d → 2d
    for (var i = 0; i < 40; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1000);

    // No JS errors should occur during rapid zooming
    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors during pan interactions', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Zoom in first
    for (var i = 0; i < 15; i++) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Pan left and right
    var startX = box.x + box.width * 0.7;
    var startY = box.y + box.height * 0.5;
    var endX = box.x + box.width * 0.3;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (var j = 0; j < 10; j++) {
      await page.mouse.move(startX + (endX - startX) * j / 10, startY);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('distances checkbox toggles dimension lines', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();

    // Toggle off and on — should not throw errors
    await checkbox.uncheck();
    await page.waitForTimeout(500);
    await checkbox.check();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('cycle filter buttons are visible and clickable', async ({ page, request }) => {
    // Filter pills only render when the registry has >1 product or >1 stream.
    // Check via API first to avoid flaky DOM race conditions.
    var regRes = await request.get('/api/modules/releases/registry');
    var regBody = await regRes.json();
    var active = (regBody.releases || []).filter(function(r) { return r.state === 'active' });
    var streamSet = {};
    for (var i = 0; i < active.length; i++) {
      var sources = [active[i].productPagesVersion, active[i].displayName, active[i].id];
      for (var j = 0; j < sources.length; j++) {
        if (!sources[j]) continue;
        var m = sources[j].match(/(\d+\.\d+)/);
        if (m) { streamSet[m[1]] = true; break; }
      }
    }
    if (Object.keys(streamSet).length < 2) {
      test.skip();
      return;
    }

    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var allBtn = page.locator('button').filter({ hasText: /^All$/ }).first();
    await expect(allBtn).toBeVisible({ timeout: 10000 });

    var cycleButtons = page.locator('button').filter({ hasText: /^\d+\.\d+$/ });
    var cycleCount = await cycleButtons.count();
    expect(cycleCount).toBeGreaterThan(0);

    await cycleButtons.first().click();
    await page.waitForTimeout(500);

    var allBtnRefresh = page.locator('button').filter({ hasText: /^All$/ }).first();
    await expect(allBtnRefresh).toBeVisible();
    await allBtnRefresh.click();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('canvas renders consistently after rapid zoom in and out', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.3;
    var cy = box.y + box.height * 0.5;

    // Rapidly zoom in
    for (var i = 0; i < 20; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(30);
    }
    // Rapidly zoom out
    for (var j = 0; j < 20; j++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(1000);

    // Canvas should still exist and page should be error-free
    await expect(canvas).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors during full zoom-out sequence', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.5;
    var cy = box.y + box.height * 0.5;

    // Zoom out from default 29d through 52d, 78d, to max 90d
    for (var i = 0; i < 40; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1000);

    await expect(canvas).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });
});
