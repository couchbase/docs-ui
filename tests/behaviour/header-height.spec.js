'use strict'

// The header is position: fixed, and its height varies (the real header's nav items and top bar wrap at some
// widths). Everything below it, and the anchor offset, must follow the header's real height rather than a constant.
// The preview header has only two nav items and never wraps, so the test adds nav items like the real site's to
// force the wrap.

const { test, expect } = require('@playwright/test')

const REL = 'fixtures/pages/server-concept-deep-toc.html'
const WIDTHS = [1440, 1100, 1024, 800]

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'),
    (route) => route.abort()
  )
})

async function addNavItems (page) {
  await page.evaluate(() => {
    const list = document.querySelector('.navbar-new-bottom ul')
    const template = list.querySelector('.nav-item:not(:first-child)') || list.lastElementChild
    ;['Start Here', 'Capella', 'Mobile / Edge', 'Operational Insights', 'AI Data Plane'].forEach((label) => {
      const li = template.cloneNode(true)
      const a = li.querySelector('a')
      if (a) a.textContent = label
      li.classList.remove('nav-item-selected')
      list.appendChild(li)
    })
  })
  await page.waitForTimeout(300)
}

for (const width of WIDTHS) {
  test(`content and anchors clear the header at ${width}px even when it is taller than usual`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'behaviour', 'desktop header only')
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/' + REL, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await addNavItems(page)

    const layout = await page.evaluate(() => ({
      header: Math.round(document.querySelector('header.header').getBoundingClientRect().height),
      crumbs: Math.round(document.querySelector('.crumbs').getBoundingClientRect().top),
      nav: Math.round(document.querySelector('nav.nav .nav-container').getBoundingClientRect().top),
    }))
    expect(layout.crumbs, `breadcrumb starts at ${layout.crumbs}px under a ${layout.header}px header`).toBeGreaterThanOrEqual(layout.header - 1)
    expect(layout.nav, `left nav starts at ${layout.nav}px under a ${layout.header}px header`).toBeGreaterThanOrEqual(layout.header - 1)

    const id = await page.$$eval('main h2[id], main h3[id]', (hs) => hs[Math.floor(hs.length / 2)].id)
    await page.evaluate(async (id) => {
      window.location.hash = ''
      await new Promise((resolve) => setTimeout(resolve, 100))
      window.location.hash = '#' + id
      await new Promise((resolve) => setTimeout(resolve, 400))
    }, id)
    const anchor = await page.evaluate((id) => {
      const el = document.getElementById(id)
      const walker = document.createTreeWalker(el, window.NodeFilter.SHOW_TEXT)
      let node
      let top = el.getBoundingClientRect().top
      while ((node = walker.nextNode())) {
        if (node.textContent.trim()) {
          const range = document.createRange()
          range.selectNodeContents(node)
          top = range.getClientRects()[0].top
          break
        }
      }
      return { top, header: document.querySelector('header.header').getBoundingClientRect().bottom }
    }, id)
    expect(anchor.top, `anchored heading at ${anchor.top}px under a ${anchor.header}px header`).toBeGreaterThanOrEqual(anchor.header - 1)
  })
}
