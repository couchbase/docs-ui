;(function () {
  'use strict'
  // NOTE: v4-shims are required to support the output of the icon macro generated from AsciiDoc content
  require('@fortawesome/fontawesome-free/js/v4-shims')
  var fa = require('@fortawesome/fontawesome-svg-core')

  ;(window.FontAwesomeIconDefs || []).forEach(function (faIconDef) {
    fa.library.add(faIconDef)
  })

  fa.dom.i2svg()

  // i2svg() above only converts <i class="fas ..."> elements present in the
  // DOM right now -- it's a one-shot scan, not a MutationObserver, so it
  // never sees icons added later by JS (e.g. the chatbot's feedback
  // buttons). Expose fa.icon() itself for that case: it renders directly
  // from the icon library (already populated by the loop above) without
  // needing the element in the DOM first. The icon must still be one of the
  // defs built into fontawesome-icon-defs.js -- add it to that file's
  // `iconNames` passthrough comment if it's only ever used dynamically.
  window.CouchbaseFontAwesome = {
    iconHtml: function (prefix, iconName) {
      var result = fa.icon({ prefix: prefix, iconName: iconName })
      return result ? result.html.join('') : ''
    },
  }

  delete window.___FONT_AWESOME___
  delete window.FontAwesomeIconDefs
})()
