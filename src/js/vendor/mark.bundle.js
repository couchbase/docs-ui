;(function () {
  'use strict'

  // Thin on purpose, same reasoning as algolia.bundle.js: this file's only
  // job is to make mark.js available as a global for 14-search-highlight.js
  // (loaded lazily, only on pages that actually need it -- see that file).
  // Previously this bundle also drove the tutorials-section filter UI
  // directly, but that feature is dead (tutorials moved to Developer
  // Advocacy) and its markup/gating has been removed alongside it.
  window.Mark = require('mark.js')
})()
