'use strict'

// Builds a real Antora site (not the synthetic gulp preview) from this UI, for
// checking nav, version selectors, labels, search metadata and real content.
// See design-decisions/0002 (Phase 0, Tier 2).
//
//   node scripts/build-fixtures.js [--subset] [--playbook-only] [--skip-ui-build] [--skip-icons]
//
// The playbook is derived from docs-site/antora-playbook.preview2.yml so it
// follows that playbook's extensions and attributes, with these changes:
//  - work-in-progress branches (anything not in the main playbook's branch list
//    for that source) are reset to the main playbook's branches
//  - the UI bundle is this repo's freshly built build/ui-bundle.zip
//  - page-disable-chatbot is switched off so the Chat UI is exercised
//  - relative paths (url: ., ./lib/...) become absolute, so Antora can be run
//    from docs-site with a playbook that lives in build/
//  - the generator is pinned to docs-site's Antora, and docs-site's icon-definition step is run afterwards
//  - --subset keeps ~14 representative sources for quick local runs
//
// Env: DOCS_SITE_DIR (default ../docs-site), PORT for the hint printed at the end.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const root = path.resolve(__dirname, '..')
const docsSite = path.resolve(process.env.DOCS_SITE_DIR || path.join(root, '..', 'docs-site'))
const args = new Set(process.argv.slice(2))
const outDir = path.join(root, 'build', 'fixtures-site')
const playbookOut = path.join(root, 'build', 'fixtures-playbook.yml')
const bundle = path.join(root, 'build', 'ui-bundle.zip')

const SUBSET = [
  '.', 'docs-style-guide', 'docs-server', 'docs-capella', 'docs-capella-app-services', 'docs-ai',
  'docs-sdk-common', 'docs-sdk-java', 'docs-couchbase-lite', 'docs-sync-gateway', 'docs-operator',
  'docs-enterprise-analytics', 'docs-devex', 'docs-agentmemory',
]

const load = (name) => yaml.safeLoad(fs.readFileSync(path.join(docsSite, name), 'utf8'))
const repoName = (s) => (s.url === '.' ? '.' : s.url.replace(/\/$/, '').replace(/\.git$/, '').split('/').pop())
const key = (s) => repoName(s) + '|' + JSON.stringify(s.start_path || s.start_paths || '')
const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
// Antora resolves bare extension names relative to the playbook's directory (build/ here), so resolve them
// from docs-site's node_modules and relative ones from docs-site, and hand Antora absolute paths.
const abs = (p) => {
  if (typeof p !== 'string') return p
  if (p.startsWith('./')) return path.join(docsSite, p)
  if (path.isAbsolute(p)) return p
  try {
    return require.resolve(p, { paths: [docsSite] })
  } catch (e) {
    return p
  }
}

const run = (cmd, cmdArgs, cwd) => {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
}
// NOTE `gulp bundle` cleans build/ and public/, so it must run before anything is written to build/
if (!args.has('--playbook-only') && !args.has('--skip-ui-build')) run('npx', ['gulp', 'bundle'], root)

const main = load('antora-playbook.yml')
const playbook = load('antora-playbook.preview2.yml')

const mainSources = new Map(main.content.sources.map((s) => [key(s), s]))
const mainDefault = toArray(main.content.branches)
const report = []
playbook.content.sources = playbook.content.sources
  .filter((s) => !args.has('--subset') || SUBSET.includes(repoName(s)))
  .map((s) => {
    const base = mainSources.get(key(s))
    const mainBranches = base ? toArray(base.branches || mainDefault) : null
    if (mainBranches) {
      const branches = toArray(s.branches || playbook.content.branches)
      const wip = branches.filter((b) => b !== 'HEAD' && !mainBranches.includes(b))
      if (wip.length) {
        const kept = branches.filter((b) => !wip.includes(b))
        if (!kept.includes(mainBranches[0])) kept.unshift(mainBranches[0])
        report.push(`${repoName(s)}: ${branches.join(', ')} -> ${kept.join(', ')}`)
        s = { ...s, branches: kept }
      }
    }
    return s.url === '.' ? { ...s, url: docsSite } : s
  })

playbook.antora.extensions = (playbook.antora.extensions || []).map((e) =>
  typeof e === 'string' ? abs(e) : { ...e, require: abs(e.require) }
)
playbook.asciidoc.extensions = (playbook.asciidoc.extensions || []).map(abs)
playbook.asciidoc.attributes = { ...playbook.asciidoc.attributes, 'page-disable-chatbot': false }
playbook.site = { ...playbook.site, title: 'Couchbase Docs UI Fixtures', url: `http://localhost:${process.env.PORT || 5255}` }
playbook.ui = { ...playbook.ui, bundle: { url: bundle } }
// Pin the site generator to docs-site's own Antora. Antora resolves `@antora/site-generator` from the playbook's
// directory first, so a stray install further up the tree (e.g. ~/node_modules, which had 3.1.14) would otherwise
// win and break docs-site's extensions ("contentCatalog.createFile is not a function": needs Antora >= 3.2).
playbook.antora = { ...playbook.antora, generator: require.resolve('@antora/site-generator', { paths: [docsSite] }) }
playbook.output = { ...playbook.output, dir: outDir, clean: true }
playbook.git = { ...playbook.git, fetch_concurrency: 5 }

fs.mkdirSync(path.dirname(playbookOut), { recursive: true })
fs.writeFileSync(playbookOut, yaml.safeDump(playbook, { lineWidth: 160, noRefs: true }))
console.log(`Wrote ${playbookOut} (${playbook.content.sources.length} sources)`)
if (report.length) console.log('Reset work-in-progress branches to the main playbook:\n  ' + report.join('\n  '))
if (args.has('--playbook-only')) process.exit(0)
if (!fs.existsSync(bundle)) throw new Error(`Missing ${bundle}; run gulp bundle (or omit --skip-ui-build)`)
const antoraCli = path.join(docsSite, 'node_modules', '@antora', 'cli', 'bin', 'antora')
const antoraVersion = require(path.join(docsSite, 'node_modules', '@antora', 'cli', 'package.json')).version
if (antoraVersion.split('.').slice(0, 2).join('.') < '3.2') throw new Error(`docs-site's Antora is ${antoraVersion}; need >= 3.2`)
console.log(`Using docs-site's Antora ${antoraVersion}`)
run(process.execPath, [antoraCli, playbookOut], docsSite)
if (!args.has('--skip-icons')) {
  // docs-site's real pipeline fills in the FontAwesome icon definitions after the build (needs ripgrep and the Pro
  // packages from docs-site/scripts); without this step many header and landing-page icons render as placeholders.
  const populate = path.join(docsSite, 'scripts', 'populate-icon-defs')
  if (fs.existsSync(populate) && spawnSync('rg', ['--version']).status === 0) run('bash', [populate, outDir], docsSite)
  else console.warn('Skipping icon definitions (docs-site/scripts/populate-icon-defs or ripgrep missing); icons may be placeholders')
}
console.log(`\nBuilt ${path.relative(root, outDir)}. Serve it with:\n  node scripts/serve-public.js build/fixtures-site ${process.env.PORT || 5255}`)
