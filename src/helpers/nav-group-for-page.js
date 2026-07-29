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

  const navGroupByUrl =
    navGroupsAndSubgroups.find(({ url }) => url === pageUrl)

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
