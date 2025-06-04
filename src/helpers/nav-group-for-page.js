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

  const navGroupsAndSubgroups = [
    ...navGroups,
    ...navGroups.flatMap(({ subGroups }) => subGroups || [])]

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
