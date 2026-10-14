;(function () {
  'use strict'

  // Thin on purpose, same reasoning as algolia.bundle.js/mark.bundle.js: this
  // file's only job is to make marked + DOMPurify available as globals for
  // 12-chatbox-render.js (a plain concatenated script, so it can't require()
  // npm packages itself). All Couchbase-specific chat rendering behavior
  // lives in 12-chatbox-render.js, not here.
  window.marked = require('marked')
  window.DOMPurify = require('dompurify')
})()
