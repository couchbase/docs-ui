'use strict'

// Anchor navigation with the fixed header: following #fragment links, on load and from the "On this page" TOC, must
// leave the target visible just below the header, and the TOC must highlight the matching entry. Screenshots cannot
// check this (they do not scroll), and it is what the scroll-padding / spacer machinery exists for.

const { test, expect } = require('@playwright/test')

const PAGES = [
  'fixtures/pages/server-concept-deep-toc.html',
  'fixtures/components/sg-admonitions.html',
  'fixtures/capella/capella-tutorial.html',
]

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'),
    (route) => route.abort()
  )
})

// waits until the page has stopped scrolling (smooth scrolling and script-driven scrolls take a moment)
async function settled (page) {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY))
    if (y === last) return
    last = y
    await page.waitForTimeout(150)
  }
}

// top edge of the target's first line of text, ignoring generated content (e.g. spacer pseudo-elements)
function measure (id) {
  const el = document.getElementById(id)
  const header = document.querySelector('header.header').getBoundingClientRect()
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
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  return { top, headerBottom: header.bottom, atEnd: window.scrollY >= maxScroll - 2 }
}

function expectBelowHeader ({ top, headerBottom, atEnd }, label) {
  expect(top, `${label}: heading text at ${top}px is hidden by the ${headerBottom}px header`).toBeGreaterThanOrEqual(headerBottom - 1)
  if (!atEnd) expect(top, `${label}: heading text at ${top}px is not near the top of the page`).toBeLessThanOrEqual(headerBottom + 160)
}

for (const rel of PAGES) {
  test(`following a #fragment on load lands below the header: ${rel}`, async ({ page }) => {
    await page.goto('/' + rel, { waitUntil: 'load' })
    const ids = await page.$$eval('main h2[id], main h3[id], main h4[id]', (hs) => hs.map((h) => h.id))
    expect(ids.length).toBeGreaterThan(3)
    const picks = [ids[1], ids[Math.floor(ids.length / 2)], ids[ids.length - 2]]
    for (const id of picks) {
      await page.goto(`/${rel}#${id}`, { waitUntil: 'load' })
      await settled(page)
      expectBelowHeader(await page.evaluate(measure, id), `#${id}`)
    }
  })

  test(`TOC links land below the header and the matching entry is highlighted: ${rel}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'behaviour-mobile', 'the On this page TOC is not shown on small screens')
    await page.goto('/' + rel, { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const hrefs = await page.$$eval('aside.toc a[href^="#"]', (as) =>
      as.map((a) => a.getAttribute('href')).filter((h) => h.length > 1)
    )
    expect(hrefs.length).toBeGreaterThan(3)
    for (const href of [hrefs[1], hrefs[Math.floor(hrefs.length / 2)]]) {
      await page.click(`aside.toc a[href="${href}"]`)
      await settled(page)
      const id = href.slice(1)
      expectBelowHeader(await page.evaluate(measure, id), href)
      const active = await page.$$eval('aside.toc a.is-active', (as) => as.map((a) => a.getAttribute('href')))
      expect(active, `TOC highlight after following ${href}`).toEqual([href])
    }
  })
}
