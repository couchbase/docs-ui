'use strict'

module.exports = ({
  data: {
    root: { contentCatalog = { resolvePage: () => undefined }, site },
  },
}) => {
  let navGroups = site.keys.navGroups

  if (!navGroups) return []
  if (navGroups._compiled) return navGroups
  navGroups = JSON.parse(navGroups)

  const components = site.components
  const componentNames = Object.keys(components)
  const claimed = [] // mutable array to track claimed components

  function processNavGroup (navGroup) {
    const componentNamesInGroup =
      (navGroup.components || []).flatMap(
        // componentNamesInGroup can be a name like 'couchbase-lite'
        // or a glob pattern like '*-sdk'
        (componentName) => componentNames.filter(globbify(componentName)))

    claimed.push(...componentNamesInGroup)

    const navSubgroups = navGroup.subGroups?.map(processNavGroup)
    if (navSubgroups) {
      navGroup.subGroups = navSubgroups
      console.log(navSubgroups)
    }

    return compileNavGroup(
      navGroup,
      componentNamesInGroup,
      contentCatalog,
      components)
  }

  navGroups = navGroups.map(processNavGroup)
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
  return navGroup
}

function globbify (componentName) {
  const rx = new RegExp(`^${componentName.replace(/[*]/g, '.*?')}$`)
  return (it) => rx.test(it)
}
