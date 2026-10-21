;(function () {
  'use strict'

  var sidebar = document.querySelector('aside.toc.sidebar')
  if (!sidebar) return

  if (document.querySelector('body.-toc')) {
    return // sidebar.parentNode.removeChild(sidebar)
    // sidebar is used for other purposes, so leave it
  }

  const DEFAULT_LEVEL = 1 // usually 2 in stock Antora, but we don't want === headers by default

  var levels = parseInt(sidebar.dataset.levels || DEFAULT_LEVEL, 10)
  if (levels < 0) return

  var articleSelector = 'article.doc'
  var article = document.querySelector(articleSelector)
  var headingsSelector = []
  for (var level = 0; level <= levels; level++) {
    var headingSelector = [articleSelector]
    if (level) {
      for (var l = 1; l <= level; l++) headingSelector.push((l === 2 ? '.sectionbody>' : '') + '.sect' + l)
      headingSelector.push('h' + (level + 1) + '[id]')
    } else {
      headingSelector.push('h1[id].sect0')
    }
    headingsSelector.push(headingSelector.join('>'))
  }

  // console.log(levels, headingsSelector)

  var headings = find(headingsSelector.join(','), article.parentNode)
  if (!headings.length) {
    return // sidebar.parentNode.removeChild(sidebar)
    // sidebar is used for other purposes, so leave it
  }

  var lastActiveFragment
  var links = {}

  var list = headings.reduce(function (accum, heading) {
    var link = document.createElement('a')
    link.textContent = heading.textContent
    links[(link.href = '#' + heading.id)] = link
    var listItem = document.createElement('li')
    listItem.dataset.level = parseInt(heading.nodeName.slice(1), 10) - 1
    listItem.appendChild(link)
    accum.appendChild(listItem)
    return accum
  }, document.createElement('ul'))

  var menu = sidebar.querySelector('.toc-menu')
  if (!menu) {
    menu = document.createElement('div')
    menu.className = 'toc-menu'
  }

  // We don't use the title element at the moment
  // var title = document.createElement('h3')
  // title.textContent = sidebar.dataset.title || 'Contents'
  // menu.appendChild(title)
  menu.appendChild(list)

  if (sidebar) {
    window.addEventListener('load', function () {
      onScroll()
      window.addEventListener('scroll', onScroll)
    })
  }

  var startOfContent = !document.getElementById('toc') && article.querySelector('h1.page ~ :not(.is-before-toc)')
  if (startOfContent) {
    var embeddedToc = document.createElement('aside')
    embeddedToc.className = 'toc embedded'
    embeddedToc.appendChild(menu.cloneNode(true))
    startOfContent.parentNode.insertBefore(embeddedToc, startOfContent)
  }

  function onScroll () {
    // a heading is current once it has reached the line below the fixed header that anchor jumps scroll it to
    var targetPosition = (parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 1
    var activeFragment
    headings.some(function (heading) {
      if (Math.floor(heading.getBoundingClientRect().top) <= targetPosition) {
        activeFragment = '#' + heading.id
      } else {
        return true
      }
    })
    if (activeFragment) {
      if (activeFragment !== lastActiveFragment) {
        if (lastActiveFragment) {
          links[lastActiveFragment].classList.remove('is-active')
        }
        var activeLink = links[activeFragment]
        activeLink.classList.add('is-active')
        if (menu.scrollHeight > menu.offsetHeight) {
          menu.scrollTop = Math.max(0, activeLink.offsetTop + activeLink.offsetHeight - menu.offsetHeight)
        }
        lastActiveFragment = activeFragment
      }
    } else if (lastActiveFragment) {
      links[lastActiveFragment].classList.remove('is-active')
      lastActiveFragment = undefined
    }
  }

  function find (selector, from) {
    return toArray((from || document).querySelectorAll(selector))
  }

  function toArray (collection) {
    return [].slice.call(collection)
  }
})()
