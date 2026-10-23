'use strict'

// Visual-regression suite for the UI preview (see design-decisions/0002).
// Baselines are NOT committed (they are large); generate them from a base ref
// with scripts/visual-baseline.sh, then run `npm run test:visual` on your branch.

const { defineConfig } = require('@playwright/test')

const PORT = Number(process.env.VISUAL_PORT || 5254)

module.exports = defineConfig({
  testDir: 'tests',
  snapshotDir: 'tests/visual/__screenshots__',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}{ext}',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // Defaults were measured: on an unchanged tree the noisiest pages differ by about 240 pixels (0.013%), so a
  // per-pixel colour distance of 0.05 and 0.03% of pixels is stable yet still catches a colour tweak on text.
  // (Playwright's own defaults, 0.2 and no pixel limit, let a link-colour change on every page pass.)
  // Override with VISUAL_THRESHOLD (0-1) and VISUAL_RATIO (fraction of pixels).
  expect: {
    toHaveScreenshot: {
      threshold: process.env.VISUAL_THRESHOLD === undefined ? 0.05 : Number(process.env.VISUAL_THRESHOLD),
      maxDiffPixelRatio: process.env.VISUAL_RATIO === undefined ? 0.0003 : Number(process.env.VISUAL_RATIO),
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  projects: [
    // screenshots and the horizontal-overflow guard, at three widths
    { name: 'desktop', testMatch: /visual\/.*\.spec\.js/, use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', testMatch: /visual\/.*\.spec\.js/, use: { viewport: { width: 820, height: 1100 } } },
    {
      name: 'mobile',
      testMatch: /visual\/.*\.spec\.js/,
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    // behaviour (anchor scrolling, keyboard) and accessibility (axe) checks
    { name: 'behaviour', testMatch: /(behaviour|a11y)\/.*\.spec\.js/, use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'behaviour-mobile',
      testMatch: /behaviour\/.*\.spec\.js/,
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `node scripts/serve-public.js public ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
})
