;(function () {
  'use strict'

  // if (Math.max(window.screen.availHeight, window.screen.availWidth) > 769) return
  window.addEventListener('load', function () {
    // var config = document.getElementById('feedback-script').dataset
    var script = document.createElement('script')
    // eslint-disable-next-line max-len
    script.src = 'https://couchbasecloud.atlassian.net/s/d41d8cd98f00b204e9800998ecf8427e-T/-3ddrgv/b/7/c95134bc67d3a521bb3f4331beb9b804/_/download/batch/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector/com.atlassian.jira.collector.plugin.jira-issue-collector-plugin:issuecollector.js?locale=en-GB&collectorId=69d1d56c' // prettier-ignore
    document.body.appendChild(script)
  })
})()
