;(function () {
  'use strict'

  var container = document.querySelector('.search-container')
  var catalogScript = document.getElementById('search-catalog')
  if (!container || !catalogScript || !window.algoliasearch || !window.instantsearch) return

  var algoliasearch = window.algoliasearch
  var instantsearch = window.instantsearch
  var connectRefinementList = instantsearch.connectors.connectRefinementList
  var connectCurrentRefinements = instantsearch.connectors.connectCurrentRefinements

  // The real, Antora-driven replacement for what was a hand-maintained mock
  // during prototyping -- emitted server-side by the search-catalog helper
  // (see src/helpers/search-catalog.js), sourced from the site's nav_groups
  // config and the real component catalog.
  var componentCatalog = JSON.parse(catalogScript.textContent)

  function metaContent (name) {
    var el = document.querySelector('meta[name="' + name + '"]')
    return el ? el.getAttribute('content') : undefined
  }

  // Once defaultVersionByComponent has loaded (see below), excludes any
  // component with no entry there at all -- i.e. one with literally zero
  // records anywhere in the index, not just zero for the current query.
  // Such a component can never be refined by anything (there's no
  // component_version value for it to refine by), so it can never register
  // as isRefined -- leaving it in a group's own component list meant
  // "select this whole category" could visibly check every real child yet
  // the group checkbox itself would stay stuck on indeterminate forever,
  // since "every one of my children is refined" could never become true.
  // Before that fetch resolves, defaultVersionByComponent is empty for
  // everything, so this deliberately returns the unfiltered list rather
  // than wrongly excluding every real component in that brief window.
  function collectComponentNames (node) {
    var names = node.components ? node.components.map(function (c) { return c.name }) : []
    if (node.subGroups) {
      node.subGroups.forEach(function (sub) { names.push.apply(names, collectComponentNames(sub)) })
    }
    if (defaultVersionsLoaded) names = names.filter(function (name) { return defaultVersionByComponent[name] })
    return names
  }

  // "master" is a real Antora version (used e.g. by "home", whose antora.yml
  // has no real version to give), but showing it to a reader as if it were a
  // release number is just confusing -- omit it rather than display it.
  function productLabel (title, cversion) {
    return cversion && cversion !== 'master' ? title + ' ' + cversion : title
  }

  // The actual matched text (not the raw query) -- Algolia's typo-tolerance
  // and stemming mean the literal query words don't always appear verbatim
  // on the page, but a highlighted match, by definition, already exists in
  // the source content, so it's the more reliable thing to search the
  // destination page for (see 14-search-highlight.js).
  //
  // A whole PHRASE per matched *line*, not the individual <mark>-wrapped
  // words within it -- searching for each word independently (mark.js's own
  // default) means a short common word like "tab" matches any occurrence
  // anywhere on the page, including in a completely unrelated, already-visible
  // tab, which both defeats the highlight and can reveal the wrong one.
  // Requiring a whole line as a contiguous run is far more likely to land
  // only on the actual matched passage.
  //
  // Only from the attribute that's actually *this hit's own match*, mirroring
  // the same hit.type logic the hit template already uses to decide what's
  // shown as the match (content, or the specific hierarchy level, falling
  // back to description only where the template itself would) -- Algolia
  // still returns a highlightResult for every attribute regardless, often
  // with some incidental partial credit (e.g. the page's own title) that
  // isn't why this hit matched at all. Including those short, generic,
  // *always-present* phrases as fallback search targets is worse than
  // finding nothing: they're near-guaranteed to match instantly somewhere
  // irrelevant, and the destination page treats "found a match" as "matched
  // it," so they'd win by accident over the real (possibly unmatchable)
  // phrase.
  //
  // From _snippetResult, not _highlightResult, for content/description --
  // the hit template's own visible snippet (components.Snippet) already
  // reads from _snippetResult, which Algolia pre-windows to a short excerpt
  // around the actual match. _highlightResult holds the FULL, untruncated
  // attribute value; when the crawler has joined disparate blocks of a page
  // into one long content value (observed firsthand: one `content` value
  // contained an entire asciidoctor-tabs block's worth of *every* tab's own
  // paragraph, back to back, newline-joined), searching for that whole
  // blob can mean searching for text that was never actually contiguous
  // anywhere on the real page, and can never be found. The pre-windowed
  // snippet avoids that by construction. Falls back to _highlightResult
  // only if a snippet genuinely isn't available (e.g. attributesToSnippet
  // isn't configured for this attribute) -- hierarchy levels are short
  // heading text to begin with and are never snippeted, so those still
  // read from _highlightResult directly.
  //
  // Split on newlines before taking a line, not the whole snippet/attribute
  // value -- a snippet window is computed in words, so it can still start
  // or end mid-line relative to the crawler's own newline joins; keeping
  // only the specific line(s) that actually contain a <mark> avoids
  // dragging in a neighboring heading or list item that just happened to
  // fall inside the window but wasn't itself part of the match.
  function extractHighlightedPhrases (hit) {
    var phrases = []
    var collectMarkedLines = function (highlighted) {
      if (!highlighted || highlighted.matchLevel === 'none') return
      highlighted.value.split('\n').forEach(function (lineHtml) {
        if (lineHtml.indexOf('<mark') === -1) return
        var container = document.createElement('div')
        container.innerHTML = lineHtml
        // Algolia marks a snippet edge it truncated mid-attribute with its
        // own ellipsis ("…" by default) rather than cutting a word in half
        // -- that's not real page text, so strip it before this becomes a
        // search phrase.
        var phrase = container.textContent.replace(/^…\s*/, '').replace(/\s*…$/, '').trim()
        if (phrase) phrases.push(phrase)
      })
    }
    var highlightResult = hit._highlightResult || {}
    var snippetResult = hit._snippetResult || {}
    if (hit.type === 'content') {
      collectMarkedLines(snippetResult.content || highlightResult.content)
      if (!phrases.length) collectMarkedLines(snippetResult.description || highlightResult.description)
    } else {
      collectMarkedLines(highlightResult.hierarchy && highlightResult.hierarchy[hit.type])
    }
    // Longest (most specific) phrase first -- a snippet spanning a
    // multi-tab block can still surface more than one marked line (see
    // above), and a short, generic leftover (e.g. a lone "A") is far more
    // likely to also match somewhere unrelated than a long, specific
    // sentence is. 14-search-highlight.js tries phrases[0] alone first and
    // only falls back to the rest if it matches nowhere at all, so this
    // ordering is what makes that "try the specific one first" strategy
    // actually pick the right phrase.
    phrases.sort(function (a, b) { return b.split(/\s+/).length - a.split(/\s+/).length })
    return phrases
  }

  // Appends each matched phrase as its own repeated query param (never the
  // fragment -- a hit's own #heading-anchor already lives there, and both
  // need to survive together), so 14-search-highlight.js can find and
  // reveal them on load, even if they're inside a currently-hidden
  // asciidoctor-tabs tabpanel. Repeated params (not one joined string) keep
  // each phrase's own word boundaries intact end to end.
  function hitHref (hit) {
    var phrases = extractHighlightedPhrases(hit)
    if (!phrases.length) return hit.url
    try {
      var url = new URL(hit.url)
      phrases.forEach(function (phrase) { url.searchParams.append('highlight', phrase) })
      return url.toString()
    } catch (e) {
      return hit.url
    }
  }

  // Algolia returns facet values sorted by hit count, not by version number,
  // so without this a component's versions show in whatever arbitrary order
  // happened to have the most matches for the current query. Non-numeric
  // versions (master, "") sort last, since they aren't a "newest release".
  function compareVersionsDescending (a, b) {
    var parse = function (v) { return v && v !== 'master' ? v.split('.').map(Number) : null }
    var pa = parse(a)
    var pb = parse(b)
    if (pa === null || pb === null) return (pa === null) - (pb === null)
    var length = Math.max(pa.length, pb.length)
    for (var i = 0; i < length; i++) {
      var diff = (pb[i] ?? 0) - (pa[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  }

  // A tunable knob for hoistNearbyRuns below -- how many positions away a
  // same-CV neighbor can be pulled from. Deliberately small: this is meant to
  // tidy up near-misses, not meaningfully re-rank the results.
  var HOIST_MAX_DISTANCE = 2

  // Relevance ranking can scatter a handful of same-product hits across the
  // page with just 1-2 unrelated results between them, which reads as choppy
  // once each one repeats its own product badge. This pulls a hit up to sit
  // adjacent to a same-CV neighbor within HOIST_MAX_DISTANCE positions, so
  // they consolidate into one run under one badge -- a small, bounded
  // reorder rather than a real re-ranking.
  function hoistNearbyRuns (hits, maxDistance) {
    var result = hits.slice()
    for (var i = 0; i < result.length; i++) {
      if (i > 0 && result[i - 1].component_version === result[i].component_version) continue
      var cv = result[i].component_version
      for (var j = i + 1; j <= Math.min(i + maxDistance, result.length - 1); j++) {
        if (result[j].component_version === cv) {
          var moved = result.splice(j, 1)[0]
          result.splice(i + 1, 0, moved)
          break
        }
      }
    }
    return result
  }

  // Which component wins the "main" card when hits for the same page
  // differ only by component (e.g. a Hello World tutorial mirrored across
  // every SDK) -- without this, that's decided by whichever SDK Algolia's
  // relevance ranking happens to favor for the current query's exact
  // words, so it can shuffle from one search to the next. A small, fixed
  // preference keeps it consistent instead. Not exhaustive: a component
  // not listed here just falls through to Algolia's own top-ranked hit for
  // the group, same as before this existed. The proper long-term fix (a
  // low-precedence Algolia ranking rule, applied at index time) needs UI +
  // content-repo + Algolia config changes and a reindex -- deliberately
  // deferred; this is the lightweight stand-in until/unless that happens.
  var PREFERRED_SIBLING_COMPONENTS = ['java-sdk']

  // Same idea, one level down: which platform module wins the "main" card
  // among a single groupByModule component's own per-platform siblings
  // (currently just Couchbase Lite).
  var PREFERRED_MODULE_BY_COMPONENT = {
    'couchbase-lite': 'android',
  }

  // hits is every candidate for one group (same page, different
  // component, or -- for a groupByModule component -- same component,
  // different platform module), in whatever order Algolia originally
  // ranked them for this query; hits[0] is that top-ranked one, used as
  // the fallback when nothing here has an opinion.
  function pickPrimaryHit (hits) {
    var first = hits[0]
    var sameComponentVersion = hits.every(function (hit) { return hit.component_version === first.component_version })
    if (sameComponentVersion) {
      var componentName = first.component_version && first.component_version.split('@')[0]
      var preferredModule = componentName && PREFERRED_MODULE_BY_COMPONENT[componentName]
      var moduleMatch = preferredModule && hits.find(function (hit) { return hit.module === preferredModule })
      if (moduleMatch) return moduleMatch
    } else {
      for (var i = 0; i < PREFERRED_SIBLING_COMPONENTS.length; i++) {
        var componentMatch = hits.find(function (hit) {
          return hit.component_version && hit.component_version.split('@')[0] === PREFERRED_SIBLING_COMPONENTS[i]
        })
        if (componentMatch) return componentMatch
      }
    }
    return first
  }

  // name -> catalog entry ({name, title, shortName}), so hit
  // grouping/rendering can look up per-component config without walking the
  // nested navGroups tree each time.
  var catalogComponentsByName = new Map()

  // Fallback for anything with no catalog entry at all (a leftover/"Other"
  // component) -- color only ever lives on a top-level navGroup in the
  // catalog, inherited down through subGroups and components below, so this
  // is the one spot that needs its own default.
  var FALLBACK_PILL_COLOR = '#737373'
  var componentColorByName = new Map()
  ;(function indexCatalogComponents (node, inheritedColor) {
    var color = node.color ?? inheritedColor
    if (node.components) {
      node.components.forEach(function (c) {
        catalogComponentsByName.set(c.name, c)
        componentColorByName.set(c.name, color)
      })
    }
    if (node.subGroups) node.subGroups.forEach(function (sub) { indexCatalogComponents(sub, color) })
  })({ subGroups: componentCatalog.navGroups }, FALLBACK_PILL_COLOR)

  var searchClient = algoliasearch(container.dataset.appId, container.dataset.apiKey)
  var indexName = container.dataset.indexName

  // The current page's own component/version (if any), and whichever
  // navGroup/subGroup (if any) has this page as its own landing/start page --
  // both already known server-side (Antora meta tags + the catalog's own
  // resolved group URLs), so no extra plumbing is needed to tell "this is a
  // specific component doc" apart from "this is a whole-category landing
  // page" client-side.
  function findGroupByUrl (nodes, pageUrl) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      if (node.url && node.url === pageUrl) return node
      if (node.subGroups) {
        var found = findGroupByUrl(node.subGroups, pageUrl)
        if (found) return found
      }
    }
    return undefined
  }

  // A continuously-deployed/unversioned component (Capella, AI Data Plane,
  // etc.) has a genuine version of "" in Antora, not a missing one -- a
  // plain truthiness check would silently drop it (same reasoning as the
  // ['', 'master'].includes(...) checks elsewhere in this file, just
  // inverted: there, '' means "don't show a redundant version picker";
  // here, '' must still count as "this component has a real, includable
  // version").
  function hasVersion (versionMap, name) {
    return versionMap && Object.prototype.hasOwnProperty.call(versionMap, name)
  }

  function computeDefaultRefinement () {
    var pageUrl = metaContent('page-url')
    var landingGroup = pageUrl ? findGroupByUrl(componentCatalog.navGroups, pageUrl) : undefined
    if (landingGroup) {
      return (landingGroup.components || [])
        .filter(function (c) { return hasVersion(landingGroup.latestVersions, c.name) })
        .map(function (c) { return c.name + '@' + landingGroup.latestVersions[c.name] })
    }
    var component = metaContent('docsearch:component')
    var version = metaContent('docsearch:cversion')
    // "home" pages are landing/informational content (the site index, and
    // every home::*.adoc category landing page not already caught above by
    // its own group's url match) -- nav-group-for-page.js already treats
    // these as belonging to no specific group for the same reason, so don't
    // default search to "home"'s own (largely meaningless) component here.
    if (!component || component === 'home' || version === undefined) return []
    return [component + '@' + version]
  }

  // The refinementList widget only ever exposes component_version values that
  // match the CURRENT search text (Algolia's facet counts are computed over
  // the filtered result set) -- so "select this whole category" can only
  // see, and thus only refine, components with at least one hit for
  // whatever the user has currently typed. Fetched once, unfiltered, so that
  // shortcut has a default version for every catalog component regardless of
  // the query. allVersionsByComponent (the full list, not just [0]) is kept
  // around too -- buildRefinementPills falls back to it when a query has
  // zero results, since a zero-result query's own facet response comes back
  // with no component_version data at all to judge "all versions selected"
  // against.
  var defaultVersionByComponent = {}
  var allVersionsByComponent = {}
  var defaultVersionsLoaded = false
  searchClient.search([{
    indexName: indexName,
    params: { query: '', facets: ['component_version'], hitsPerPage: 0, maxValuesPerFacet: 1000 },
  }]).then(function (response) {
    var results = response.results
    var facetCounts = (results[0] && results[0].facets && results[0].facets.component_version) || {}
    var versionsByComponent = {}
    Object.keys(facetCounts).forEach(function (value) {
      var parts = value.split('@')
      var component = parts[0]
      var version = parts[1]
      if (!versionsByComponent[component]) versionsByComponent[component] = []
      versionsByComponent[component].push({ value: value, version: version })
    })
    Object.keys(versionsByComponent).forEach(function (component) {
      versionsByComponent[component].sort(function (a, b) { return compareVersionsDescending(a.version, b.version) })
      defaultVersionByComponent[component] = versionsByComponent[component][0].value
    })
    allVersionsByComponent = versionsByComponent
    defaultVersionsLoaded = true
  })

  var search = instantsearch({
    indexName: indexName,
    initialUiState: (function () {
      var state = {}
      state[indexName] = { refinementList: { component_version: computeDefaultRefinement() } }
      return state
    })(),
    searchClient: searchClient,
    future: { preserveSharedStateOnUnmount: true },
    insights: true,
    // Reflects query + refinements into the URL, so a search is shareable and
    // survives a reload. A plain `routing: true` hands the ENTIRE parsed
    // query string to InstantSearch's routing, which assumes every top-level
    // key is an index's UI state object -- any other query param docs pages
    // routinely pick up (utm_*, ref, etc.) parses to a bare string, and
    // reading UI-state properties off that (rather than an object) throws
    // "Reflect.ownKeys called on non-object", crashing every widget
    // including the search box. The custom parseURL below only hands
    // through top-level keys that are themselves objects, leaving anything
    // else in the address bar untouched.
    routing: {
      router: instantsearch.routers.history({
        // Default is a 400ms debounce before a keystroke's state actually
        // reaches the address bar. The Enter-to-navigate handler below reads
        // window.location.search at the moment Enter is pressed and relies
        // on it already reflecting the latest state -- writeDelay: 0 keeps
        // that gap down to a single tick (still deferred via setTimeout(0)
        // internally, not truly synchronous) rather than the default's much
        // longer, easily-losable window.
        writeDelay: 0,
        parseURL: function (args) {
          var parsed = args.qsModule.parse(args.location.search.slice(1))
          var routeState = {}
          Object.keys(parsed).forEach(function (key) {
            if (parsed[key] && typeof parsed[key] === 'object') routeState[key] = parsed[key]
          })
          return routeState
        },
      }),
    },
  })

  var renderRefinementList = function (renderOptions, isFirstRender) {
    var items = renderOptions.items
    var refine = renderOptions.refine
    var widgetParams = renderOptions.widgetParams

    var listContainer = document.querySelector(widgetParams.container)

    if (isFirstRender) {
      var ul = document.createElement('ul')
      listContainer.appendChild(ul)
    }

    items = items.map(function (item) {
      var parts = item.label.split('@')
      return Object.assign({}, item, { component: parts[0], version: parts[1] })
    })
    var byComponent = Object.groupBy(items, function (item) { return item.component })
    // Sorted here, once, rather than only where it's rendered -- the click
    // handlers below also read byComponent[name][0] as "the default version
    // to refine", so both need to agree on the same (newest-first) order.
    Object.keys(byComponent).forEach(function (component) {
      byComponent[component].sort(function (a, b) { return compareVersionsDescending(a.version, b.version) })
    })

    // Leaf-level markup: one component's own checkbox + version <select>.
    // The catalog (not just whatever Algolia currently returns) drives which
    // rows exist at all -- a component with zero hits for the current search
    // text still gets a row, just greyed out, rather than vanishing
    // outright. Only whole groups disappear when empty (see
    // renderGroupNode) -- within a group that does have a match, all of its
    // siblings stay visible too, so the only "bouncing" as the query changes
    // happens at the coarse, whole-category level, not one row at a time.
    // If a component has never been indexed anywhere (no live data AND no
    // fallback default version), the checkbox is disabled too, since
    // there's no value left to refine by.
    var renderComponentItem = function (component, title, inheritedColor) {
      var componentItems = byComponent[component]
      var isVisible = Boolean(componentItems)
      var anyRefined = isVisible && componentItems.some(function (item) { return item.isRefined })
      var allItems = isVisible && componentItems.length > 1 &&
        componentItems.every(function (item) { return item.isRefined })
      var totalCount = isVisible ? componentItems.reduce(function (sum, item) { return sum + item.count }, 0) : 0
      // A disjunctive facet keeps returning an already-refined value even
      // once it has zero hits for the current query -- basing the empty
      // styling on the count instead means a selected-but-zero-hit
      // component still reads as "not really contributing right now", same
      // as one that was never checked at all.
      var isEmpty = totalCount === 0
      var showSelect = isVisible && anyRefined &&
        (componentItems.length > 1 || !['', 'master'].includes(componentItems[0].version))
      var itemsWithSelected = isVisible ? componentItems.map(function (item) {
        return Object.assign({}, item, { isSelected: allItems ? false : item.isRefined })
      }) : []
      var fallbackValue = defaultVersionByComponent[component]
      var canRefine = isVisible || Boolean(fallbackValue)
      var color = isEmpty ? FALLBACK_PILL_COLOR : inheritedColor

      return '' +
        '<li class="facet-item' + (isEmpty ? ' facet-item--empty' : '') + '">' +
          '<label>' +
            '<input' +
              ' type="checkbox"' +
              ' data-component="' + component + '"' +
              ' data-value="' +
                (isVisible ? componentItems[0].value : (fallbackValue ?? '')) + '"' +
              ' style="--pill-color: ' + color + '"' +
              (anyRefined ? ' checked' : '') +
              (canRefine ? '' : ' disabled') +
            '/>' +
            '<span class="facet-label">' + title + '</span>' +
            '<span class="facet-count">(' + totalCount + ')</span>' +
          '</label>' +
          (showSelect ? (
            '<select name="' + component + '">' +
              '<button type="button"><selectedcontent></selectedcontent></button>' +
              (componentItems.length > 1 ? (
                '<option value="ALL" data-value="" ' + (allItems ? 'selected' : '') + '>All versions</option>'
              ) : '') +
              itemsWithSelected.map(function (item) {
                return '' +
                  '<option' +
                    ' value="' + item.value + '"' +
                    ' data-component="' + component + '"' +
                    ' data-value="' + item.value + '"' +
                    (item.isSelected ? ' selected' : '') +
                  '><span class="option-version">' + item.version + '</span> ' +
                  '<span class="option-count">(' + item.count + ')</span></option>'
              }).join('') +
            '</select>'
          ) : '') +
        '</li>'
    }

    var rendered = new Set()

    // Group/subGroup node: its own "select everything beneath this"
    // checkbox, then either its direct components or nested subGroups. The
    // node's own header always renders, at every level of nesting -- the
    // catalog's structure stays visible as a map of what exists, no matter
    // how narrow the query is. Only the innermost layer -- a node's own
    // direct list of leaf components -- is ever fully suppressed, and only
    // as a single unit.
    var renderGroupNode = function (node, inheritedColor) {
      // The facet-group-checkbox's data-components uses the FULL catalog
      // list (allNames), not just whichever components currently have a hit
      // for the search text -- otherwise "select this whole category" can
      // only ever act on, and only ever appear fully selected relative to,
      // whatever happens to be visible right now, silently missing
      // components a narrower query hides.
      var allNames = collectComponentNames(node)
      allNames.forEach(function (name) { rendered.add(name) })
      var visibleNames = allNames.filter(function (name) { return byComponent[name] })
      var color = node.color ?? inheritedColor

      var isRefined = function (item) { return item.isRefined }
      var allRefined = allNames.every(function (name) { return byComponent[name]?.some(isRefined) })
      var anyRefined = allNames.some(function (name) { return byComponent[name]?.some(isRefined) })
      var totalCount = visibleNames.reduce(function (sum, name) {
        return sum + byComponent[name].reduce(function (s, item) { return s + item.count }, 0)
      }, 0)

      // Only a components-holding node gates on its own count -- a
      // subGroups-holding node (e.g. "Develop") always recurses, since the
      // all-or-nothing decision belongs to whichever node directly owns the
      // leaf list, not to its ancestors.
      var inner = node.components
        ? (totalCount > 0 ? node.components.map(function (c) {
          return renderComponentItem(c.name, c.title, color)
        }).join('') : '')
        : node.subGroups.map(function (sub) { return renderGroupNode(sub, color) }).join('')

      return '' +
        '<li class="facet-group' + (totalCount === 0 ? ' facet-group--empty' : '') + '">' +
          '<label>' +
            '<input' +
              ' type="checkbox"' +
              ' class="facet-group-checkbox"' +
              ' data-components="' + allNames.join(',') + '"' +
              ' style="--pill-color: ' + (totalCount === 0 ? FALLBACK_PILL_COLOR : color) + '"' +
              (allRefined ? ' checked' : '') +
              (!allRefined && anyRefined ? ' data-indeterminate="true"' : '') +
            '/>' +
            '<span class="facet-label">' + node.title + '</span>' +
            '<span class="facet-count">(' + totalCount + ')</span>' +
          '</label>' +
          '<ul>' + inner + '</ul>' +
        '</li>'
    }

    var groupsHtml = componentCatalog.navGroups.map(function (node) { return renderGroupNode(node, FALLBACK_PILL_COLOR) }).join('')

    // Anything Algolia returns that isn't in the catalog at all (a brand new
    // component not yet added to any nav_groups config) still needs to show
    // up somewhere rather than vanish.
    var leftoverNames = Object.keys(byComponent).filter(function (name) { return !rendered.has(name) })
    var otherCount = leftoverNames.reduce(function (sum, name) {
      return sum + byComponent[name].reduce(function (s, item) { return s + item.count }, 0)
    }, 0)
    var otherItemsHtml = leftoverNames.map(function (name) {
      return renderComponentItem(name, name, FALLBACK_PILL_COLOR)
    }).join('')
    var otherHtml = leftoverNames.length ? (
      '<li class="facet-group">' +
        '<label>' +
          '<input type="checkbox" class="facet-group-checkbox" data-components="' + leftoverNames.join(',') +
            '" style="--pill-color: ' + FALLBACK_PILL_COLOR + '" />' +
          '<span class="facet-label">Other</span>' +
          '<span class="facet-count">(' + otherCount + ')</span>' +
        '</label>' +
        '<ul>' + otherItemsHtml + '</ul>' +
      '</li>'
    ) : ''

    listContainer.querySelector('ul').innerHTML = groupsHtml + otherHtml

    // indeterminate can't be set via an HTML attribute -- apply after insertion
    listContainer.querySelectorAll('.facet-group-checkbox[data-indeterminate]').forEach(function (element) {
      element.indeterminate = true
    })

    listContainer.querySelectorAll('.facet-item input[type="checkbox"]').forEach(function (element) {
      element.addEventListener('change', function (event) {
        var select = listContainer.querySelector('select[name="' + event.currentTarget.dataset.component + '"]')
        if (select) {
          var selected = select.value
          if (selected === 'ALL') {
            var options = Array.from(select.options).map(function (option) { return option.dataset.value }).slice(1)
            options.forEach(refine)
          } else {
            refine(selected)
          }
        } else {
          // nothing currently refined, so just refine the default (e.g. latest version)
          refine(event.currentTarget.dataset.value)
        }
      })
    })
    listContainer.querySelectorAll('.facet-item select').forEach(function (element) {
      var prev = element.value
      element.addEventListener('change', function () {
        var value = element.value
        var options = Array.from(element.options).map(function (option) { return option.dataset.value }).slice(1)

        if (prev === 'ALL') {
          options.filter(function (option) { return option !== value }).forEach(refine)
        } else if (value === 'ALL') {
          options.filter(function (option) { return option !== prev }).forEach(function (item) { refine(item) })
        } else {
          refine(prev)
          refine(value)
        }
      })
    })

    // Group/subgroup shortcut: tick to refine every descendant component's
    // default version at once; untick (once fully selected) to clear them
    // all. This can touch 20-30 values in one click -- mutating the
    // helper's state directly and calling .search() exactly once avoids
    // the render race that per-value refine() calls would cause.
    listContainer.querySelectorAll('.facet-group-checkbox').forEach(function (element) {
      element.addEventListener('change', function (event) {
        var names = event.currentTarget.dataset.components.split(',').filter(Boolean)
        var allRefined = names.every(function (name) { return byComponent[name]?.some(function (item) { return item.isRefined }) })
        var helper = search.helper
        if (allRefined) {
          names.forEach(function (name) {
            ;(byComponent[name] ?? []).filter(function (item) { return item.isRefined }).forEach(function (item) {
              helper.removeDisjunctiveFacetRefinement('component_version', item.value)
            })
          })
        } else {
          names.forEach(function (name) {
            var componentItems = byComponent[name] ?? []
            if (componentItems.length) {
              if (!componentItems.some(function (item) { return item.isRefined })) {
                helper.addDisjunctiveFacetRefinement('component_version', componentItems[0].value)
              }
            } else if (defaultVersionByComponent[name]) {
              helper.addDisjunctiveFacetRefinement('component_version', defaultVersionByComponent[name])
            }
          })
        }
        helper.search()
      })
    })
  }

  var customRefinementList = connectRefinementList(renderRefinementList)

  // Collapses the raw list of currently-refined "component@version" values
  // into the fewest pills that still say something true: a whole category
  // selected collapses to one pill for that category and swallows
  // everything beneath it; a component with every version Algolia currently
  // shows for it refined collapses to one pill with no version number;
  // anything left over gets one pill per selected version.
  function buildRefinementPills (refinedValues) {
    var refinedByComponent = Object.groupBy(refinedValues, function (value) { return value.split('@')[0] })
    var refinedComponents = new Set(Object.keys(refinedByComponent))
    var consumed = new Set()
    var pills = []

    var collectCategoryPills = function (nodes, inheritedColor) {
      nodes.forEach(function (node) {
        var color = node.color ?? inheritedColor
        var allNames = collectComponentNames(node)
        if (allNames.length > 0 && allNames.every(function (name) { return refinedComponents.has(name) })) {
          pills.push({ label: node.title, color: color, values: allNames.flatMap(function (name) { return refinedByComponent[name] }) })
          allNames.forEach(function (name) { consumed.add(name) })
        } else if (node.subGroups) {
          collectCategoryPills(node.subGroups, color)
        }
      })
    }
    collectCategoryPills(componentCatalog.navGroups, FALLBACK_PILL_COLOR)

    // getFacetValues mirrors exactly what the facet list's own "All
    // versions" option is judging against -- the query-scoped set Algolia
    // currently returns for component_version, not every version ever
    // indexed.
    var facetValues = search.helper?.lastResults?.getFacetValues('component_version') ?? []
    var availableByComponent = Object.groupBy(facetValues, function (fv) { return fv.name.split('@')[0] })

    Object.keys(refinedByComponent).forEach(function (component) {
      if (consumed.has(component)) return
      var catalogEntry = catalogComponentsByName.get(component)
      var color = componentColorByName.get(component) ?? FALLBACK_PILL_COLOR
      var label = catalogEntry?.shortName ?? catalogEntry?.title ?? component
      // A zero-result query's facet response has no component_version data
      // at all to judge against -- fall back to the full startup-fetched
      // version list so "all versions selected" still merges correctly.
      var available = availableByComponent[component]?.length
        ? availableByComponent[component].map(function (fv) { return fv.isRefined })
        : (allVersionsByComponent[component] ?? []).map(function (v) { return refinedByComponent[component].includes(v.value) })
      var allVersionsSelected = available.length > 0 && available.every(Boolean)

      if (allVersionsSelected) {
        pills.push({ label: label, color: color, values: refinedByComponent[component] })
      } else {
        refinedByComponent[component].forEach(function (value) {
          var version = value.split('@')[1]
          pills.push({ label: productLabel(label, version), color: color, values: [value] })
        })
      }
    })

    return pills
  }

  // Every active component_version refinement, shown as a removable pill
  // above the results. A trailing "Clear all" pill only appears once there
  // are 2+ pills; with just one, its own remove button already does the
  // same thing.
  var renderCurrentRefinements = function (renderOptions, isFirstRender) {
    var items = renderOptions.items
    var widgetParams = renderOptions.widgetParams
    var refinementsContainer = document.querySelector(widgetParams.container)

    if (isFirstRender) {
      var ul = document.createElement('ul')
      ul.className = 'current-refinements'
      refinementsContainer.appendChild(ul)
    }

    var refinedValues = items.flatMap(function (item) {
      return item.refinements.map(function (refinement) { return refinement.value })
    })
    var pills = buildRefinementPills(refinedValues)

    var pillHtml = function (pill, index) {
      return '' +
        '<li class="refinement-pill" style="--pill-color: ' + pill.color + '">' +
          pill.label +
          '<button type="button" class="refinement-pill-remove" data-index="' + index + '"' +
            ' aria-label="Remove ' + pill.label + '">&times;</button>' +
        '</li>'
    }

    var clearAllHtml = pills.length > 1 ? (
      '<li class="refinement-pill refinement-pill--clear-all">' +
        '<button type="button" id="clear-all-refinements">Clear all &times;</button>' +
      '</li>'
    ) : ''

    refinementsContainer.querySelector('ul').innerHTML = pills.map(pillHtml).join('') + clearAllHtml

    refinementsContainer.querySelectorAll('.refinement-pill-remove').forEach(function (button) {
      button.addEventListener('click', function () {
        var pill = pills[Number(button.dataset.index)]
        pill.values.forEach(function (value) {
          search.helper.removeDisjunctiveFacetRefinement('component_version', value)
        })
        search.helper.search()
      })
    })

    var clearAllButton = refinementsContainer.querySelector('#clear-all-refinements')
    if (clearAllButton) {
      clearAllButton.addEventListener('click', function () {
        search.helper.clearRefinements()
        search.helper.search()
      })
    }
  }
  var customCurrentRefinements = connectCurrentRefinements(renderCurrentRefinements)

  search.addWidgets([
    instantsearch.widgets.searchBox({
      container: '#searchbox',
      placeholder: 'Search Docs',
    }),
    instantsearch.widgets.stats({
      container: '#stats',
      templates: {
        text: function (data) {
          return data.nbHits.toLocaleString() + ' result' + (data.nbHits === 1 ? '' : 's') + ' found'
        },
      },
    }),
    instantsearch.widgets.hits({
      container: '#hits',
      // Cross-component duplicates (e.g. the same "hello world" page
      // mirrored across every SDK) aren't caught by the index's own
      // distinct, since each SDK has its own URL. Group hits that share
      // both nav_group and their URL path after /{component}/{version}/.
      // Only the top-ranked hit per group is kept as a visible result; the
      // rest are stashed on it as __siblings for the template to render as
      // an expandable "also relevant for" list.
      transformItems: function (items) {
        var groups = new Map()
        items.forEach(function (hit) {
          var catalogEntry = catalogComponentsByName.get(hit.component_version?.split('@')[0])
          var pathAfterComponentVersion = hit.url_without_anchor.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\//, '')
          // Confirmed against real site nav data that this is only safe for
          // components explicitly flagged groupByModule (currently just
          // Couchbase Lite) -- its modules mirror the same content per
          // platform, but e.g. Server reuses generic filenames like
          // index.html across unrelated REST API sections, so folding
          // module into the comparison universally would wrongly group
          // those.
          if (catalogEntry?.groupByModule && hit.module && pathAfterComponentVersion.startsWith(hit.module + '/')) {
            pathAfterComponentVersion = pathAfterComponentVersion.slice(hit.module.length + 1)
          }
          hit.__groupKey = (hit.nav_group ?? '') + '::' + pathAfterComponentVersion
          if (!groups.has(hit.__groupKey)) groups.set(hit.__groupKey, new Map())
          var byComponent = groups.get(hit.__groupKey)
          // distinct can already return several anchors from the same
          // component's own page; keep only the top-ranked hit per
          // component so siblings reflect distinct components, not
          // distinct anchors. For groupByModule components, several
          // modules share one component_version, so module has to be part
          // of that identity too -- otherwise every platform but the
          // top-ranked one would be silently dropped instead of kept as a
          // sibling.
          var dedupeKey = catalogEntry?.groupByModule ? hit.component_version + '::' + hit.module : hit.component_version
          if (!byComponent.has(dedupeKey)) byComponent.set(dedupeKey, hit)
        })

        // Which hit represents each group is decided up front (see
        // pickPrimaryHit), not just "whichever Algolia ranked first for
        // this query" -- items.filter can only keep or drop entries
        // already in `items`, not substitute a different one in, so this
        // builds the deduped array by hand instead.
        var deduped = []
        var seen = new Set()
        items.forEach(function (hit) {
          if (seen.has(hit.__groupKey)) return
          seen.add(hit.__groupKey)
          var candidates = Array.from(groups.get(hit.__groupKey).values())
          var primary = pickPrimaryHit(candidates)
          primary.__siblings = candidates.filter(function (sibling) { return sibling !== primary })
          deduped.push(primary)
        })

        var hoisted = hoistNearbyRuns(deduped, HOIST_MAX_DISTANCE)

        // Consecutive results for the same product/version repeat that
        // badge on every card; only show it when it changes from the
        // previous card, so one badge reads as a header spanning the run
        // below it.
        var previousComponentVersion = null
        var runStart = null
        hoisted.forEach(function (hit) {
          hit.__isNewProduct = hit.component_version !== previousComponentVersion
          previousComponentVersion = hit.component_version
          if (hit.__isNewProduct) runStart = hit
          // A run's own "Show N similar results" toggle sits under whichever
          // card actually has the siblings, not necessarily the first one --
          // easy to miss entirely if the badge above the whole run gives no
          // hint that expanding any card in it would surface other
          // components too. Flagging it on the run's own badge-holding hit
          // means a reader scanning down the page sees it before they'd
          // otherwise assume a short run of one component is the complete
          // picture.
          if (hit.__siblings.length > 0) runStart.__runHasSiblings = true
        })

        return hoisted
      },
      templates: {
        item: function (hit, helpers) {
          var html = helpers.html
          var components = helpers.components
          // components.Highlight reads hit._highlightResult[attribute].value,
          // NOT the plain hit[attribute] -- transform both, in lockstep, so
          // debug output and the rendered breadcrumb agree, and so any
          // <mark> highlighting already present survives.
          //
          // The leading "{component_title} {cversion}" segment (everything
          // up to and including the first "/") is dropped here, since it's
          // shown separately in its own badge below. Parsing it as actual
          // HTML (via a detached element) avoids a highlighted match inside
          // that segment (e.g. "sdk" -> "Java <mark>SDK</mark> 3.12")
          // putting a literal "/" inside the closing </mark> tag, which
          // would trip up a plain regex looking for "the first /".
          var dropLeadingBreadcrumbSegment = function (value) {
            var source = document.createElement('div')
            source.innerHTML = value
            var rest = document.createElement('div')
            var sawSlash = false
            Array.from(source.childNodes).forEach(function (node) {
              if (sawSlash) {
                rest.appendChild(node)
                return
              }
              if (node.nodeType === 3 && node.textContent.includes('/')) { // 3 === Node.TEXT_NODE
                sawSlash = true
                var after = node.textContent.slice(node.textContent.indexOf('/') + 1).replace(/^\s*/, '')
                if (after) rest.appendChild(document.createTextNode(after))
              }
              // otherwise this node is part of the leading segment -- discard it
            })
            return rest.innerHTML
          }
          hit.breadcrumbs = dropLeadingBreadcrumbSegment(hit.breadcrumbs)
          if (hit._highlightResult?.breadcrumbs) {
            hit._highlightResult.breadcrumbs.value = dropLeadingBreadcrumbSegment(hit._highlightResult.breadcrumbs.value)
          }

          // The crawler attaches a `hierarchy` object to every `content`
          // hit, giving the (variable-depth) chain of HTML headings above
          // the matched text. `breadcrumbs` already ends with lvl1, so
          // lvl1 is skipped below to avoid showing it twice; the title
          // becomes the deepest heading, and any levels in between are
          // shown as extra breadcrumb segments.
          var levels = hit.type === 'content'
            ? ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5', 'lvl6'].filter(function (lvl) { return hit.hierarchy[lvl] })
            : [hit.type]
          var titleLevel = levels[levels.length - 1] ?? 'lvl1'
          var inPageLevels = levels.slice(1, -1)

          // A "lvl1" hit is a match purely on the page's own heading text --
          // there's no associated paragraph, since that's a genuinely
          // separate record in the index. The page's curated meta
          // description is a reasonable stand-in there.
          var showDescriptionFallback = !hit.content && hit.type === 'lvl1' && hit.description
          var descriptionIsHighlighted = Boolean(hit._highlightResult?.description)

          // Same per-category color as the refinement pills above the
          // results -- reinforces that this badge and, say, a collapsed
          // "Mobile / Edge" pill are talking about the same family.
          var productColor = componentColorByName.get(hit.component_version?.split('@')[0]) ?? FALLBACK_PILL_COLOR

          return html`
          <article class="hit">
            ${hit.__isNewProduct ? html`<div class="hit-product" style="--pill-color: ${
              productColor}">${productLabel(hit.component_title, hit.cversion)}${
              hit.__runHasSiblings ? html`<span class="hit-product-hint"> (and others)</span>` : ''}</div>` : ''}

            <div class="hit-breadcrumbs">
              ${components.Highlight({ hit: hit, attribute: 'breadcrumbs' })}
              ${inPageLevels.map((lvl) => html`
                <span class="breadcrumb-sep"> / </span>${components.Highlight(
                  { hit: hit, attribute: `hierarchy.${lvl}` }
                )}
              `)}
            </div>

            <h1 class="hit-name">
              <a href="${hitHref(hit)}">${components.Highlight({ hit: hit, attribute: `hierarchy.${titleLevel}` })}</a>
            </h1>

            ${hit.content ? html`
              <div class="hit-snippet">
                ${components.Snippet({ hit: hit, attribute: 'content' })}
              </div>
            ` : showDescriptionFallback ? html`
              <div class="hit-snippet">${descriptionIsHighlighted ? components.Highlight({ hit: hit, attribute: 'description' }) : hit.description}</div>
            ` : ''}

            ${hit.__siblings.length > 0 ? html`
              <details class="also-relevant">
                <summary>Show ${hit.__siblings.length} similar result${hit.__siblings.length === 1 ? '' : 's'}</summary>
                <ul>
                  ${hit.__siblings.map((sibling) => {
                    // For a groupByModule component (Couchbase Lite), every
                    // sibling shares the same component_title/cversion --
                    // the module is what actually distinguishes them, so
                    // label by that instead.
                    var siblingCatalogEntry = catalogComponentsByName.get(sibling.component_version?.split('@')[0])
                    var label = siblingCatalogEntry?.groupByModule
                      ? (siblingCatalogEntry.moduleTitles?.[sibling.module] ?? sibling.module)
                      : productLabel(sibling.component_title, sibling.cversion)
                    return html`<li><a href="${hitHref(sibling)}">${label}</a></li>`
                  })}
                </ul>
              </details>
            ` : ''}
          </article>
        `
        },
      },
    }),
    customCurrentRefinements({
      container: '#current-refinements',
    }),

    customRefinementList({
      container: '#component-list',
      attribute: 'component_version',
      limit: 1000,
    }),
    instantsearch.widgets.configure({
      hitsPerPage: 20,
      maxValuesPerFacet: 1000,
      // attributeForDistinct (url_without_anchor) is already set index-side;
      // this raises the cap from the index default of 1 hit per page to 3,
      // so a couple of relevant sections can still surface without one
      // long page flooding the results.
      distinct: 3,
    }),
    instantsearch.widgets.pagination({
      container: '#pagination',
    }),
  ])

  function clearSearch () {
    var input = document.querySelector('#searchbox input')
    if (!input) return
    input.value = ''
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  }

  var searchPanel = document.querySelector('.search-panel')

  // The dedicated search-page layout (see src/layouts/search-page.hbs)
  // embeds this same widget inline, always visible, with nothing "outside"
  // it to click away to -- the show-on-type/hide-on-clear-or-click-away
  // behavior below only makes sense for the header's dropdown instance.
  var isFullPage = container.classList.contains('search-container--page')

  search.on('render', function () {
    if (isFullPage) return
    var query = search.renderState[indexName]?.searchBox?.query
    searchPanel.style.visibility = query ? 'visible' : 'hidden'
  })

  // Capture phase, deliberately -- a bubble-phase listener here would run
  // AFTER any click handler on the clicked element itself (e.g. a
  // refinement pill's own remove button), and that handler can
  // synchronously replace the DOM it lives in. If that replacement detaches
  // the original target before the event finishes bubbling to document,
  // e.target.closest('.search-container') wrongly returns null and clears
  // the query out from under a click that was genuinely inside the search
  // UI. Running in capture phase evaluates e.target before any of that
  // mutation has a chance to happen.
  document.addEventListener('click', function (e) {
    if (isFullPage) return
    if (!e.target.closest('.search-container')) clearSearch()
  }, true)

  search.start()

  // On the dedicated search page there's nothing else to do first -- unlike
  // the header dropdown (where auto-focusing on every page load would be
  // presumptuous), landing here means search IS the page.
  if (isFullPage) {
    var searchInput = container.querySelector('#searchbox input')
    if (searchInput) searchInput.focus()
  }

  // Pressing Enter submits the searchBox's own <form> -- InstantSearch's
  // widget already listens for that submit and calls preventDefault (this
  // is instant-search-as-you-type; a traditional submission has nothing to
  // do), so today Enter is a silent no-op. Wire it up to instead jump to the
  // dedicated search-page layout with the current query + refinements,
  // carried over via the URL routing state that's already kept in sync
  // (see the `routing` config above) -- i.e. "submit the form" to that page.
  // searchPageUrl is only present once a real page using that layout has
  // been deployed and SEARCH_PAGE_URL configured to point at it; until
  // then this is deliberately a no-op, same as it is today.
  var searchPageUrl = container.dataset.searchPageUrl
  var searchForm = container.querySelector('#searchbox form')
  if (searchPageUrl && searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault()
      var target = new window.URL(searchPageUrl, window.location.href)
      if (target.pathname === window.location.pathname) return
      // Deferred one tick so a same-instant keystroke's own debounced
      // routing write (writeDelay: 0 above, but still a setTimeout(0), not
      // synchronous) has already landed in window.location.search by the
      // time it's read here.
      window.setTimeout(function () {
        window.location.assign(target.pathname + window.location.search)
      }, 0)
    })
  }
})()
