;(function () {
  'use strict'

  // The header is position: fixed and everything below it (content, side navs, anchor offsets) is positioned from
  // --height-to-body. The header's height is not constant: its nav items and top bar wrap at some widths, making it
  // taller than the CSS default. Follow its real height when (and only when) it exceeds the default, so widths where
  // it fits are untouched.
  var header = document.querySelector('header.header')
  if (!header || !window.ResizeObserver) return

  var root = document.documentElement
  var probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position: absolute; visibility: hidden; pointer-events: none; height: var(--height-to-body)'
  root.appendChild(probe)

  function sync () {
    root.style.removeProperty('--height-to-body')
    var cssDefault = probe.getBoundingClientRect().height
    var actual = header.getBoundingClientRect().height
    if (actual > cssDefault + 2) root.style.setProperty('--height-to-body', actual + 'px')
  }

  sync()
  new window.ResizeObserver(sync).observe(header)
})()
