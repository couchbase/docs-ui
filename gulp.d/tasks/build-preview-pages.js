'use strict'

const Asciidoctor = require('@asciidoctor/core')()
const File = require('vinyl')
const fs = require('fs-extra')
const handlebars = require('handlebars')
const iconPacks = {
  fas: (() => {
    try {
      return require('@fortawesome/pro-solid-svg-icons')
    } catch (e) {
      return require('@fortawesome/free-solid-svg-icons')
    }
  })(),
  far: (() => {
    try {
      return require('@fortawesome/pro-regular-svg-icons')
    } catch (e) {
      return require('@fortawesome/free-regular-svg-icons')
    }
  })(),
  fal: (() => {
    try {
      return require('@fortawesome/pro-light-svg-icons')
    } catch (e) {
      console.log('FontAwesome Light icons not found.')
      return null
    }
  })(),
  fab: require('@fortawesome/free-brands-svg-icons'),
}
iconPacks.fa = iconPacks.fas
const iconShims = require('@fortawesome/fontawesome-free/js/v4-shims').reduce((accum, it) => {
  accum['fa-' + it[0]] = [it[1] || 'fas', 'fa-' + (it[2] || it[0])]
  return accum
}, {})
const { inspect } = require('util')
const { obj: map } = require('through2')
const merge = require('merge-stream')
const ospath = require('path')
const path = ospath.posix
const requireFromString = require('require-from-string')
const vfs = require('vinyl-fs')
const yaml = require('js-yaml')

const ASCIIDOC_ATTRIBUTES = {
  experimental: '',
  icons: 'font',
  sectanchors: '',
  'source-highlighter': 'highlight.js',
  'page-watermark': '2025-01-09 docs-sdk-nodejs add-preview-metadata',
  'page-show-preview-banner': true,
}

