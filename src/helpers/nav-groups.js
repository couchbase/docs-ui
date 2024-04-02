'use strict'

module.exports = ({
  data: {
    root: { contentCatalog = { resolvePage: () => undefined }, site },
  },
}) => {
  let navGroups = site.keys.navGroups

  if (!navGroups) return []
  if (navGroups._compiled) return navGroups

  const components = site.components
  const componentNames = Object.keys(components)
  const claimed = []

  navGroups = JSON.parse(navGroups).map((navGroup) => {
    const componentNamesInGroup =
      (navGroup.components || []).flatMap(
        (componentName) => componentNames.filter(globbify(componentName)))

    claimed.push(...componentNamesInGroup)

    return compileNavGroup(
      navGroup,
      componentNamesInGroup,
      contentCatalog,
      components)
  })

  const orphaned = componentNames.filter((it) => !claimed.includes(it))

  if (orphaned.length) {
    const homeIdx = orphaned.indexOf('home')
    if (~homeIdx) {
      const home = orphaned.splice(homeIdx, 1)[0]
      const homeGroup = navGroups.find((it) => it.title === 'Home')
      homeGroup
        ? homeGroup.components.push(home)
        : navGroups.push(compileNavGroup({ title: 'Home' }, [home], contentCatalog, components))
    }
    if (orphaned.length) {
      const generalGroup = navGroups.find((it) => it.title === 'General')
      generalGroup
        ? generalGroup.components.push(...orphaned)
        : navGroups.push(compileNavGroup({ title: 'General' }, orphaned, contentCatalog, components))
    }
  }

  navGroups._compiled = true
  console.log(navGroups)

  site.keys.navGroups = navGroups
  return navGroups
}

function compileNavGroup (navGroup, componentNamesInGroup, contentCatalog, components) {
  let startPage = navGroup.startPage
  if (startPage) {
    startPage = contentCatalog.resolvePage(startPage)
    if (startPage) navGroup.url = startPage.pub.url
    delete navGroup.startPage
  }

  navGroup.components = componentNamesInGroup
  if (componentNamesInGroup.length) {
    navGroup.latestVersions = componentNamesInGroup.reduce((latestVersionMap, it) => {
      latestVersionMap[it] = components[it].latest.version
      return latestVersionMap
    }, {})
  }
  // if ((navGroup.url === page?.url) || componentNamesInGroup.includes(page.component.name)) {
  //   navGroup.selected = true
  // }
  return navGroup
}

function globbify (componentName) {
  const rx = new RegExp(`^${componentName.replace(/[*]/g, '.*?')}$`)
  return (it) => rx.test(it)
}
