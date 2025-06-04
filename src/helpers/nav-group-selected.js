'use strict'

module.exports = module.exports = (navGroup, {
  data: {
    root: { page, site },
  },
}) => {
  if (navGroup === 'home') {
    // FAKE value to signal that we instead check all the navgroups
    const navGroups = site.keys.navGroups
    // NB this relies on variable stored in site.keys, so must be called
    // *after* nav-groups has already prepared the data
    const possible = navGroups.filter((it) => selected(it, page))
    return possible.length === 1 && possible[0].title === 'Home'
  } else {
    return selected(navGroup, page)
  }
}

function selected (navGroup, page) {
  return (navGroup.url === page?.url) ||
    (navGroup.components?.includes(page.component?.name)) ||
    (navGroup.subGroups?.some((it) => selected(it, page)))
}
