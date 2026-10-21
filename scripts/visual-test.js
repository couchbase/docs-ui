'use strict'

// Runs the visual-regression suite in a controlled environment: builds the preview, then runs Playwright.
//
//   node scripts/visual-test.js                      compare against baselines
//   node scripts/visual-test.js --update-snapshots   (re)write baselines
//
// The preview's output depends on environment variables (ALGOLIA_*, OPTANON_*, CHATBOT_*, JIRA_COLLECTOR_ID,
// SHOW_FEEDBACK_BUTTON, CI, ...), so a shell that has them set renders different pages (e.g. a search bar) from
// one that does not. Everything is scrubbed here and a fixed dummy search config is set, so baselines are the
// same wherever they are generated. External requests are blocked by the tests, so the dummy values are inert.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const bin = (name) => path.join(root, 'node_modules', '.bin', name)

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  ALGOLIA_APP_ID: 'VISUALTEST',
  ALGOLIA_API_KEY: 'visualtest-key',
  ALGOLIA_API_KEY_SEARCH: 'visualtest-key',
  ALGOLIA_INDEX_NAME: 'visual_test',
  ALGOLIA_IDX_NAME: 'visual_test',
}
// test controls (not rendering inputs) that may be passed through
for (const name of ['VISUAL_PORT', 'A11Y_UPDATE']) if (process.env[name]) env[name] = process.env[name]
Object.keys(env).forEach((k) => env[k] === undefined && delete env[k])

// Icons: the preview renders real icons only if the FontAwesome Pro packages are installed (see README).
if (!fs.existsSync(path.join(root, 'node_modules', '@fortawesome', 'pro-solid-svg-icons'))) {
  console.warn(
    'WARNING: FontAwesome Pro packages are not installed, so some icons will not render and screenshots will ' +
      'differ from baselines made with them. See the README for the .npmrc token.'
  )
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
}
run(bin('gulp'), ['preview:build'])
run(bin('playwright'), ['test', ...process.argv.slice(2)])
