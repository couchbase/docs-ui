;(function () {
  const { algoliasearch, instantsearch } = window
  const { connectRefinementList } = instantsearch.connectors

  const searchClient = algoliasearch(
    'NI1G57N08Q',
    'b0220d43cdb2149dec7d9a39bc3053b4'
  )

  const indexName = 'hosted-crawler-docs-site-index'
  const search = instantsearch({
    indexName,
    initialUiState: {
      'hosted-crawler-docs-site-index': {
        refinementList: {
          component_version: ['server@8.0', 'server@7.6', 'server@7.2'],
        },
      },
    },
    searchClient,
    future: { preserveSharedStateOnUnmount: true },
    insights: true,
  })

  const renderRefinementList = (renderOptions, isFirstRender) => {
    let { items } = renderOptions
    const {
      refine,
      widgetParams,
    } = renderOptions

    const container = document.querySelector(widgetParams.container)

    if (isFirstRender) {
      const ul = document.createElement('ul')

      const debug = document.createElement('pre')
      debug.textContent = JSON.stringify(Object.keys(renderOptions), null, 2)
      // container.appendChild(debug)

      container.appendChild(ul)
    }

    /* items look like:
    * {
    * "count":19926,
    * "isRefined":true,
    * "value":"server@8.0",
    * "label":"server@8.0",
    * "highlighted":"server@8.0",
    * "component":"server", // <-- extracted from label
    * "version":"8.0"       // "
    * }
    */

    items = items.map((item) => {
      const [component, version] = item.label.split('@')
      return {
        ...item,
        component,
        version,
      }
    })
    const grouped = (
      Object.entries(
        Object.groupBy(items, (item) => item.component))
        .sort(([componentA], [componentB]) => componentA.localeCompare(componentB))
        .map(([component, items]) => {
          const allItems = (items.length > 1) && items.every((item) => item.isRefined)
          const itemsWithSelected = items.map((item) => ({
            ...item,
            isSelected: allItems ? false : item.isRefined,
          }))
          return [
            component,
            itemsWithSelected,
            allItems,
          ]
        }))

    container.querySelector('ul').innerHTML =
      grouped
        .map(
          ([component, items, allItems]) => {
            const anyRefined = items.some((item) => item.isRefined)
            const totalCount = items.reduce((sum, item) => sum + item.count, 0)
            const showSelect = anyRefined && (items.length > 1 || !['', 'master'].includes(items[0].version))
            return `
            <li class="refinement-item">
              <a
                href="#"
                data-component="${component}"
                data-value="${items[0].value}"
                style="font-weight: ${anyRefined ? 'bold' : ''}"
              >
                ${component} </a> <span style="font-size: 0.7em">(${totalCount})</span>
              
              <br />
            ${showSelect ? `
            <select name="${component}">
              ${items.length > 1 ? `<option value="ALL" data-value="" ${allItems ? 'selected' : ''}>
                All versions
              </option>` : ''}

              ${items.map((item) =>
                `<option
                  value="${item.value}"
                  data-component="${component}"
                  data-value="${item.value}"
                  ${item.isSelected ? 'selected' : ''}
                >
                  ${item.version} (${item.count})
                </option>`).join('')}
            </select>` : ''}
            </li>`
          }
        ).join('')

    container.querySelectorAll('a').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault()

        const select = container.querySelector(`select[name="${event.currentTarget.dataset.component}"]`)
        if (select) {
          const selected = select.value
          // there are selected options, so refine (e.g. toggle) them all off
          if (selected === 'ALL') {
            const options = Array.from(select.options).map((option) => option.dataset.value).slice(1)
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
    container.querySelectorAll('select').forEach((element) => {
      const prev = element.value
      element.addEventListener('change', (event) => {
        const value = element.value
        const options = Array.from(element.options).map((option) => option.dataset.value).slice(1)

        if (prev === 'ALL') {
          // deselect all except new version
          options.filter((option) => option !== value).forEach(refine)
        } else if (value === 'ALL') {
          // select all (except old version)
          options.filter((option) => option !== prev).forEach((item) => {
            refine(item)
          })
        } else {
          // simply toggle prev (to off) and value (to on)
          refine(prev)
          refine(value)
        }
      })
    })
  }

  // 2. Create the custom widget
  const customRefinementList = connectRefinementList(renderRefinementList)

  search.addWidgets([
    instantsearch.widgets.searchBox({
      container: '#searchbox',
      placeholder: 'Search Docs',
    }),
    instantsearch.widgets.hits({
      container: '#hits',
      templates: {
        item: (hit, { html, components }) => {
          const attribute = hit.type === 'content' ? 'hierarchy.lvl1' : `hierarchy.${hit.type}`

          hit.breadcrumbs = hit.breadcrumbs.replace(/^\s*\/\s*/, '')
          if (hit.cversion && hit.cversion !== 'master') {
            hit.breadcrumbs = hit.breadcrumbs.replace(/\//, `${hit.cversion} /`)
          }
          return html`
          <div>
            <details>
              <summary>
              ${hit.type}...
              </summary>
              <pre>${JSON.stringify(hit, null, 2)}</pre>
            </details>
                
            <div class="labels">
              ${hit.component_title} ${hit.cversion} 
            </div>
            
            <h1 class="hit-name">
              ${components.Highlight({ hit, attribute })}
            </h1>
            <br/>
            <div class="highlights">
              ${components.Highlight({ hit, attribute: 'breadcrumbs' })}
              <br/>
              <blockquote>
              ${components.Snippet({ hit, attribute: 'content' })}
              </blockquote>
            </div>
            <div class="url">
              <a href="${hit.url}">${hit.url}</a>
            </div>
          </div>`
        },
      },
    }),
    instantsearch.widgets.clearRefinements({
      container: '#clear-refinements',
    }),

    customRefinementList({
      container: '#component-list',
      attribute: 'component_version',
      limit: 1000,
    }),
    instantsearch.widgets.configure({
      hitsPerPage: 20,
      maxValuesPerFacet: 1000,
    }),
    instantsearch.widgets.pagination({
      container: '#pagination',
    }),
  ])

  function clearSearch () {
    const input = document.querySelector('#searchbox input')
    if (!input) return
    console.log('clearing search')
    input.value = ''
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  }

  const searchPanel = document.querySelector('.search-panel')

  search.on('render', () => {
    const query = search.renderState[indexName]?.searchBox?.query
    searchPanel.style.visibility = query ? 'visible' : 'hidden'
  })

  document.addEventListener('click', (e) => {
    // if we've clicked somewhere outside the search panel:
    // special case refinement-item, as they are *rendered* inside the search panel, but
    // Algolia's JS tears them out of the DOM before we get to it.
    if (!e.target.closest('.search-container, .refinement-item')) {
      clearSearch()
    } else {
      console.log('clicked inside search panel', e.target)
    }
  })

  search.start()
})()
