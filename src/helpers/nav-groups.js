'use strict'

module.exports = ({
  data: {
    root: { contentCatalog = { resolvePage: () => undefined }, site, page },
  },
}) => {
  let navGroups = site.keys.navGroups
  if (!navGroups) return []
  if (navGroups._compiled) return navGroups
  const components = site.components
  const componentNames = Object.keys(components)
  const claimed = []
  navGroups = JSON.parse(navGroups).reduce((accum, navGroup) => {
    const componentNamesInGroup = (navGroup.components || []).reduce((matched, componentName) => {
      if (~componentName.indexOf('*')) {
        const rx = new RegExp(`^${componentName.replace(/[*]/g, '.*?')}$`)
        return matched.concat(componentNames.filter((candidate) => rx.test(candidate)))
      } else if (componentName in components) {
        return matched.concat(componentName)
      }
      return matched
    }, [])
    claimed.push(...componentNamesInGroup)
    return accum.concat(compileNavGroup(navGroup, componentNamesInGroup, contentCatalog, components))
  }, [])
  const orphaned = componentNames.filter((it) => claimed.indexOf(it) < 0)
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
  console.log(page)
  return (site.keys.navGroups = navGroups)
}

function compileNavGroup (navGroup, componentNamesInGroup, contentCatalog, components) {
  navGroup.components = componentNamesInGroup
  let startPage = navGroup.startPage
  if (startPage) {
    startPage = contentCatalog.resolvePage(startPage)
    if (startPage) navGroup.url = startPage.pub.url
    delete navGroup.startPage
  }
  if (componentNamesInGroup.length) {
    navGroup.latestVersions = componentNamesInGroup.reduce((latestVersionMap, it) => {
      latestVersionMap[it] = components[it].latest.version
      return latestVersionMap
    }, {})
  }
  return navGroup
}
