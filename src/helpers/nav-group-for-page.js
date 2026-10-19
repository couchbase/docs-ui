'use strict'

module.exports = (
  navGroups,
  {
    data: {
      root: { page, site },
    },
  }
) => {
  const pageUrl = page.url

  const subGroups = navGroups.flatMap(({ subGroups, title }) => {
    return (subGroups || []).map((sg) => {
      return { ...sg, parent: title }
    })
  })

  const navGroupsAndSubgroups = [...navGroups, ...subGroups]

  // a parent group without components (e.g. Server) shares its startPage with
  // a subgroup (e.g. Self-Managed Server) that does have them; prefer the latter
  const groupsByUrl = navGroupsAndSubgroups.filter(({ url }) => url === pageUrl)
  const navGroupByUrl =
    groupsByUrl.find(({ components }) => components && components.length) || groupsByUrl[0]

  if (navGroupByUrl) {
    return navGroupByUrl
  }

  const pageComponentName = page.component.name
  if (pageComponentName === 'home' && page.module !== 'contribute') {
    return
  }

  return navGroupsAndSubgroups.find(
    ({ components }) => ~components.indexOf(pageComponentName))
}
