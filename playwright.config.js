'use strict'

// Visual-regression suite for the UI preview (see design-decisions/0002).
// Baselines are NOT committed (they are large); generate them from a base ref
// with scripts/visual-baseline.sh, then run `npm run test:visual` on your branch.

const { defineConfig } = require('@playwright/test')

const PORT = Number(process.env.VISUAL_PORT || 5254)

module.exports = defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled', caret: 'hide' } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1100 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: `node scripts/serve-public.js public ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
})
