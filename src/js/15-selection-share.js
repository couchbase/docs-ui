;(function () {
  'use strict'

  var doc = document.querySelector('.doc')
  if (!doc) return

  var popup = document.createElement('div')
  popup.className = 'selection-share-popup'
  popup.hidden = true

  var copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.className = 'selection-share-copy'
  copyButton.setAttribute('aria-label', 'Copy link to selection')
  copyButton.appendChild(document.createElement('i')).className = 'far fa-clipboard'
  var copyLabel = document.createElement('span')
  copyLabel.className = 'selection-share-copy-label'
  copyLabel.textContent = 'Copy link'
  copyButton.appendChild(copyLabel)
  popup.appendChild(copyButton)

  document.body.appendChild(popup)

  function hidePopup () {
    popup.hidden = true
  }

  // Falls back to whitespace alone if 14-search-highlight.js hasn't run yet
  // for some reason -- still catches the common case, just without the
  // extra punctuation boundaries that script's own matching also accepts.
  function isBoundaryChar (ch) {
    var highlight = window.CouchbaseSearchHighlight
    return highlight ? highlight.isBoundaryChar(ch) : /\s/.test(ch)
  }

  // The next/previous Text node in document order within `doc`, crossing
  // inline element boundaries (a <strong>, a <code> span) the same way
  // 14-search-highlight.js's own acrossElements matching does, so expanding
  // a selection edge and actually matching it afterward agree on where a
  // "word" is allowed to continue.
  function adjacentTextNode (node, forward) {
    var walker = document.createTreeWalker(doc, window.NodeFilter.SHOW_TEXT)
    walker.currentNode = node
    return forward ? walker.nextNode() : walker.previousNode()
  }

  // A drag or shift-click essentially never lands exactly on a word
  // boundary -- mark.js's own boundary check (see 14-search-highlight.js)
  // requires a genuine one at both ends of the phrase, so a selection that
  // starts or ends mid-word would otherwise silently fail to highlight at
  // all. Nudges each edge outward, one character at a time, until it lands
  // on a real boundary -- the same one matching itself will require.
  function expandEdge (node, offset, forward) {
    for (;;) {
      if (node.nodeType !== 3) return { node: node, offset: offset }
      var atEdgeOfNode = forward ? offset === node.textContent.length : offset === 0
      if (atEdgeOfNode) {
        var next = adjacentTextNode(node, forward)
        if (!next) return { node: node, offset: offset }
        node = next
        offset = forward ? 0 : node.textContent.length
        continue
      }
      var ch = node.textContent[forward ? offset : offset - 1]
      if (isBoundaryChar(ch)) return { node: node, offset: offset }
      offset += forward ? 1 : -1
    }
  }

  function expandToWordBoundaries (range) {
    var start = expandEdge(range.startContainer, range.startOffset, false)
    var end = expandEdge(range.endContainer, range.endOffset, true)
    var expanded = document.createRange()
    expanded.setStart(start.node, start.offset)
    expanded.setEnd(end.node, end.offset)
    return expanded
  }

  // Reads the CURRENT selection fresh rather than caching it from
  // selectionchange -- by the time the copy button is actually clicked, the
  // mousedown on the button itself may already have collapsed the visible
  // selection in some browsers, so this only trusts what's still selected
  // right now.
  function currentSelectionInfo () {
    var selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
    var rawRange = selection.getRangeAt(0)
    if (!doc.contains(rawRange.commonAncestorContainer)) return null
    if (!selection.toString().trim()) return null
    var range = expandToWordBoundaries(rawRange)
    var text = range.toString().trim()
    if (!text) return null
    return { text: text, range: range }
  }

  // AsciiDoc section ids live on the heading element itself, not on any
  // ancestor of the body text beneath it (a paragraph's own parents -- its
  // .sect2, .sectionbody, .sect1 wrappers -- carry no id at all), so
  // "nearest parent #id" really means "the last id-bearing element at or
  // before this point in document order", i.e. whichever heading governs
  // the section the selection falls in. compareDocumentPosition's FOLLOWING
  // bit is also set when the reference node is CONTAINED_BY the candidate
  // (e.g. a selection inside an admonition/example block that has its own
  // id), so one check covers both "id element precedes the selection" and
  // "selection is inside an id-bearing element".
  function findGoverningId (referenceNode) {
    var candidates = doc.querySelectorAll('[id]')
    var nearest = null
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i]
      if (el === referenceNode ||
          (el.compareDocumentPosition(referenceNode) & window.Node.DOCUMENT_POSITION_FOLLOWING)) {
        nearest = el
      }
    }
    return nearest ? nearest.id : null
  }

  // A selection spanning more than one paragraph/list item/etc. has a blank
  // (or, for a soft line break, single) line standing in for each block
  // boundary in selection.toString() -- there's no literal "\n" anywhere in
  // the real page for that to match against, since it's DOM structure, not
  // actual text. Collapsed to a single space instead: confirmed firsthand
  // that mark.js's acrossElements matching (see 14-search-highlight.js)
  // treats any run of whitespace as interchangeable with any other,
  // regardless of how many block-boundary text nodes actually separate the
  // two sides on the real page, so one normalized space reliably stands in
  // for the true gap whatever it turns out to be. A selection is always one
  // contiguous DOM range (there's no way to select two disjoint passages at
  // once), so treating the whole thing as a single phrase -- unlike
  // 13-docsearch.js's own several genuinely disjoint snippet phrases -- is
  // safe, and it's what lets acrossElements highlight the ENTIRE selection
  // in one match instead of just whichever fragment happens to be tried
  // first.
  function normalizedPhrase (text) {
    return text.replace(/\s+/g, ' ')
  }

  function buildShareUrl (text, id) {
    var url = new URL(window.location.href)
    url.searchParams.set('highlight', normalizedPhrase(text))
    url.hash = id ? '#' + id : ''
    return url.toString()
  }

  // True for a normal, forward ("reads the way English reads") drag, where
  // anchor (drag start) precedes focus (drag end) in document order; false
  // for one dragged backwards. Selection has no built-in way to ask this
  // directly.
  function isForwardSelection (selection) {
    if (selection.anchorNode === selection.focusNode) return selection.anchorOffset <= selection.focusOffset
    var position = selection.anchorNode.compareDocumentPosition(selection.focusNode)
    return Boolean(position & window.Node.DOCUMENT_POSITION_FOLLOWING)
  }

  // At the FOCUS end specifically -- the end the pointer is actually at,
  // not necessarily Range's own start/end (those are always in document
  // order, regardless of which way the drag ran). A reader selects the same
  // way they read, start to finish, so this is where their attention (and
  // pointer) already is; forcing them back up to the top of a multi-line
  // selection to find the popup would be backwards.
  //
  // Deliberately NOT a collapsed range built straight from focusNode/
  // focusOffset -- confirmed firsthand that a triple-click's whole-paragraph
  // selection sets focus to an ELEMENT-level boundary (container: the <p>,
  // offset: a child index) rather than a text-node offset, and
  // getBoundingClientRect() on a range collapsed at that kind of boundary
  // comes back an empty {0,0,0,0} rect -- which is what put the popup in a
  // corner of the screen instead of anywhere near the selection. The real
  // (non-collapsed) selection Range's own getClientRects() -- one rect per
  // rendered line -- always reflects genuine rendered content regardless of
  // how the boundary itself happens to be expressed, so the focus-side edge
  // of its first/last line is used as the point instead.
  function focusEdgeRect (selection) {
    var range = selection.getRangeAt(0)
    var rects = range.getClientRects()
    if (!rects.length) return range.getBoundingClientRect()
    var forward = isForwardSelection(selection)
    var lineRect = forward ? rects[rects.length - 1] : rects[0]
    var x = forward ? lineRect.right : lineRect.left
    return { top: lineRect.top, bottom: lineRect.bottom, left: x }
  }

  function positionPopup (selection) {
    popup.hidden = false
    var rect = focusEdgeRect(selection)
    var popupRect = popup.getBoundingClientRect()
    var top, left
    if (isForwardSelection(selection)) {
      // The standard case: a forward, left-to-right drag ends with the
      // pointer sitting just after the last selected character -- below
      // and to the right of it is where a reader's hand already is, and
      // doesn't sit back over text they've just read.
      top = rect.bottom + 8
      // Not enough room below (selection ends near the bottom of the
      // viewport) -- show the popup above instead, still right-anchored.
      if (top + popupRect.height > window.innerHeight - 8) top = rect.top - popupRect.height - 8
      left = rect.left
    } else {
      // A backward drag ends back near the START of the passage -- flush
      // right of that point would sit awkwardly out over the rest of the
      // selection, so this stays centered on it instead (falling back
      // below if there's no room above).
      top = rect.top - popupRect.height - 8
      if (top < 8) top = rect.bottom + 8
      left = rect.left - popupRect.width / 2
    }
    left = Math.min(Math.max(8, left), window.innerWidth - popupRect.width - 8)
    popup.style.top = window.scrollY + top + 'px'
    popup.style.left = window.scrollX + left + 'px'
  }

  // Pending "hide after showing Copied" timer (see copyAndHighlight) --
  // tracked so a fresh selection made before it fires can cancel it, rather
  // than having it hide the popup out from under an unrelated, later
  // selection.
  var copiedHideTimer = null
  function cancelCopiedHideTimer () {
    if (!copiedHideTimer) return
    window.clearTimeout(copiedHideTimer)
    copiedHideTimer = null
  }

  // Only on mouseup/keyup (a selection having just settled), not on every
  // selectionchange -- matches the Google Docs selection toolbar, which
  // stays out of the way while a drag (including a double-click-held,
  // word-by-word drag) is still in progress, rather than following the
  // pointer the whole time.
  function handleSelectionSettled () {
    var info = currentSelectionInfo()
    if (!info) return hidePopup()
    cancelCopiedHideTimer()
    // In case this selection is a NEW one made while an earlier "Copied ✓"
    // from a different selection is still showing (its own hide timer just
    // canceled above) -- without this it would carry over onto content that
    // was never actually copied.
    copyLabel.textContent = 'Copy link'
    positionPopup(window.getSelection())
  }

  document.addEventListener('mouseup', handleSelectionSettled)
  document.addEventListener('keyup', handleSelectionSettled)

  // Clicking anywhere normally collapses the current text selection on
  // mousedown, before the click event (and this button's own click handler,
  // which needs that selection still intact) ever fires.
  copyButton.addEventListener('mousedown', function (e) {
    e.preventDefault()
  })

  copyButton.addEventListener('click', function () {
    var info = currentSelectionInfo()
    if (!info) return
    var id = findGoverningId(info.range.startContainer)
    var url = buildShareUrl(info.text, id)
    navigator.clipboard.writeText(url).then(
      function () {
        copyLabel.textContent = 'Copied ✓'
        // The popup's whole job is done once this has been on screen a
        // moment -- it doesn't stay around as a re-clickable control (its
        // own next click would have nothing left to read anyway, since the
        // selection is cleared below).
        copiedHideTimer = window.setTimeout(function () {
          copiedHideTimer = null
          hidePopup()
          copyLabel.textContent = 'Copy link'
        }, 3000)
        // Reflects the copied link in the address bar without a real
        // navigation, then re-runs 14-search-highlight.js's own matching in
        // place -- a real page load isn't needed just to show the copier
        // what the recipient will see: matching/highlighting isn't
        // guaranteed for every possible selection (a tab label, a "Run
        // Code" button, that sort of UI chrome rather than body prose), and
        // this way that's visible instantly rather than after a reload.
        window.history.pushState(null, '', url)
        window.getSelection().removeAllRanges()
        if (window.CouchbaseSearchHighlight) {
          window.CouchbaseSearchHighlight.highlightPhrases([normalizedPhrase(info.text)], id)
        }
      },
      function () {
        copyLabel.textContent = 'Error'
      }
    )
  })
})()
