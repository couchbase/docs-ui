;(function () {
  'use strict'

  var nav = document.querySelector('.nav')
  var menuExpandToggle = nav && nav.querySelector('.menu-expand-toggle')
  if (menuExpandToggle) {
    menuExpandToggle.addEventListener('click', function (e) {
      e.preventDefault()
      nav.classList.toggle('collapse-menu')
    })
  }

  var navContainer = document.querySelector('.nav-container')
  if (!navContainer) return
  if (!navContainer.querySelector('.components')) {
    if (!window.siteNavigationData) return
    var siteNavigationData = window.siteNavigationData.reduce(function (accum, entry) {
      return (accum[entry.name] = entry) && accum
    }, {})
    var pageVersions = document.getElementById('page-versions')
    var pageNavigationGroup = document.getElementById('page-navigation-group')
    if (!pageNavigationGroup) return
    buildNav(
      navContainer,
      getPage(),
      pageVersions,
      JSON.parse(pageNavigationGroup.innerText),
      siteNavigationData
    )
  }
  activateNav(navContainer, getPage())

  function getPage () {
    var head = document.head
    return {
      component: head.querySelector('meta[name="dcterms.subject"]').getAttribute('content'),
      version: head.querySelector('meta[name="dcterms.identifier"]').getAttribute('content'),
      url: head.querySelector('meta[name=page-url]').getAttribute('content'),
    }
  }

  function buildNav (container, page, pageVersions, group, navData) {
    var groupEl = createElement('div', 'components is-revealed')
    var singleComponent
    if (
      group.components.length === 1 &&
      group.title === navData[group.components[0]].title.replace(/^Couchbase | Database$/, '')
    ) {
      singleComponent = true
    } else {
      var groupNameEl = createElement('div', 'components_group-title')
      if (group.url) {
        var groupLinkEl = createElement('a')
        groupLinkEl.href = relativize(page.url, group.url)
        groupLinkEl.appendChild(document.createTextNode(group.title))
        groupNameEl.appendChild(groupLinkEl)
      } else {
        groupNameEl.appendChild(document.createTextNode(group.title))
      }
      groupEl.appendChild(groupNameEl)
    }
    var componentsListEl = createElement('ul', 'components_list')
    group.components.forEach(function (componentName) {
      var componentNavData = navData[componentName]
      var hasNavTrees
      var componentsListItemsEl = createElement('li', 'components_list-items')
      // FIXME we would prefer if the navigation data identified the latest version itself
      var selectedVersion = componentName === page.component ? page.version : group.latestVersions[componentName]
      var componentVersionsEl = createElement('div', 'component_list-version')
      var componentTitleEl = createElement('span', 'component_list_title')
      componentTitleEl.appendChild(document.createTextNode(componentNavData.title))
      componentVersionsEl.appendChild(componentTitleEl)
      var versioned
      if ((versioned = selectedVersion && selectedVersion !== 'master')) {
        var componentVersionSelectEl
        if (componentName === page.component) {
          componentVersionSelectEl = pageVersions.content.querySelector('.version_list')
        } else {
          componentVersionSelectEl = createElement('select', 'version_list')
          componentNavData.versions.forEach(function (componentVersion) {
            var optionEl = createElement('option')
            optionEl.value = componentVersion.version
            if (componentVersion.version === selectedVersion) optionEl.setAttribute('selected', '')
            optionEl.appendChild(document.createTextNode(componentVersion.displayVersion || componentVersion.version))
            componentVersionSelectEl.appendChild(optionEl)
          })
        }
        componentVersionsEl.appendChild(componentVersionSelectEl)
      }
      componentsListItemsEl.appendChild(componentVersionsEl)
      componentNavData.versions.forEach(function (componentVersion, idx) {
        var componentVersionNavEl = createElement('div', 'version_items')
        componentVersionNavEl.dataset.version = componentVersion.version
        // TODO only open manually after building nav tree if current page is not found
        var startCollapsed = true
        if (
          (page.component === componentName && page.version === componentVersion.version) ||
          (singleComponent && (!versioned || componentVersion.version === selectedVersion))
        ) {
          startCollapsed = false
        }
        if (startCollapsed) componentVersionNavEl.classList.add('hide')
        var items = componentVersion.sets
        if (items.length === 1 && !items[0].content) items = items[0].items
        if (items.length && items[0].content.endsWith(' Home')) {
          items.splice.apply(items, [0, 1].concat(items[0].items || []))
        }
        if (buildNavTree(items, componentVersionNavEl, page, [])) hasNavTrees = true
        componentsListItemsEl.appendChild(componentVersionNavEl)
      })
      if (hasNavTrees) componentsListEl.appendChild(componentsListItemsEl)
    })
    groupEl.appendChild(componentsListEl)
    container.appendChild(groupEl)
  }

  function buildNavTree (items, parent, page, currentPath) {
    if (!(items || []).length) return
    var navListEl = createElement('ul', 'menu_row')
    currentPath = currentPath.concat(navListEl)
    items.forEach(function (item) {
      if (item.content == null && item.items.length === 1) item = item.items[0]
      var navItemEl = createElement('li', 'menu_list')
      navItemEl.dataset.depth = currentPath.length - 1
      var navLineEl = createElement('span', 'menu_line')
      var navTextEl
      if (item.url) {
        navTextEl = createElement('a', 'menu_title menu_link')
        navTextEl.href = relativize(page.url, item.url)
        if (page.url === item.url) {
          navItemEl.classList.add('is-current-page')
          navTextEl.classList.add('is-current-page')
        }
      } else {
        navTextEl = createElement('span', 'menu_title menu_text')
      }
      navTextEl.innerHTML = item.content || ''
      navLineEl.appendChild(navTextEl)
      navItemEl.appendChild(navLineEl)
      var childNavListEl = buildNavTree(item.items, navItemEl, page, currentPath)
      if (childNavListEl) {
        if (currentPath.length > 1) {
          navLineEl.insertBefore(Object.assign(document.createElement('span'), { className: 'in-toggle' }), navTextEl)
        }
        navItemEl.classList.add('is-parent')
        if (!navItemEl.querySelector('a.is-current-page')) navItemEl.classList.add('closed')
      }
      navListEl.appendChild(navItemEl)
    })
    return parent.appendChild(navListEl)
  }

  function relativize (from, to) {
    if (!(from && to.charAt() === '/')) return to
    var hash = ''
    var hashIdx = to.indexOf('#')
    if (~hashIdx) {
      hash = to.substr(hashIdx)
      to = to.substr(0, hashIdx)
    }
    if (from === to) {
      return hash || (to.charAt(to.length - 1) === '/' ? './' : to.substr(to.lastIndexOf('/') + 1))
    } else {
      return (
        (computeRelativePath(from.slice(0, from.lastIndexOf('/')), to) || '.') +
        (to.charAt(to.length - 1) === '/' ? '/' + hash : hash)
      )
    }
  }

  function computeRelativePath (from, to) {
    var fromParts = trimArray(from.split('/'))
    var toParts = trimArray(to.split('/'))
    for (var i = 0, l = Math.min(fromParts.length, toParts.length), sharedPathLength = l; i < l; i++) {
      if (fromParts[i] !== toParts[i]) {
        sharedPathLength = i
        break
      }
    }
    var outputParts = []
    for (var remain = fromParts.length - sharedPathLength; remain > 0; remain--) outputParts.push('..')
    return outputParts.concat(toParts.slice(sharedPathLength)).join('/')
  }

  function trimArray (arr) {
    var start = 0
    var length = arr.length
    for (; start < length; start++) {
      if (arr[start]) break
    }
    if (start === length) return []
    for (var end = length; end > 0; end--) {
      if (arr[end - 1]) break
    }
    return arr.slice(start, end)
  }

  function createElement (tagName, className) {
    var el = document.createElement(tagName)
    if (className) el.className = className
    return el
  }

  function find (selector, from) {
    return [].slice.call((from || document).querySelectorAll(selector))
  }

  function findAncestorWithClass (className, from, scope) {
    if ((from = from.parentNode) === scope) return
    return from.classList.contains(className) ? from : findAncestorWithClass(className, from, scope)
  }

  // FIXME integrate into nav builder
  function activateNav (container, page) {
    // NOTE prevent text from being selected by double click
    container.addEventListener('mousedown', function (e) {
      if (e.detail > 1 && window.getComputedStyle(e.target).cursor === 'pointer') e.preventDefault()
    })

    var components = container.querySelector('.components')

    scrollItemToMidpoint(components, container.querySelector('a.is-current-page'))

    if (!components.classList.contains('is-revealed')) {
      find('a.is-current-page', container).forEach(function (currentPage) {
        var menuList = findAncestorWithClass('menu_list', currentPage, container)
        if (menuList.classList.contains('is-parent')) menuList.classList.remove('closed')
        var ancestor = currentPage
        while ((ancestor = ancestor.parentNode) && ancestor !== container) {
          ancestor.classList.remove(ancestor.classList.contains('hide') ? 'hide' : 'closed')
        }
      })
      components.classList.add('is-revealed')
    }

    find('.component_list_title', container).forEach(function (componentTitleEl) {
      componentTitleEl.style.cursor = 'pointer'
      componentTitleEl.addEventListener('click', function () {
        var versionEl = componentTitleEl.parentNode
        var componentVersionEl = versionEl.parentNode
        var componentVersionSelectEl = componentVersionEl.querySelector('.version_list')
        if (componentVersionSelectEl) {
          var activeVersionEl = componentVersionEl.querySelector('.version_items:not(.hide)')
          if (activeVersionEl) {
            activeVersionEl.classList.add('hide')
          } else {
            var activateVersionEl = componentVersionEl.querySelector(
              '.version_items[data-version="' + componentVersionSelectEl.value + '"]'
            )
            if (activateVersionEl) activateVersionEl.classList.remove('hide')
          }
        } else {
          componentVersionEl.querySelector('.version_items').classList.toggle('hide')
        }
      })
    })

    find('.menu_title', container).forEach(function (menuTitleEl) {
      var menuList = findAncestorWithClass('menu_list', menuTitleEl, container)
      if (!menuList.classList.contains('is-parent') || menuTitleEl.href) return
      menuTitleEl.style.cursor = 'pointer'
      menuTitleEl.addEventListener('click', function (e) {
        menuList.classList.toggle('closed')
      })
    })

    find('.version_list', container).forEach(function (versionListEl) {
      versionListEl.addEventListener('change', function () {
        if (versionListEl.dataset.component === page.component) {
          var selection = versionListEl.options[versionListEl.selectedIndex]
          if (selection.dataset.url) {
            window.location.href = selection.dataset.url
            return
          }
        }
        var componentVersionEl = versionListEl.parentNode.parentNode
        var activeVersionEl = componentVersionEl.querySelector('.version_items:not(.hide)')
        if (activeVersionEl) activeVersionEl.classList.add('hide')
        var activateVersionEl = componentVersionEl.querySelector(
          '.version_items[data-version="' + versionListEl.value + '"]'
        )
        if (activateVersionEl) activateVersionEl.classList.remove('hide')
      })
    })

    find('.in-toggle', container).forEach(function (btn) {
      var navItem = findAncestorWithClass('is-parent', btn, container)
      btn.addEventListener('click', function () {
        navItem.classList.toggle('closed')
      })
    })
  }

  function scrollItemToMidpoint (panel, link) {
    if (!link) return
    var panelRect = panel.getBoundingClientRect()
    if (panel.scrollHeight === Math.round(panelRect.height)) return // not scrollable
    var linkRect = link.getBoundingClientRect()
    panel.scrollTop += Math.round(linkRect.top - panelRect.top - (panelRect.height - linkRect.height) * 0.5)
  }
})()
