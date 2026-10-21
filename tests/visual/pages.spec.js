'use strict'

const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..', 'public')

function listPages (dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_') continue // UI assets
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listPages(full, out)
    else if (entry.name.endsWith('.html')) out.push(path.relative(root, full).split(path.sep).join('/'))
  }
  return out.sort()
}

test.beforeEach(async ({ context }) => {
  // Keep runs hermetic and deterministic: no third-party scripts, fonts, analytics or images.
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'),
    (route) => route.abort()
  )
})

for (const rel of listPages()) {
  test(rel, async ({ page }) => {
    await page.goto('/' + rel, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(400) // let client-side nav/TOC/tabs scripts settle
    await expect(page).toHaveScreenshot(rel.replace(/\//g, '--').replace(/\.html$/, '.png'), { fullPage: true })
  })
}
