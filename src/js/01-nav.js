;(function () {
  'use strict'

  // the .nav and .footer areas get classes added when the nav menu is toggled (for narrow widths)
  var nav = document.querySelector('.nav')
  var menuExpandToggle = nav && nav.querySelector('.menu-expand-toggle')
  var footer = document.querySelector('.footer')

  if (menuExpandToggle) {
    menuExpandToggle.addEventListener('click', function (e) {
      e.preventDefault()
      nav.classList.toggle('collapse-menu')
      footer.classList.toggle('remove-margin')
    })
  }

  var navContainer = document.querySelector('.nav-container')
  if (!navContainer) {
    footer.classList.toggle('remove-margin')
    return
  }

  // buildNav creates .components
  // Presumably this routine may be called multiple times, so we check if the div already exists before calling it.
  if (!navContainer.querySelector('.components')) {
    // EXIT early if we don't have siteNavigationData or pageNavigationGroup

    // window.siteNavigationData is set in site-navigation-data.js (which is generated by... standard Antora..?)
    if (!window.siteNavigationData) { return }
    // example:
    //   siteNavigationData = [{
    //     name: "dotnet-sdk",
    //     title: ".NET SDK",
    //     versions: [{
    //         version: "3.4",
    //         sets: [{
    //             content: "Getting Started",
    //             items: [{ ...

    // pageNavigationGroup is a <script> that contains JSON of the selected nav group from antora-playbook.yml
    // site.keys.nav_groups
    var pageNavigationGroup = document.getElementById('page-navigation-group')
    if (!pageNavigationGroup) { return }
    // example: (for a mobile page)
    //    {"title":"Mobile", "components":["couchbase-lite","sync-gateway"],
    //     "url":"/home/mobile.html", "latestVersions":{"couchbase-lite":"3.1","sync-gateway":"3.1"}}

    // turn the data structure from a list of objects to a dictionary keyed by `name`
    // Equivalent to `siteNavigationData = Object.fromEntries(window.siteNavigationData.map(e => [e.name, e]));`
    var siteNavigationData = window.siteNavigationData.reduce(
      function (accum, entry) {
        return (accum[entry.name] = entry) && accum
      }, {})

    var pageVersions = document.getElementById('page-versions')

    buildNav(
      navContainer, // container
      getPage(), // page
      pageVersions, // pageVersions
      JSON.parse(pageNavigationGroup.innerText), //group
      siteNavigationData // navData
    )
  } // else Presumably Components already/now exist

  activateNav(navContainer, getPage())

  ///////
  // Helper functions
  ///////

  // Returns an object with attributes extracted from Meta
  function getPage () {
    var head = document.head
    return {
      component: head.querySelector('meta[name="dcterms.subject"]').getAttribute('content'),
      version: head.querySelector('meta[name="dcterms.identifier"]').getAttribute('content'),
      url: head.querySelector('meta[name=page-url]').getAttribute('content'),
      navHeaderLevels: head.querySelector('meta[name="page-nav-header-levels"]')?.content || 0,
    }
  }

  function buildNav (container, page, pageVersions, group, navData) {
    // create the .components div
    var groupEl = createElement('div', 'components is-revealed')
    var singleComponent = (
      group.components.length === 1 &&
      group.title === navData[group.components[0]].title.replace(/^Couchbase | Database$/, '')
      // HC the .replace appears to be unnecessary?
    )

    if (!singleComponent) {
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

    // for each group component, create
    /*
<.navContainer> container
  <div.components.is-revealed> groupEl (via buildNav)
    <ul.components_list> componentsListEl
      <li.components_list-items> componentsListItemsEl (if hasNavTrees)
        <div.component_list-version> componentVersionsEl
          <span.component_list_title> componentTitleEl
            "{component title}"
          <select.version_list> componentVersionSelectEl (may already exist)
            <option .selected? value="{version}"> OptionEl
              "{component displayVersion | version}"
            ...
        <div .version_items .hide? data-version="{version}"> componentVersionNavEl
            <ul.menu_row> navListEl (via buildNavTree)
              <li.menu_list .is-current-page? .is-parent? .closed? data-depth="0+"> navItemEl
                <span.menu_line> navLineEl
                  ?<span.in-toggle>
                  <a|span.menu_title.menu_link .is-current-page? href="{relativize...}"> navTextEl
                <ul> childNavListEl (via recursive buildNavTree)
                  .....
    */
    group.components.forEach(function (componentName) {
      var componentNavData = navData[componentName]
      var componentsListItemsEl = createElement('li', 'components_list-items')

      // FIXME we would prefer if the navigation data identified the latest version itself
      var selectedVersion = componentName === page.component ? page.version : group.latestVersions[componentName]
      var componentVersionsEl = createElement('div', 'component_list-version')
      var componentTitleEl = createElement('span', 'component_list_title')
      componentTitleEl.appendChild(document.createTextNode(componentNavData.title))
      componentVersionsEl.appendChild(componentTitleEl)

      var versioned = componentNavData.versions.length > 1
      // var versioned = selectedVersion && selectedVersion !== 'master'

      if (versioned) {
        var componentVersionSelectEl
        if (componentName === page.component && pageVersions) {
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

      var hasNavTrees
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

        if (startCollapsed) { componentVersionNavEl.classList.add('hide') }

        // create `items` to pass to build to buildNavTree
        var items = componentVersion.sets
        if (items.length === 1 && !items[0].content) {
          items = items[0].items
        }
        if (items.length && items[0].content && items[0].content.endsWith(' Home')) {
          items.splice.apply(items, [0, 1].concat(items[0].items || []))
        }
        // build the navTree.
        // At least one of these componentVersions must return a navTree in order for us to
        // use this componentVersionNavEl
        if (buildNavTree(items, componentVersionNavEl, page, [])) {
          hasNavTrees = true
        }

        componentsListItemsEl.appendChild(componentVersionNavEl)
      })

      if (hasNavTrees) { componentsListEl.appendChild(componentsListItemsEl) }
    })
    groupEl.appendChild(componentsListEl)
    container.appendChild(groupEl)
  }

  function buildNavTree (items, parent, page, currentPath) {
    if (!(items || []).length) return

    var navListEl = createElement('ul', 'menu_row')
    currentPath = currentPath.concat(navListEl)

    items.forEach(function (item) {
      if (item.content == null && item.items.length === 1) {
        item = item.items[0]
      }
      var navItemEl = createElement('li', 'menu_list')
      navItemEl.dataset.depth = currentPath.length - 1
      var navLineEl = createElement('span', 'menu_line')
      var navTextEl
      if (item.url) {
        navTextEl = createElement('a', 'menu_title menu_link')
        navTextEl.href = relativize(page.url, item.url)
        if (page.url === item.url) {
          navItemEl.classList.add('is-current-page')
          navTextEl.classList.add('is-current-page', 'is-initial-page')
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

        // Depending on depth, we may wish to collapse the level.
        // originally we would collapse everything, but we can set :page-nav-header-levels: 1 to have
        // up to the bold subheadings kept open
        if (currentPath.length > page.navHeaderLevels) {
          if (!navItemEl.querySelector('a.is-current-page')) {
            navItemEl.classList.add('closed')
          }
        }
      }
      navListEl.appendChild(navItemEl)
    })
    return parent.appendChild(navListEl)
  }

  function onHashChange () {
    var navLink
    var hash = window.location.hash
    if (hash) {
      if (hash.indexOf('%')) hash = decodeURIComponent(hash)
      navLink = navContainer.querySelector('a.menu_link[href="' + hash + '"]')
    }
    if (!(navLink || (navLink = navContainer.querySelector('a.is-initial-page')))) return
    var currentPageLink = navContainer.querySelector('a.is-current-page')
    if (navLink === currentPageLink) return
    if (currentPageLink) toggleCurrentPath(navContainer, currentPageLink, 'clear')
    toggleCurrentPath(navContainer, navLink, 'activate')
    scrollItemToMidpoint(nav.querySelector('.components'), navLink)
    return true
  }

  function toggleCurrentPath (container, navLink, operation) {
    navLink.classList[operation === 'clear' ? 'remove' : 'add']('is-current-page')
    var navItem = navLink.parentNode.parentNode
    var ancestor = navLink.parentNode
    while (ancestor !== container) {
      if (ancestor.tagName === 'LI') {
        var ancestorClassList = ancestor.classList
        if (ancestor === navItem) {
          ancestorClassList[operation === 'clear' ? 'remove' : 'add']('is-current-page')
        } else if (ancestorClassList.contains('is-parent')) {
          ancestorClassList[operation === 'clear' ? 'add' : 'remove']('closed')
        }
      }
      ancestor = ancestor.parentNode
    }
  }

  function relativize (from, to) {
    if (!(from && to.charAt() === '/')) { return to }
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

    let scrolled
    if (container.querySelector('a.menu_link[href^="#"]')) {
      window.location.hash && (scrolled = onHashChange())
      window.addEventListener('hashchange', onHashChange)
    }
    scrolled || scrollItemToMidpoint(components, container.querySelector('a.is-current-page'))

    if (!components.classList.contains('is-revealed')) {
      find('a.is-current-page', container).forEach(function (currentPage) {
        var menuList = findAncestorWithClass('menu_list', currentPage, container)
        if (menuList.classList.contains('is-parent')) {
          menuList.classList.remove('closed')
        }
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
      if (menuList.dataset.depth < page.navHeaderLevels) {
        return
      }

      menuTitleEl.style.cursor = 'pointer'
      menuTitleEl.addEventListener('click', function (e) {
        menuList.classList.toggle('closed')
      })
    })

    find('.version_list', container).forEach(function (versionListEl) {
      versionListEl.addEventListener('change', function () {
        if (versionListEl.dataset.component === page.component) {
          var selection = versionListEl.options[versionListEl.selectedIndex]
          var selectionUrl = selection.dataset.url
          if (selectionUrl) {
            window.location.href = selectionUrl + (selectionUrl.startsWith('#') ? '' : window.location.hash)
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
