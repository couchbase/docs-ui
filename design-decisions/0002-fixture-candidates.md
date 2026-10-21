# 0002 appendix: starter candidates for preview and fixture pages

Sources are the repos in `docs-site/antora-playbook.preview2.yml`. Picked by grep scan on 2026-10-21 (counts approximate). Paths are relative to each repo under `~/couchbase/`. Several local clones were not on the playbook branch when scanned; check the branch before copying.

| # | Repo | Path | Why |
|---|------|------|-----|
| 1a | docs-site | `home/modules/ROOT/pages/index.adoc` | Home; `landing-page-top-level-sdk`, `page-role: tiles`, card rows, includes `partial$info-banner.adoc` |
| 1b | docs-site | `home/.../server.adoc` | Server landing, tabs |
| 1c | docs-site | `home/.../mobile.adoc` (99 lines) | Lighter stand-in for `sdk.adoc` (1115 lines; trim to ~150 if used) |
| 1d | docs-site | `home/.../cloud.adoc` | `landing-page-capella`, FA icons, `page-nav-header-levels: 1` |
| 1e | docs-site | `home/.../start-here.adoc` | FA card layout (`landing-page-capella`) |
| 1f | docs-devex | `modules/tutorials/pages/couchbase-tutorial-student-records.adoc` | No tutorials landing found locally; tutorial type |
| 2 | docs-server | `modules/manage/pages/manage-security/manage-users-and-roles.adoc` | Deepest TOC (h2:6/h3:17/h4:26), N/I/W admonitions, 15 images. Alt: `manage-backup-and-restore.adoc` (`page-toclevels: 3`, tabs) |
| 3 | docs-sdk-java | `modules/howtos/pages/kv-operations.adoc` | How-to, 27 includes, ~26 source blocks. Alt (tabs): `hello-world/pages/start-using-sdk.adoc` |
| 3b | docs-couchbase-lite | `modules/csharp/pages/replication.adoc` | Long guide: 19 callouts, 10 tables, 2 tab blocks |
| 4 | docs-enterprise-analytics | `modules/sqlpp/pages/8_builtin.adoc` | Reference, 20 tables. Alt: docs-capella `modules/reference/pages/azure.adoc` |
| 5 | docs-capella | `modules/get-started/pages/create-account.adoc` | Tutorial type, admonitions. Smaller: `run-first-queries.adoc` |
| 6a | docs-capella | `modules/organizations/pages/manage-organization-users.adoc` | `menu:`/`btn:` macros, Operational label. Alt: `ui-auth/sso-okta.adoc` (tables, tabs) |
| 6b | docs-capella-app-services | `modules/ROOT/pages/get-started/configuring-app-services.adoc` | App Services label, pagination, tabs |
| 6c | docs-ai | `modules/build/pages/ai-functions.adoc` | Guide, `page-toclevels: 4`; AI label currently commented out in `antora.yml` |
| 7 | docs-server | `modules/rest-api/pages/deprecated-security-apis/upload-retrieve-root-cert.adoc` | `page-status: deprecated`. Newer-version banner: docs-couchbase-lite `modules/c/pages/dbreplica.adoc` (not opened) |
| 8 | docs-capella | `modules/release-notes/pages/release-notes.adoc` | 1850 lines, h2:58. Server `whats-new` includes a partial |
| 9 | docs-devex | `modules/indexes/pages/groupby-aggregate-performance.adoc` | Long JSON/terminal output, callouts. `kbd:` best in docs-capella `query-workbench.adoc` |
| 10 | docs-style-guide | `styleguide/modules/ROOT/pages/admonitions.adoc` (+ `tabbed-content`, `examples`, `general`) | Self-contained UI showcase; only page with all five admonition types. Matches playbook branch |
| 11 | docs-capella-app-services | `modules/ROOT/pages/references/rest_api_metric.adoc` + `partials/capella-openapi-metric.html` (61 KB) | Smallest pre-rendered Redocly fixture (on `main`). Capella management API partial is 6.1 MB and WIP-branch only. Others: `capella-openapi-admin` 249 KB, `capella-data-openapi` 629 KB, docs-ai `inference-openapi` 1 MB |
| 12 | docs-server | `modules/ROOT/nav.adoc` | ~609 entries, depth 6, 55 headings, multiple versions. Capella nav: 149 entries, depth 5 |

## Caveats
- Not cloned locally: `docs-analytics`, `mobile-travel-sample`, the `tutorials` component.
- WIP branches in preview2 (`DOC-14735_*`, `DOC-14645-*`, `DOC-14641--*`) may not exist locally; the fixture playbook resets them to the main playbook's branches.
- `page-capella-type` is not set in any `.adoc`; it comes from each component's `antora.yml`.
- Most common attributes CSS/hbs could key off: `page-layout` (rest-api 16, landing-page-top-level-sdk 14, landing-page-capella 12), `page-topic-type` (reference 609, concept 254, guide ~243, howto 46, tutorial 21), `page-toclevels`, `page-role`, `page-edition`, `page-status`.