module.exports =
  (src, previewSrc, previewDest, sink = () => map()) =>
    (done) =>
      Promise.all([
        loadSampleUiModel(previewSrc),
        toPromise(
          merge(compileLayouts(src), registerPartials(src), registerHelpers(src), copyImages(previewSrc, previewDest))
        ),
      ])
        .then(([baseUiModel, { layouts }]) => {
          const extensions = ((baseUiModel.asciidoc || {}).extensions || []).map((request) => {
            ASCIIDOC_ATTRIBUTES[request.replace(/^@|\.js$/, '').replace(/[/]/g, '-') + '-loaded'] = ''
            const extension = require(request)
            extension.register.call(Asciidoctor.Extensions)
            return extension
          })
          const asciidoc = { extensions }
          for (const component of Object.values(baseUiModel.site.components)) {
            for (const version of component.versions || []) version.asciidoc = asciidoc
          }
          baseUiModel = { ...baseUiModel, env: process.env }
          delete baseUiModel.asciidoc
          return [baseUiModel, layouts]
        })
        .then(([baseUiModel, layouts, iconDefs = new Map()]) =>
          vfs
            .src('**/*.adoc', { base: previewSrc, cwd: previewSrc })
            .pipe(
              map(
                (file, enc, next) => {
                  const siteRootPath = path.relative(ospath.dirname(file.path), ospath.resolve(previewSrc))
                  const uiModel = {
                    ...baseUiModel,
                    preview: true,
                    siteRootPath,
                    siteRootUrl: path.join(siteRootPath, 'index.html'),
                    uiRootPath: path.join(siteRootPath, '_'),
                  }
                  if (file.stem === '404') {
                    uiModel.page = { layout: '404', title: 'Page Not Found' }
                  } else {
                    const pageModel = (uiModel.page = { ...uiModel.page })
                    const doc = Asciidoctor.load(file.contents, { safe: 'safe', attributes: ASCIIDOC_ATTRIBUTES })
                    const attributes = doc.getAttributes()
                    pageModel.layout = doc.getAttribute('page-layout', 'default')
                    pageModel.title = doc.getDocumentTitle()
                    pageModel.url = '/' + file.relative.slice(0, -5) + '.html'
                    if (file.stem === 'home') pageModel.home = true
                    const componentName = doc.getAttribute('page-component-name', pageModel.src.component)
                    const versionString = doc.getAttribute(
                      'page-version',
                      doc.hasAttribute('page-component-name') ? undefined : pageModel.src.version
                    )
                    let component
                    let componentVersion
                    if (componentName) {
                      component = pageModel.component = uiModel.site.components[componentName]
                      componentVersion = pageModel.componentVersion = versionString
                        ? component.versions.find(({ version }) => version === versionString)
                        : component.latest
                    } else {
                      component = pageModel.component = Object.values(uiModel.site.components)[0]
                      componentVersion = pageModel.componentVersion = component.latest
                    }
                    pageModel.module = 'ROOT'
                    pageModel.relativeSrcPath = file.relative
                    pageModel.version = componentVersion.version
                    pageModel.displayVersion = componentVersion.displayVersion
                    pageModel.editUrl = pageModel.origin.editUrlPattern.replace('%s', file.relative)
                    pageModel.navigation = componentVersion.navigation || []
                    pageModel.breadcrumbs = findNavPath(pageModel.url, pageModel.navigation)
                    if (pageModel.component.versions.length > 1) {
                      pageModel.versions = pageModel.component.versions.map(
                        ({ version, displayVersion, url }, idx, arr) => {
                          const pageVersion = { version, displayVersion: displayVersion || version, url }
                          if (version === component.latest.version) pageVersion.latest = true
                          if (idx === arr.length - 1) {
                            delete pageVersion.url
                            pageVersion.missing = true
                          }
                          return pageVersion
                        }
                      )
                    }
                    pageModel.attributes = Object.entries({ ...attributes, ...componentVersion.asciidoc.attributes })
                      .filter(([name, val]) => name.startsWith('page-'))
                      .reduce((accum, [name, val]) => ({ ...accum, [name.substr(5)]: val }), {})

                    pageModel.contents = Buffer.from(
                      doc
                        .convert()
                      // NOTE emulates the behavior of the view source url extension
                        .replace(
                          /<pre([^>]*)(><code[^>]*)?>\[data-source-url=(.+?)\]\n/g,
                          '<pre$1$2 data-source-url="$3">'
                        )
                    )
                  }
                  file.extname = '.html'
                  try {
                    file.contents = Buffer.from(layouts.get(uiModel.page.layout)(uiModel))
                    registerIconDefs(iconDefs, file)
                    next(null, file)
                  } catch (e) {
                    next(transformHandlebarsError(e, uiModel.page.layout))
                  }
                },
                function (done) {
                  if (baseUiModel.navMode === 'client') this.push(exportSiteNavigationData(baseUiModel.site.components))
                  vfs
                    .src('js/vendor/fontawesome-icon-defs.js', { base: src, cwd: src })
                    .pipe(
                      map((file, enc, next) => {
                        registerIconDefs(iconDefs, file)
                        file.contents = Buffer.from(
                        `window.FontAwesomeIconDefs = ${JSON.stringify([...iconDefs.values()])}\n`
                        )
                        // NOTE parallel build overwrites default fontawesome-icon-defs.js; use alternate path
                        file.dirname = file.base
                        this.push(file)
                        next()
                      })
                    )
                    .on('finish', done)
                }
              )
            )
            .pipe(vfs.dest(previewDest))
            .on('error', (e) => done)
            .pipe(sink())
        )

function loadSampleUiModel (src) {
  return fs.readFile(ospath.join(src, 'ui-model.yml'), 'utf8').then((contents) => {
    const uiModel = yaml.safeLoad(contents)
    if (process.env.DEPLOY_PRIME_URL) uiModel.site.url = process.env.DEPLOY_PRIME_URL
    Object.entries(uiModel.site.components).forEach(([name, component]) => {
      component.name = name
      if (!component.versions) component.versions = [(component.latest = { url: '#' })]
      component.versions.forEach((version) => {
        Object.defineProperty(version, 'name', { value: component.name, enumerable: true })
        if (!('displayVersion' in version)) version.displayVersion = version.version
        if (!('asciidoc' in version)) version.asciidoc = { attributes: {} }
      })
      Object.defineProperties(component, {
        asciidoc: {
          get () {
            return this.latest.asciidoc
          },
        },
        title: {
          get () {
            return this.latest.title
          },
        },
        url: {
          get () {
            return this.latest.url
          },
        },
      })
    })
    return uiModel
  })
}

function registerPartials (src) {
  return vfs.src('partials/*.hbs', { base: src, cwd: src }).pipe(
    map((file, enc, next) => {
      handlebars.registerPartial(file.stem, file.contents.toString())
      next()
    })
  )
}

