'use strict'

const shortNames = require('../data/component-short-names.json')

module.exports = (
  navGroups,
  {
    data: {
      root: { site },
    },
  }
) => {
  const components = site.components

  function serializeComponent (name) {
    const title = (components[name] && components[name].title) || name
    return {
      name,
      title,
      shortName: shortNames[name] || title,
    }
  }

  // color is only ever present on a top-level navGroup (set by hand in the
  // playbook) -- subGroups/components deliberately carry none of their own
  // here, and the client is what walks this tree inheriting a parent's color
  // down, same as this data looked when it was still a hand-maintained mock.
  function serializeGroup (group) {
    return {
      title: group.title,
      url: group.url,
      color: group.color,
      components: (group.components || []).map(serializeComponent),
      latestVersions: group.latestVersions,
      subGroups: group.subGroups ? group.subGroups.map(serializeGroup) : undefined,
    }
  }

  return { navGroups: navGroups.map(serializeGroup) }
}
