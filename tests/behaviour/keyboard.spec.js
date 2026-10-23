'use strict'

// Keyboard and assistive-technology behaviour that screenshots and axe cannot judge: that things can be reached and
// operated from the keyboard, that focus is visible, and that toggles report their state.

const { test, expect } = require('@playwright/test')

const DOC = 'fixtures/pages/sdk-howto.html'

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'),
    (route) => route.abort()
  )
})

test('the first Tab stop is a visible skip link that moves focus to the main content', async ({ page }) => {
  await page.goto('/' + DOC, { waitUntil: 'load' })
  await page.keyboard.press('Tab')
  const skip = page.locator('.skip-link')
  await expect(skip).toBeFocused()
  // any transition on the link must have finished before it counts as visible
  await expect.poll(async () => (await skip.boundingBox()).y, { message: 'skip link is off-screen when focused' }).toBeGreaterThanOrEqual(0)
  const box = await skip.boundingBox()
  expect(box.y + box.height).toBeLessThan(200)
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  expect(new URL(page.url()).hash).toBe('#main-content')
})

test('keyboard focus is visibly indicated on links and buttons', async ({ page }) => {
  await page.goto('/' + DOC, { waitUntil: 'load' })
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement
      const cs = window.getComputedStyle(el)
      return { tag: el.tagName, cls: el.className, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }
    })
    expect(outline.style, `no focus outline on <${outline.tag} class="${outline.cls}">`).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  }
})

test('the copy button is a real button, operable by keyboard, and announces the result', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/' + DOC, { waitUntil: 'load' })
  const copy = page.locator('button.copy-code-button').first()
  await expect(copy).toHaveAttribute('aria-label', 'Copy code to clipboard')
  await copy.focus()
  await page.keyboard.press('Enter')
  await expect(copy.locator('xpath=following-sibling::*[@role="status"]')).toHaveText('Copied to clipboard')
  await expect(copy, 'keyboard users keep their focus after copying').toBeFocused()
})

test('landmarks are labelled and every page has one main region', async ({ page }) => {
  await page.goto('/' + DOC, { waitUntil: 'load' })
  await expect(page.locator('main, [role="main"]')).toHaveCount(1)
  const labels = await page.$$eval('nav[aria-label], aside[aria-label]', (els) => els.map((e) => e.getAttribute('aria-label')))
  expect(labels).toEqual(expect.arrayContaining(['Couchbase', 'Documentation sections', 'Documentation', 'On this page']))
  await expect(page.locator('select.version_list[aria-label="Version"]').first()).toBeAttached()
})

test('the navigation toggle reports and updates its expanded state', async ({ page }) => {
  await page.goto('/' + DOC, { waitUntil: 'load' })
  const toggle = page.locator('nav.nav .menu-expand-toggle')
  const before = await toggle.getAttribute('aria-expanded')
  await toggle.focus()
  await page.keyboard.press('Space')
  const after = await toggle.getAttribute('aria-expanded')
  expect(['true', 'false']).toContain(before)
  expect(after).not.toBe(before)
})

test('the mobile menu button reports its state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'behaviour-mobile', 'the burger is only shown on small screens')
  await page.goto('/' + DOC, { waitUntil: 'load' })
  const burger = page.locator('button.navbar-burger')
  await expect(burger).toHaveAttribute('aria-expanded', 'false')
  await burger.click()
  await expect(burger).toHaveAttribute('aria-expanded', 'true')
  await burger.click()
  await expect(burger).toHaveAttribute('aria-expanded', 'false')
})

test('code that scrolls sideways can be focused', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'behaviour-mobile', 'checked at the narrowest width, where code overflows')
  await page.goto('/' + DOC, { waitUntil: 'load' })
  await page.waitForTimeout(400)
  const result = await page.evaluate(() =>
    [...document.querySelectorAll('.doc pre, .doc pre > code')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(window.getComputedStyle(el).overflowX))
      .map((el) => el.getAttribute('tabindex'))
  )
  expect(result.length, 'no scrollable code found to check').toBeGreaterThan(0)
  result.forEach((tabindex) => expect(tabindex).toBe('0'))
})
