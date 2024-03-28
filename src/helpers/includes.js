'use strict'

module.exports = (haystack, needle) => {
  return ~(haystack || '').indexOf(needle)
}
