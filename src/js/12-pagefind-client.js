;(function () {
  'use strict'

  // A search client for InstantSearch that searches a Pagefind index instead
  // of Algolia. Like 12-typesense-client.js, it answers InstantSearch's
  // search(requests) with Algolia-shaped results, so 13-docsearch.js keeps
  // every widget and template as they are.
  //
  // Pagefind runs entirely in the browser: it downloads only the parts of a
  // static index that a query needs. The index is built from the search
  // records by docs-site/scripts/search-pagefind.js, which attaches each
  // page's product, version and breadcrumbs as Pagefind metadata.
  //
  // Used only when the search container carries a data-pagefind-url, which
  // the UI templates emit when PAGEFIND_URL is set at build time.

  var DEFAULT_PRE_TAG = '__ais-highlight__'
  var DEFAULT_POST_TAG = '__/ais-highlight__'
  var LEVELS = ['lvl2', 'lvl3', 'lvl4', 'lvl5', 'lvl6']
  // Only these fields are Pagefind filters (see search-pagefind.js)
  var FILTERABLE = ['component_version', 'version_rank']
  // The current version of a component, as Algolia's version_rank has it
  var LATEST = '1'

  // "attr:value" / "attr:-value", as InstantSearch writes facet refinements
  function parseFacetFilter (filter) {
    var at = filter.indexOf(':')
    var value = filter.slice(at + 1)
    var negative = value.charAt(0) === '-'
    return { attribute: filter.slice(0, at), value: negative ? value.slice(1) : value, negative: negative }
  }

  // Algolia facetFilters (outer array AND, inner array OR) as a Pagefind
  // compound filter. Refinements on fields the index can't filter on (the
  // code-examples toggle) are dropped.
  function toFilters (facetFilters) {
    if (!facetFilters) return {}
    if (typeof facetFilters === 'string') facetFilters = [facetFilters]
    var clauses = []
    facetFilters.forEach(function (group) {
      var parsed = [].concat(group).map(parseFacetFilter).filter(function (f) {
        return FILTERABLE.indexOf(f.attribute) !== -1
      })
      var any = parsed.filter(function (f) { return !f.negative }).map(function (f) {
        var clause = {}
        clause[f.attribute] = f.value
        return clause
      })
      if (any.length) clauses.push({ any: any })
      parsed.filter(function (f) { return f.negative }).forEach(function (f) {
        var clause = {}
        clause[f.attribute] = f.value
        clauses.push({ not: clause })
      })
    })
    return clauses.length ? { all: clauses } : {}
  }

  function withFilter (filters, clause) {
    return { all: (filters.all || []).concat([clause]) }
  }

  var decoder = document.createElement('textarea')
  function decodeEntities (html) {
    decoder.innerHTML = html
    return decoder.value
  }

  // Pagefind excerpts are HTML with <mark> around matches; InstantSearch
  // wants plain text with its own highlight tags.
  function toHighlighted (excerpt, preTag, postTag) {
    var open = '\u0001'
    var close = '\u0002'
    return decodeEntities(String(excerpt || '')
      .split('<mark>').join(open).split('</mark>').join(close)
      .replace(/<[^>]*>/g, ''))
      .split(open).join(preTag).split(close).join(postTag)
  }

  // Pagefind highlights only the excerpt, so headings and breadcrumbs are
  // highlighted here: any word starting with a query word.
  function highlightWords (text, queryWords, preTag, postTag) {
    if (text == null) return undefined
    text = String(text)
    var matched = []
    var value = queryWords.length
      ? text.replace(/[\p{L}\p{N}_]+/gu, function (word) {
        var lower = word.toLowerCase()
        var hit = queryWords.some(function (q) { return lower.indexOf(q) === 0 })
        if (!hit) return word
        matched.push(word)
        return preTag + word + postTag
      })
      : text
    return { value: value, matchLevel: matched.length ? 'full' : 'none', matchedWords: matched }
  }

  // The section that best matches: the sub-result with the most matched
  // words. Pagefind lists them in page order.
  function bestSection (data) {
    var best
    ;(data.sub_results || []).forEach(function (sub) {
      var count = (sub.locations || []).length
      if (!best || count > (best.locations || []).length) best = sub
    })
    return best
  }

  function toHit (data, params, queryWords) {
    var preTag = params.highlightPreTag || DEFAULT_PRE_TAG
    var postTag = params.highlightPostTag || DEFAULT_POST_TAG
    var meta = data.meta || {}
    var sections = {}
    try { sections = JSON.parse(meta.sections || '{}') } catch (e) {}

    var section = bestSection(data)
    var anchor = section && section.anchor && section.anchor.id
    var chain = (anchor && sections[anchor]) || []
    var hierarchy = { lvl0: meta.lvl0 || null, lvl1: meta.title || null }
    LEVELS.forEach(function (lvl, i) { hierarchy[lvl] = chain[i] || null })

    var excerpt = toHighlighted(section ? section.excerpt : data.excerpt, preTag, postTag)
    var plain = excerpt.split(preTag).join('').split(postTag).join('')
    var snippet = {
      value: excerpt,
      matchLevel: excerpt.indexOf(preTag) === -1 ? 'none' : 'full',
      matchedWords: [],
    }

    var highlightResult = { hierarchy: {}, content: snippet }
    Object.keys(hierarchy).forEach(function (lvl) {
      if (hierarchy[lvl]) highlightResult.hierarchy[lvl] = highlightWords(hierarchy[lvl], queryWords, preTag, postTag)
    })
    ;['breadcrumbs', 'description', 'keywords'].forEach(function (field) {
      if (meta[field]) highlightResult[field] = highlightWords(meta[field], queryWords, preTag, postTag)
    })

    var url = anchor ? (meta.url_without_anchor || data.url) + '#' + anchor : (meta.url_without_anchor || data.url)
    return {
      objectID: url,
      url: url,
      url_without_anchor: meta.url_without_anchor || data.url,
      anchor: anchor,
      type: 'content',
      content: plain,
      hierarchy: hierarchy,
      component: meta.component,
      component_title: meta.component_title,
      cversion: meta.cversion,
      component_version: meta.component_version,
      module: meta.module,
      nav_group: meta.nav_group,
      breadcrumbs: meta.breadcrumbs,
      description: meta.description,
      keywords: meta.keywords,
      version_rank: meta.version_rank,
      is_listing: false,
      _highlightResult: highlightResult,
      _snippetResult: { content: snippet },
      // Pagefind matches prefixes but has no typo tolerance
      _rankingInfo: { nbTypos: 0 },
    }
  }

  function facetsFor (requested, counts, nbHits) {
    var facets = {}
    requested.forEach(function (facet) {
      if (facet === 'is_listing') facets[facet] = { false: nbHits }
      else if (counts && counts[facet]) {
        facets[facet] = {}
        Object.keys(counts[facet]).forEach(function (value) {
          if (counts[facet][value]) facets[facet][value] = counts[facet][value]
        })
      }
    })
    return facets
  }

  function runSearch (pagefind, request) {
    var params = request.params || {}
    var started = Date.now()
    var query = (params.query || '').trim()
    var queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
    var filters = toFilters(params.facetFilters)
    var hitsPerPage = params.hitsPerPage === undefined ? 20 : params.hitsPerPage
    var page = params.page || 0
    var requested = [].concat(params.facets || []).filter(function (f) { return f !== '*' })
    var hasFilters = !!filters.all

    var searches
    if (!query && !hasFilters) {
      // Nothing to search for: InstantSearch only asks this to learn which
      // products and versions exist.
      searches = pagefind.filters().then(function (counts) {
        return { all: { results: [], filters: counts }, latest: { results: [] } }
      })
    } else {
      var term = query || null
      searches = Promise.all([
        pagefind.search(term, { filters: filters }),
        // Algolia ranks the current version of each product first, then by
        // relevance. Pagefind ranks by relevance only, so search the current
        // versions separately and put them first.
        query ? pagefind.search(term, { filters: withFilter(filters, { version_rank: LATEST }) }) : null,
      ]).then(function (found) {
        return { all: found[0], latest: found[1] || { results: [] } }
      })
    }

    return searches.then(function (found) {
      var seen = {}
      var ordered = []
      found.latest.results.concat(found.all.results).forEach(function (result) {
        if (seen[result.id]) return
        seen[result.id] = true
        ordered.push(result)
      })
      var nbHits = ordered.length
      var pageResults = ordered.slice(page * hitsPerPage, (page + 1) * hitsPerPage)
      return Promise.all(pageResults.map(function (result) { return result.data() })).then(function (pages) {
        return {
          index: request.indexName,
          hits: pages.map(function (data) { return toHit(data, params, queryWords) }),
          nbHits: nbHits,
          page: page,
          nbPages: hitsPerPage ? Math.ceil(nbHits / hitsPerPage) : 0,
          hitsPerPage: hitsPerPage,
          facets: facetsFor(requested, found.all.filters, nbHits),
          exhaustiveNbHits: true,
          exhaustiveFacetsCount: true,
          processingTimeMS: Date.now() - started,
          query: params.query || '',
          params: '',
        }
      })
    })
  }

  // options: { url } -- where the Pagefind bundle (pagefind.js) is served,
  // relative to the page or absolute.
  window.createPagefindSearchClient = function (options) {
    var base = new URL(options.url.replace(/\/?$/, '/'), document.baseURI).href
    var loaded
    function load () {
      if (!loaded) {
        // Through Function so the JS minifier never has to parse import()
        // eslint-disable-next-line no-new-func
        var importModule = new Function('url', 'return import(url)')
        loaded = importModule(base + 'pagefind.js').then(function (pagefind) {
          return Promise.resolve(pagefind.options({ basePath: base, excerptLength: 30 }))
            .then(function () { return pagefind.init() })
            .then(function () { return pagefind })
        })
      }
      return loaded
    }
    return {
      search: function (requests) {
        return load().then(function (pagefind) {
          return Promise.all(requests.map(function (request) { return runSearch(pagefind, request) }))
        }).then(function (results) {
          return { results: results }
        })
      },
      // not used: no widget here searches within facet values
      searchForFacetValues: function () {
        return Promise.resolve([])
      },
    }
  }

  // exposed for tests and debugging
  window.createPagefindSearchClient.toFilters = toFilters
})()
