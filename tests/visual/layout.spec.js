'use strict'

// Cheap layout guard that screenshots do not express as a pass/fail: no preview page should scroll
// horizontally at any of the tested widths (typically a sign that wider text or an overflowing element broke the
// layout).

const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..', 'public')

// Pages that already overflowed before the rebrand work (wide tables or code at narrow widths). They are marked as
// expected failures so the suite only flags NEW overflow, and will fail when one is fixed, as a prompt to remove it.
const KNOWN_OVERFLOW = new Set([
  'tablet:fixtures/pages/server-concept-deep-toc.html',
  'mobile:fixtures/pages/cbl-callouts.html',
  'mobile:fixtures/pages/server-concept-deep-toc.html',
  'mobile:tiles.html',
])

function listPages (dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listPages(full, out)
    else if (entry.name.endsWith('.html')) out.push(path.relative(root, full).split(path.sep).join('/'))
  }
  return out.sort()
}

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'),
    (route) => route.abort()
  )
})

for (const rel of listPages()) {
  test(`no horizontal overflow: ${rel}`, async ({ page }, testInfo) => {
    test.fail(KNOWN_OVERFLOW.has(`${testInfo.project.name}:${rel}`), 'known pre-existing overflow')
    await page.goto('/' + rel, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth, `page is ${scrollWidth}px wide in a ${innerWidth}px viewport`).toBeLessThanOrEqual(innerWidth + 1)
  })
}
