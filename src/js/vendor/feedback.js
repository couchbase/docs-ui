;(function () {
  'use strict'

  // if (Math.max(window.screen.availHeight, window.screen.availWidth) > 769) return
  window.addEventListener('load', function () {
    // var config = document.getElementById('feedback-script').dataset
    var script = document.createElement('script')
    // eslint-disable-next-line max-len
    script.src = 'https://couchbasecloud-sandbox-881.atlassian.net/s/d41d8cd98f00b204e9800998ecf8427e-T/-3ddrgv/b/7/b0105d975e9e59f24a3230a22972a71a/_/download/batch/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector-embededjs/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector-embededjs.js?locale=en-US&collectorId=3f4339ab' // prettier-ignore
    document.body.appendChild(script)
  })
})()