function registerHelpers (src) {
  handlebars.registerHelper('relativize', relativize)
  handlebars.registerHelper('resolvePage', resolvePage)
  handlebars.registerHelper('resolvePageURL', resolvePageURL)
  return vfs.src('helpers/*.js', { base: src, cwd: src }).pipe(
    map((file, enc, next) => {
      handlebars.registerHelper(file.stem, requireFromString(file.contents.toString()))
      next()
    })
  )
}

function compileLayouts (src) {
  const layouts = new Map()
  return vfs.src('layouts/*.hbs', { base: src, cwd: src }).pipe(
    map(
      (file, enc, next) => {
        const srcName = path.join(src, file.relative)
        layouts.set(file.stem, handlebars.compile(file.contents.toString(), { preventIndent: true, srcName }))
        next()
      },
      function (done) {
        this.push({ layouts })
        done()
      }
    )
  )
}

function copyImages (src, dest) {
  return vfs.src('**/*.{png,svg,yaml}', { base: src, cwd: src }).pipe(vfs.dest(dest))
}

function exportSiteNavigationData (components) {
  const navigationData = Object.values(components).map(({ name, title, versions }) => ({
    name,
    title,
    versions: versions.map(({ version, displayVersion, navigation: sets = [] }) =>
      version === displayVersion ? { version, sets } : { version, displayVersion, sets }
    ),
  }))
  return new File({
    contents: Buffer.from(
      'window.siteNavigationData = ' + inspect(navigationData, { depth: null, maxArrayLength: null, breakLength: 250 })
    ),
    path: '_/js/site-navigation-data.js',
  })
}

function findNavPath (currentUrl, node = [], current_path = [], root = true) {
  for (const item of node) {
    const { url, items } = item
    if (url === currentUrl) {
      return current_path.concat(item)
    } else if (items) {
      const activePath = findNavPath(currentUrl, items, current_path.concat(item), false)
      if (activePath) return activePath
    }
  }
  if (root) return []
}

function registerIconDefs (iconDefs, file) {
  const contents = file.contents.toString()
  let iconNames = []
  if (file.extname === '.js') {
    try {
      iconNames = JSON.parse(contents.match(/\biconNames: *(\[.*?\])/)[1].replace(/'/g, '"'))
    } catch (e) {}
  } else if (contents.includes('<i class="fa')) {
    iconNames = contents
      .match(/<i class="fa[brs]? fa-[^" ]+/g)
      .map((it) => it.substr(10))
  }
  if (!iconNames.length) return
  ;[...new Set(iconNames)].reduce((accum, iconKey) => {
    if (!accum.has(iconKey)) {
      const [iconPrefix, iconName] = iconKey.split(' ').slice(0, 2)
      let iconDef = (iconPacks[iconPrefix] || {})[camelCase(iconName)]
      if (iconDef) {
        return accum.set(iconKey, { ...iconDef, prefix: iconPrefix })
      } else if (iconPrefix === 'fa') {
        const [realIconPrefix, realIconName] = iconShims[iconName] || []
        if (
          realIconName &&
          !accum.has((iconKey = `${realIconPrefix} ${realIconName}`)) &&
          (iconDef = (iconPacks[realIconPrefix] || {})[camelCase(realIconName)])
        ) {
          return accum.set(iconKey, { ...iconDef, prefix: realIconPrefix })
        }
      }
    }
    return accum
  }, iconDefs)
}

function relativize (url) {
  return url ? (url.charAt() === '#' ? url : url.slice(1)) : '#'
}

function resolvePage (spec, context = {}) {
  if (spec) return { pub: { url: resolvePageURL(spec) } }
}

function resolvePageURL (spec, context = {}) {
  if (spec) return '/' + (spec = spec.split(':').pop()).slice(0, spec.lastIndexOf('.')) + '.html'
}

function transformHandlebarsError ({ message, stack }, layout) {
  const m = stack.match(/^ *at Object\.ret \[as (.+?)\]/m)
  const templatePath = `src/${m ? 'partials/' + m[1] : 'layouts/' + layout}.hbs`
  const err = new Error(`${message}${~message.indexOf('\n') ? '\n^ ' : ' '}in UI template ${templatePath}`)
  err.stack = [err.toString()].concat(stack.substr(message.length + 8)).join('\n')
  return err
}

function toPromise (stream) {
  return new Promise((resolve, reject, data = {}) =>
    stream
      .on('error', reject)
      .on('data', (chunk) => chunk.constructor === Object && Object.assign(data, chunk))
      .on('finish', () => resolve(data))
  )
}

function camelCase (str) {
  return str.replace(/-(.)/g, (_, l) => l.toUpperCase())
}
