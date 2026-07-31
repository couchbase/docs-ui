'use strict'

// Overrides for the short, pill-sized label shown in search current-refinements.
// Any component not listed here falls back to its real Antora title. Carried
// over from the docs-search-sketch mock catalog (shortName values were made
// up there per Hakim, 2026-07-30) as a starting point -- refine as needed.
//
// Inlined here rather than required from a separate JSON file: Antora loads UI
// bundle helpers from a packaged zip with no guaranteed real filesystem path
// (its own page-composer passes helper source to requireFromString without a
// filename), so a helper can never require() another file in the bundle --
// everything it needs has to be self-contained in the one file.
const shortNames = {
  server: 'Server',
  operator: 'Operator',
  'enterprise-analytics': 'EA',
  'cloud-native-gateway': 'CNG',
  'couchbase-lite': 'CBL',
  'couchbase-lite-javascript': 'CBL-JS',
  'sync-gateway': 'SGW',
  'couchbase-edge-server': 'Edge',
  cloud: 'Capella',
  'app-services': 'App Services',
  analytics: 'Capella Analytics',
  ai: 'AI',
  'mcp-server': 'MCP',
  'dotnet-sdk': '.NET',
  'efcore-provider': 'EF Core',
  'c-sdk': 'C',
  'cxx-sdk': 'C++',
  'go-sdk': 'Go',
  'java-sdk': 'Java',
  'quarkus-extension': 'Quarkus',
  'kotlin-sdk': 'Kotlin',
  'nodejs-sdk': 'Node.js',
  'php-sdk': 'PHP',
  'python-sdk': 'Python',
  'ruby-sdk': 'Ruby',
  'rust-sdk': 'Rust',
  'scala-sdk': 'Scala',
  'elasticsearch-connector': 'Elasticsearch',
  'kafka-connector': 'Kafka',
  'spark-connector': 'Spark',
  'tableau-connector': 'Tableau',
  'power-bi-connector': 'Power BI',
  'superset-connector': 'Superset',
  'sdk-extensions': 'SDK Ext',
  'dotnet-analytics-sdk': '.NET Analytics',
  'go-analytics-sdk': 'Go Analytics',
  'java-analytics-sdk': 'Java Analytics',
  'nodejs-analytics-sdk': 'Node Analytics',
  'python-analytics-sdk': 'Python Analytics',
  'go-columnar-sdk': 'Go Columnar',
  'java-columnar-sdk': 'Java Columnar',
  'nodejs-columnar-sdk': 'Node Columnar',
  'python-columnar-sdk': 'Python Columnar',
  home: 'Docs',
  styleguide: 'Style',
  'ui-ux': 'UI/UX',
  pendo: 'Pendo',
  cbmultimanager: 'Cluster Monitor',
  cmos: 'CMOS',
  'talend-connector': 'Talend',
  'shared-mobile': 'Mobile',
}

module.exports = (
  navGroups,
  {
    data: {
      root: { site },
    },
  }
) => {
  const components = site.components

  function serializeComponent (name) {
    const title = (components[name] && components[name].title) || name
    return {
      name,
      title,
      shortName: shortNames[name] || title,
    }
  }

  // color is only ever present on a top-level navGroup (set by hand in the
  // playbook) -- subGroups/components deliberately carry none of their own
  // here, and the client is what walks this tree inheriting a parent's color
  // down, same as this data looked when it was still a hand-maintained mock.
  //
  // components is only set when the group actually has direct components
  // (never an empty array) -- the client tells "leaf group" apart from
  // "subGroups-holding group" with a plain truthiness check, and an empty
  // array is truthy in JS, so a subGroups-only group like "Develop" would
  // otherwise wrongly look like an (empty) leaf and never recurse.
  function serializeGroup (group) {
    return {
      title: group.title,
      url: group.url,
      color: group.color,
      components: group.components && group.components.length ? group.components.map(serializeComponent) : undefined,
      latestVersions: group.latestVersions,
      subGroups: group.subGroups ? group.subGroups.map(serializeGroup) : undefined,
    }
  }

  return { navGroups: navGroups.map(serializeGroup) }
}
