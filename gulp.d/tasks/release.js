'use strict'

const File = require('vinyl')
const fs = require('fs-extra')
const { obj: map } = require('through2')
const { Octokit } = require('@octokit/rest')
const path = require('path')
const vfs = require('vinyl-fs')
const zip = require('gulp-vinyl-zip')

function getNextReleaseNumber ({ octokit, owner, repo, variant }) {
  const prefix = `${variant}-`
  const filter = (entry) => entry.name.startsWith(prefix)
  return collectReleases({ octokit, owner, repo, filter }).then((releases) => {
    if (releases.length) {
      releases.sort((a, b) => -1 * a.name.localeCompare(b.name, 'en', { numeric: true }))
      const latestName = releases[0].name
      return Number(latestName.slice(prefix.length)) + 1
    } else {
      return 1
    }
  })
}

function collectReleases ({ octokit, owner, repo, filter, page = 1, accum = [] }) {
  return octokit.repos.listReleases({ owner, repo, page, per_page: 100 }).then((result) => {
    const releases = result.data.filter(filter)
    const links = result.headers.link
    if (links && links.includes('; rel="next"')) {
      return collectReleases({ octokit, owner, repo, filter, page: page + 1, accum: accum.concat(releases) })
    } else {
      return accum.concat(releases)
    }
  })
}

function versionBundle (bundleFile, tagName) {
  return new Promise((resolve, reject) =>
    vfs
      .src(bundleFile)
      .pipe(zip.src().on('error', reject))
      .pipe(
        map(
          (file, enc, next) => next(null, file),
          function (done) {
            this.push(new File({ path: 'ui.yml', contents: Buffer.from(`version: ${tagName}\n`) }))
            done()
          }
        )
      )
      .pipe(zip.dest(bundleFile))
      .on('finish', () => resolve(bundleFile))
  )
}

module.exports = (dest, bundleName, owner, repo, token) => async () => {
  const octokit = new Octokit({ auth: `token ${token}` })
  let branchName = process.env.GIT_BRANCH || 'master'
  if (branchName.startsWith('origin/')) branchName = branchName.substr(7)
  const variant = branchName === 'master' ? 'prod' : branchName
  const ref = `heads/${branchName}`

  // Get next tag based on the `variant` branch name
  const tagName = `${variant}-${await getNextReleaseNumber({ octokit, owner, repo, variant })}`
  const bundleFileBasename = `${bundleName}-bundle.zip`
  const bundleFile = await versionBundle(path.join(dest, bundleFileBasename), tagName)

  // Get most recent commit to tag
  const commit = await octokit.git.getRef({ owner, repo, ref }).then((result) => result.data.object.sha)

  // Create the actual release
  const uploadUrl = await octokit.repos
    .createRelease({
      owner,
      repo,
      tag_name: tagName,
      target_commitish: commit,
      name: tagName,
    })
    .then((result) => result.data.upload_url)

  // Upload assets related to the release
  await octokit.repos.uploadReleaseAsset({
    url: uploadUrl,
    data: fs.createReadStream(bundleFile),
    name: bundleFileBasename,
    headers: {
      'content-length': (await fs.stat(bundleFile)).size,
      'content-type': 'application/zip',
    },
  })

  console.log(`New release created - ${tagName}`)
}
