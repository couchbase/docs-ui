;(function () {
  'use strict'

  // A search client for InstantSearch that talks to Typesense instead of
  // Algolia. InstantSearch only needs an object with a search(requests)
  // method that resolves to Algolia-shaped results, so 13-docsearch.js can
  // keep every widget, template and facet exactly as it is and just be handed
  // this client instead of algoliasearch's.
  //
  // Loaded before 13-docsearch.js (files are concatenated in name order).
  // Used only when the search container carries a data-typesense-url,
  // which the UI templates emit when TYPESENSE_URL is set at build time.

  // Mirrors SEARCH_PARAMS in docs-site/lib/search-typesense-config.js, which
  // in turn mirrors the Algolia index settings. Keep the two in step.
  var QUERY_BY = [
    'keywords',
    'hierarchy.lvl1',
    'hierarchy.lvl2',
    'hierarchy.lvl3',
    'hierarchy.lvl4',
    'hierarchy.lvl5',
    'hierarchy.lvl6',
    'content',
    'breadcrumbs',
  ]
  // Algolia's attributesToHighlight. description is highlighted but not
  // searched, as in Algolia.
  var HIGHLIGHT_FIELDS = QUERY_BY.concat(['description'])
  var BASE_PARAMS = {
    query_by: QUERY_BY.join(','),
    query_by_weights: '9,8,7,6,5,4,3,2,1',
    group_by: 'url_without_anchor',
    sort_by: 'version_rank:asc,_text_match:desc,rank:desc',
    text_match_type: 'max_weight',
    prioritize_num_matching_fields: false,
    num_typos: 2,
    min_len_1typo: 4,
    min_len_2typo: 7,
    prefix: true,
    drop_tokens_threshold: 1,
    stopwords: 'docs-search',
    highlight_fields: HIGHLIGHT_FIELDS.join(','),
    // everything except content comes back whole; content only as a snippet
    highlight_full_fields: HIGHLIGHT_FIELDS.filter(function (f) { return f !== 'content' }).join(','),
    highlight_affix_num_tokens: 12,
  }

  var DEFAULT_PRE_TAG = '__ais-highlight__'
  var DEFAULT_POST_TAG = '__/ais-highlight__'

  // "attr:value" / "attr:-value", as InstantSearch writes facet refinements
  function parseFacetFilter (filter) {
    var at = filter.indexOf(':')
    var attribute = filter.slice(0, at)
    var value = filter.slice(at + 1)
    var negative = value.charAt(0) === '-'
    if (negative) value = value.slice(1)
    return { attribute: attribute, value: value, negative: negative }
  }

  function filterValue (value) {
    if (value === 'true' || value === 'false') return value
    return '`' + value.replace(/`/g, '') + '`'
  }

  // Algolia facetFilters: the outer array is AND, an inner array is OR.
  function toFilterBy (facetFilters) {
    if (!facetFilters) return undefined
    if (typeof facetFilters === 'string') facetFilters = [facetFilters]
    var clauses = facetFilters.map(function (group) {
      var parsed = [].concat(group).map(parseFacetFilter)
      var positive = parsed.filter(function (f) { return !f.negative })
      var negative = parsed.filter(function (f) { return f.negative })
      var parts = []
      // an OR group is nearly always several values of one attribute
      var byAttribute = {}
      positive.forEach(function (f) {
        (byAttribute[f.attribute] = byAttribute[f.attribute] || []).push(filterValue(f.value))
      })
      Object.keys(byAttribute).forEach(function (attribute) {
        parts.push(attribute + ':=[' + byAttribute[attribute].join(',') + ']')
      })
      negative.forEach(function (f) { parts.push(f.attribute + ':!=' + filterValue(f.value)) })
      return parts.length > 1 ? '(' + parts.join(' || ') + ')' : parts[0]
    }).filter(Boolean)
    return clauses.length ? clauses.join(' && ') : undefined
  }

  function toTypesenseSearch (request) {
    var params = request.params || {}
    var facets = [].concat(params.facets || []).filter(function (f) { return f !== '*' })
    var distinct = params.distinct === true ? 1 : (parseInt(params.distinct, 10) || 1)
    var search = Object.assign({}, BASE_PARAMS, {
      collection: request.indexName,
      q: params.query || '*',
      page: (params.page || 0) + 1,
      per_page: params.hitsPerPage === undefined ? 20 : params.hitsPerPage,
      // Algolia's distinct: how many records of one page may be returned
      group_limit: distinct,
      highlight_start_tag: params.highlightPreTag || DEFAULT_PRE_TAG,
      highlight_end_tag: params.highlightPostTag || DEFAULT_POST_TAG,
    })
    if (facets.length) {
      search.facet_by = facets.join(',')
      search.max_facet_values = params.maxValuesPerFacet || 100
    }
    var filterBy = toFilterBy(params.facetFilters)
    if (filterBy) search.filter_by = filterBy
    return search
  }

  function getPath (object, path) {
    return path.split('.').reduce(function (o, key) { return o == null ? undefined : o[key] }, object)
  }

  function setPath (object, path, value) {
    var keys = path.split('.')
    var last = keys.pop()
    keys.forEach(function (key) { object = object[key] = object[key] || {} })
    object[last] = value
  }

  // Builds Algolia's _highlightResult / _snippetResult from Typesense's
  // highlight object. Fields that did not match still get an entry holding
  // their plain value, because the hit templates render through
  // components.Highlight whether or not there was a match.
  function highlightResults (hit) {
    var highlight = hit.highlight || {}
    var highlightResult = {}
    var snippetResult = {}
    HIGHLIGHT_FIELDS.forEach(function (field) {
      var raw = getPath(hit.document, field)
      if (raw == null) return
      var found = getPath(highlight, field)
      var matched = !!(found && found.matched_tokens && found.matched_tokens.length)
      var entry = function (value) {
        return {
          value: value,
          matchLevel: matched ? 'full' : 'none',
          matchedWords: matched ? found.matched_tokens : [],
        }
      }
      if (field === 'content') {
        // content is only ever shown as a snippet; unmatched content is cut
        // down the way Algolia's attributesToSnippet would
        var snippet = matched ? found.snippet : String(raw).split(/\s+/).slice(0, 25).join(' ')
        setPath(snippetResult, field, entry(snippet))
        setPath(highlightResult, field, entry(snippet))
      } else {
        setPath(highlightResult, field, entry(matched ? (found.value || found.snippet) : String(raw)))
      }
    })
    return { highlightResult: highlightResult, snippetResult: snippetResult }
  }

  // Did this hit match the words as typed, or only through typo tolerance?
  // Typesense has no per-hit typo count, so compare what it matched against
  // what was asked for. A prefix match ("auth" finding "authentication")
  // counts as exact, as it does in Algolia.
  function neededTypo (hit, queryWords) {
    if (!queryWords.length) return false
    var matched = []
    ;(hit.highlights || []).forEach(function (h) {
      (h.matched_tokens || []).forEach(function (token) {
        // an array field reports a list of token lists
        [].concat(token).forEach(function (t) { matched.push(String(t).toLowerCase()) })
      })
    })
    if (!matched.length) return false
    return !matched.some(function (token) {
      return queryWords.some(function (word) { return token.indexOf(word) === 0 })
    })
  }

  function toAlgoliaResult (request, result) {
    var params = request.params || {}
    if (result.error) throw new Error('Typesense: ' + result.error)

    var queryWords = (params.query || '').toLowerCase().split(/\s+/).filter(Boolean)
    var hits = []
    ;(result.grouped_hits || []).forEach(function (group) {
      group.hits.forEach(function (hit) {
        var results = highlightResults(hit)
        hits.push(Object.assign({}, hit.document, {
          objectID: hit.document.id,
          _highlightResult: results.highlightResult,
          _snippetResult: results.snippetResult,
          _rankingInfo: { nbTypos: neededTypo(hit, queryWords) ? 1 : 0 },
        }))
      })
    })

    var facets = {}
    ;(result.facet_counts || []).forEach(function (facet) {
      facets[facet.field_name] = {}
      facet.counts.forEach(function (count) { facets[facet.field_name][count.value] = count.count })
    })

    var hitsPerPage = params.hitsPerPage === undefined ? 20 : params.hitsPerPage
    var nbHits = result.found || 0
    return {
      index: request.indexName,
      hits: hits,
      nbHits: nbHits,
      page: params.page || 0,
      nbPages: hitsPerPage ? Math.ceil(nbHits / hitsPerPage) : 0,
      hitsPerPage: hitsPerPage,
      facets: facets,
      exhaustiveNbHits: true,
      exhaustiveFacetsCount: true,
      processingTimeMS: result.search_time_ms || 0,
      query: params.query || '',
      params: '',
    }
  }

  // options: { url, apiKey } -- apiKey must be a search-only key, since it is
  // visible to anyone who views the page (the same is true of Algolia's).
  window.createTypesenseSearchClient = function (options) {
    var endpoint = options.url.replace(/\/$/, '') + '/multi_search'
    return {
      search: function (requests) {
        return window.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain', 'X-TYPESENSE-API-KEY': options.apiKey },
          body: JSON.stringify({ searches: requests.map(toTypesenseSearch) }),
        }).then(function (response) {
          if (!response.ok) throw new Error('Typesense search failed: ' + response.status)
          return response.json()
        }).then(function (body) {
          return {
            results: body.results.map(function (result, i) { return toAlgoliaResult(requests[i], result) }),
          }
        })
      },
      // not used: no widget here searches within facet values
      searchForFacetValues: function () {
        return Promise.resolve([])
      },
    }
  }

  // exposed for tests and debugging
  window.createTypesenseSearchClient.toFilterBy = toFilterBy
})()
