;(function () {
  'use strict'

  // Carried forward from a search hit's link (see 13-docsearch.js) -- each
  // repeated param is one whole matched phrase, not the raw query, since
  // Algolia's typo-tolerance and stemming mean the literal query words
  // don't always appear verbatim on the page. Cleared from the URL below
  // so a refresh/back-forward doesn't keep re-triggering it.
  var url = new URL(window.location.href)
  var phrases = url.searchParams.getAll('highlight')
  if (!phrases.length) return
  url.searchParams.delete('highlight')
  window.history.replaceState(null, '', url.toString())

  var content = document.querySelector('.doc') || document.querySelector('main') || document.body

  // Mirrors asciidoctor-tabs' own activateTab (dist/js/tabs.js) just closely
  // enough to reveal one tab -- deliberately NOT calling tab.click() and
  // relying on that library's own listener: tabs.js loads via a separate
  // async script tag, so there's no guarantee it has run (and attached its
  // click listeners) by the time this does. A click with no listener
  // attached yet is silently a no-op. This also intentionally skips that
  // library's sync-storage write -- revealing a tab to show *this* search
  // result shouldn't overwrite the reader's actual site-wide tab
  // preference (e.g. "always show me Java"). Only called once
  // whenTabsReady below has confirmed tabs.js has already run, so the
  // aria-controls attribute it sets on each tab is guaranteed present here.
  function revealTab (tab) {
    var tabs = tab.closest('.tabs')
    if (!tabs) return
    var panel = document.getElementById(tab.getAttribute('aria-controls'))
    if (!panel) return
    tabs.querySelectorAll('.tablist .tab').forEach(function (t) {
      var selected = t === tab
      t.setAttribute('aria-selected', String(selected))
      t.classList.toggle('is-selected', selected)
      t.tabIndex = selected ? 0 : -1
    })
    tabs.querySelectorAll(':scope > .content > .tabpanel, :scope > .tabpanel').forEach(function (p) {
      var hide = p !== panel
      p.hidden = hide
      p.classList.toggle('is-hidden', hide)
    })
  }

  // Before tabs.js's own init() has run for a given .tabs block, NONE of
  // its tabpanels carry is-hidden/is-selected yet -- that state is only
  // ever applied by init() itself (defaulting to the first tab, or
  // whichever one sync storage prefers), at some point after this script
  // runs, since tabs.js loads via its own async script tag with no
  // ordering guarantee relative to this one. So checking "is this panel
  // currently hidden" here is meaningless -- it can easily still be
  // showing the pre-init unstyled default, about to be hidden moments
  // later. Each .tabs block carries an is-loading class (set at build
  // time) until init() finishes and removes it synchronously, so this
  // waits for that before ever asking whether a reveal is needed at all.
  function whenTabsReady (tabsEl) {
    return new Promise(function (resolve) {
      if (!tabsEl.classList.contains('is-loading')) return resolve()
      var finished = false
      var finish = function () {
        if (finished) return
        finished = true
        observer.disconnect()
        resolve()
      }
      var observer = new window.MutationObserver(function () {
        if (!tabsEl.classList.contains('is-loading')) finish()
      })
      observer.observe(tabsEl, { attributes: true, attributeFilter: ['class'] })
      // Safety net: proceed anyway if is-loading is somehow never cleared
      // (e.g. tabs.js failed to load), rather than waiting forever.
      window.setTimeout(finish, 3000)
    })
  }

  // A search hit can land inside an asciidoctor-tabs tabpanel that ends up
  // hidden (e.g. a ".NET"-specific code example on a page whose matched
  // heading sits above the tabset and is shared by every tab) -- the
  // library's own hash-based tab activation can't help here, since the
  // anchor it lands on isn't a tab itself. For every tabpanel ancestor
  // (walking outward, in case of nested tab sets), wait for that tab
  // block's own initial state to actually be settled, then reveal it only
  // if it isn't already the selected one. Returns a promise so callers can
  // wait for reveals that had to queue behind that.
  //
  // Finds the tab via the panel's own aria-labelledby, not the tab's
  // aria-controls -- aria-controls is only added by tabs.js's init() (see
  // above), so it may not exist yet at the point this runs; aria-labelledby
  // is baked into the page at build time and always there.
  function revealAncestorTabsIfNeeded (el) {
    var pending = []
    var node = el
    while (node) {
      if (node.classList && node.classList.contains('tabpanel')) {
        // const, not var: with more than one ancestor tabpanel (nested tab
        // sets), var here would let a later iteration overwrite the value
        // a still-pending .then() below captures, revealing the wrong tab.
        const tabId = (node.getAttribute('aria-labelledby') || '').split(/\s+/)[0]
        const tab = tabId && document.getElementById(tabId)
        const tabsEl = tab && tab.closest('.tabs')
        if (tab && tabsEl) {
          pending.push(whenTabsReady(tabsEl).then(function () {
            if (!tab.classList.contains('is-selected')) revealTab(tab)
          }))
        }
      }
      node = node.parentElement
    }
    return Promise.all(pending)
  }

  function afterMark () {
    var marks = content.querySelectorAll('mark')
    if (!marks.length) return
    Promise.all(Array.from(marks).map(revealAncestorTabsIfNeeded)).then(function () {
      // The browser's one-time native scroll-to-anchor (for the heading
      // fragment already on this URL) may have already run before any tab
      // was revealed, or the heading itself may be nowhere near the actual
      // match -- re-scroll to the first highlighted match specifically,
      // now that it's guaranteed visible.
      marks[0].scrollIntoView({ block: 'center' })
    })
  }

  function loadMarkJs (callback) {
    if (window.Mark) return callback()
    var siteCssLink = document.querySelector('link[href$="/css/site.css"]')
    if (!siteCssLink) return
    var script = document.createElement('script')
    script.src = siteCssLink.href.replace(/\/css\/site\.css.*$/, '') + '/js/vendor/mark.js'
    script.onload = callback
    document.head.appendChild(script)
  }

  // site.js (this script's own bundle) loads synchronously at the end of
  // the body with no async/defer, so the DOM is already fully parsed by
  // the time this runs -- no need to wait for DOMContentLoaded.
  loadMarkJs(function () {
    // separateWordSearch (mark.js's default) would treat each *word* in a
    // phrase as its own independent match -- exactly what lets a short,
    // common word match somewhere unrelated. acrossElements: true lets a
    // phrase still match if inline markup (a <code> span, emphasis, etc.)
    // splits it into more than one text node.
    new window.Mark(content).mark(phrases, {
      done: afterMark,
      separateWordSearch: false,
      acrossElements: true,
    })
  })
})()
