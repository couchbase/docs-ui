;(function () {
  'use strict'

  // NOTE: instantsearch.js's widgets/index re-exports every widget (including
  // ones we never use, like chat/autocomplete), and Browserify has no
  // tree-shaking, so it bundles their entire dependency tree regardless --
  // which pulls in react's dev build, whose top-level code reads
  // process.env.NODE_ENV unguarded. A `window.process` shim can't be added
  // *here*: this bundle goes through browser-pack-flat (like every vendor
  // bundle, see gulp.d/tasks/build.js), which hoists leaf dependencies with
  // no requires of their own above the entry file's own code in the
  // flattened output -- so react's top-level code can run before anything
  // written in this file, regardless of source order. The shim lives in
  // footer-scripts.hbs instead, as a separate script tag before this one.

  // Thin on purpose: this file's only job is to make Algolia's own client
  // libraries available as globals for 13-docsearch.js (a plain concatenated
  // script, so it can't require() npm packages itself). All Couchbase-specific
  // search behavior lives in 13-docsearch.js, not here.
  window.algoliasearch = require('algoliasearch/lite')
  window.instantsearch = require('instantsearch.js').default
})()
