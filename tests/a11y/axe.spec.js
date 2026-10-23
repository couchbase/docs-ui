'use strict'

// Accessibility ratchet: runs axe-core on every preview page and compares the number of violating nodes per rule
// with tests/a11y/known-violations.json. The test fails if a page gets WORSE (a rule it did not violate, or more
// nodes than recorded), so accessibility cannot regress; improvements are locked in by re-recording:
//
//   A11Y_UPDATE=1 node scripts/visual-test.js --project=behaviour --grep axe
//
// This measures what axe can detect automatically (roughly a third of WCAG issues); it does not replace keyboard
// and screen-reader testing.

const { test, expect } = require('@playwright/test')
const AxeBuilder = require('@axe-core/playwright').default
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..', 'public')
const KNOWN = path.join(__dirname, 'known-violations.json')
const update = !!process.env.A11Y_UPDATE
const known = fs.existsSync(KNOWN) ? JSON.parse(fs.readFileSync(KNOWN, 'utf8')) : {}

if (update) test.describe.configure({ mode: 'serial' }) // tests write the shared file one at a time

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
  test(`axe: ${rel}`, async ({ page }) => {
    await page.goto('/' + rel, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()
    const found = {}
    violations.forEach((v) => (found[v.id] = v.nodes.length))

    if (update) {
      const current = fs.existsSync(KNOWN) ? JSON.parse(fs.readFileSync(KNOWN, 'utf8')) : {}
      current[rel] = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)))
      fs.writeFileSync(KNOWN, JSON.stringify(Object.fromEntries(Object.entries(current).sort()), null, 2) + '\n')
      return
    }

    const allowed = known[rel] || {}
    const worse = Object.entries(found)
      .filter(([rule, nodes]) => nodes > (allowed[rule] || 0))
      .map(([rule, nodes]) => `${rule}: ${nodes} nodes (recorded ${allowed[rule] || 0})`)
    const better = Object.entries(allowed)
      .filter(([rule, nodes]) => (found[rule] || 0) < nodes)
      .map(([rule, nodes]) => `${rule}: ${found[rule] || 0} (was ${nodes})`)
    if (better.length) test.info().annotations.push({ type: 'improved', description: better.join('; ') })
    expect(worse, `new or worse accessibility violations on ${rel}`).toEqual([])
  })
}
