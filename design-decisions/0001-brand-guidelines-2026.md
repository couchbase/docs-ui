# 0001: Apply Couchbase Brand Guidelines 2026

- **Status:** Palette tokens and new logos applied. Font change (Inter/Centra) deliberately deferred; see Update below. Rest of Phase B waits on Centra No. 2 web font files from the brand team.
- **Date:** 2026-10-15
- **Source:** Couchbase Brand Guide 2026 (last updated August 2026). The PDF (52 MB) is deliberately not committed; get it from the brand team.


## Update 2026-10-15
- **Logos applied** (from the brand team's Logo pack): `couchbase-logo.svg` = FullLogo Red/Black (header on white, footer on light grey); new `couchbase-logo-white.svg` = FullLogo Red/White (chatbot panel header on black); `favicon.svg`/`.ico` = Token Red. The new wordmark is wider (5.3:1 vs 4.4:1), so the header logo (fixed 32px height) is ~20% wider than before.
- **Fonts reverted to Open Sans / Source Sans Pro** (and the Inter/Centra tokens removed) because the team will have more capacity for cross-context visual QE of a sitewide font change post GA. A quick check looked fine, so this is a low-risk follow-up once there is appetite. Gotham was never referenced by any CSS, so its files stay removed.
- Palette additions and `--radius-*` tokens stay (they are additive and unused until adopted).
- Still unchanged: "Documentation" lockup (`cb-documentation.svg`), link colour, grey scale, radii.

## Context
Brand Guide (updated Aug 2026) replaces the 2023 system: new "evolved" wordmark, Centra No. 2 (display) + Inter (body/UI) instead of Open Sans/Source Sans, a palette built on Red/Gold + Cream/Mid Cream/Sand + a 3-step neutral gray scale, red inline links (gold on black), 3 colourways (Dark / Light 1 cream / Light 2 white), and a rounded-corner scale (0,5,10,15,20,30,60,90,120px).

## Phase A as originally done (commit f74049b; font parts since reverted, see Update)
- `src/css/vars.css`: gold -> #FC9D0C, cream -> #FFF0DA (were off by one); added tokens for Dark/Darkest/Invalid Red, Mid Cream, Sand, Light/Medium/Dark Gray, Highlight/Faded Green, Dark Teal; `--color-text`/warning/orange-tint now alias brand tokens; added `--font-body`, `--font-display`, `--radius-sm/md/lg`.
- 31 `font-family` declarations swapped to `var(--font-body)` (Inter); Google Fonts import now Inter only; `.doc h1-h6` use `--font-display` (falls back to Inter until Centra is available).
- Removed unused Gotham CSS + 4 woff files.
- stylelint clean. NOT visually verified: `gulp build` fails on a missing `algoliasearch/lite` in node_modules (pre-existing); need `npm install` before visual QA.

## Blocked on assets / decisions (Phase B prerequisites)
1. **Evolved wordmark SVGs** (colour, black, white; token symbol; couch symbol). Only the legacy wordmark exists locally (incl. the couchbase-design skill). Get from brand team. Replaces `src/img/couchbase-logo.svg`, `logo.svg`, `favicon.svg/.ico`; used in `header-content.hbs`, `footer-content.hbs`, `chatbot-panel.hbs`, `head-meta.hbs`.
2. **Centra No. 2 font files + licence** for web use (.woff2). Add `@font-face` in a new `typeface-centra.css`, point `--font-display` at it; use Medium weight for headlines/CTAs. Consider self-hosting Inter (woff2 in `src/font/`) instead of the Google import (GDPR/perf).
3. **"Documentation" lockup** (`cb-documentation.svg`, `cb-docs-hover.svg`) is outlined in a Gotham-like face; regenerate in Centra No. 2 once the font is available.
4. Decisions needed from Hakim / brand:
   - Links: guide says Red (gold on black). #EC1218 on white is ~4.3:1 (fails AA 4.5 for body text) and the guide itself warns against red for small text. Options: Red as-is / Dark Red #7C0206 for link text with Red on hover / keep blue for docs. Recommend Dark Red text + Red hover, pending brand sign-off.
   - Admonitions and syntax highlighting need non-brand hues (blue note, purple important, pink code). Guide palette is "closed" and has no blue. Recommend keeping a minimal functional set, re-tuned toward the palette, and confirming with brand that docs semantics are exempt (vars.css already notes this exception).

## Phase B: staged rebrand
**B1. Tokens and neutrals (low risk, visual QA needed)**
- Collapse the cool slate grays (`--color-brand-gray1-9`, ~119 usages across `src/css/*.css`) onto the warm/neutral scale: Light #D2D5D9, Medium #858585, Dark #333, plus Cream/Mid Cream/Sand for surfaces. Do this by repointing the old variable names (no per-file edits) then deleting redundant ones.
- Replace ~25 remaining hardcoded hexes (`#999`, `#ccc`, `#e5e5e5`, `#f1f7fe`, `#ea2328`, `#ff983a`...) with tokens.
- Re-point `--color-active-tabset` (#57a1ff), TOC/tab accents and nav active states from blue to Red/Gold.
- Add a `.cb-dark / .cb-light` colourway concept only if needed (see B3).

**B2. Typography**
- Apply guide specs: Headline Centra Medium, tight line-height (~100-110%); body Inter Regular, line-height 140-160%; eyebrow/caption Inter SemiBold 12px, +10% tracking, uppercase (labels.css, toc heading, nav section titles); CTA Centra Medium (buttons in landing-page.css/home.css).
- Retune `--heading-*` sizes and `letter-spacing`; check Inter's wider metrics against nav width (`--width-nav`), tables, tabs, code-adjacent text (code stays Source Code Pro/Roboto Mono; guide is silent, confirm).
- Remove leftover Source Sans/Open Sans fallbacks; update `fonts.googleapis` imports; drop `typeface-roboto-mono.css` if redundant.

**B3. Surfaces and colourways**
- Header stays Black (Dark colourway): confirm nav text/active colours use Gold on black for links.
- Footer (`--color-footer-bg` #f3f3f3 -> Cream), page background option Cream vs White (Light 1 vs Light 2); landing/home hero blocks on Cream with Red/Gold used sparingly (guide: full-strength red/gold only as accents).
- Admonition, table-stripe, code-block and callout backgrounds mapped to Cream/Mid Cream; form error state uses Invalid Red `#FFD5D6` (feedback.css, search, is-this-helpful).
- Highlight Green #21EA2A only for confirmations (copy-to-clipboard success, "helpful" thanks) in `clipboard.css`, `is-this-helpful.css`.

**B4. Shape language**
- Move 3px/4px/8px radii (~40 usages) onto the scale: tags/buttons 5px, cards/containers 10-20px, large panels 30px+; nested radii smaller than outer. Use `--radius-*` tokens. Touch `labels.css`, `landing-page.css`, `home.css`, `chatbot.css`, `info-banner.css`, search panel, `doc.css` blocks.

**B5. Logos, icons, imagery**
- Swap all logo assets (see prerequisite 1); enforce clear space and min size (0.25in high, 1in wide, i.e. >= ~96x24 CSS px) in `header.css`/`footer.css`.
- Favicon: Token Symbol; `social-icon/*` and `landing-page-icon/*` recoloured to palette; note "App Icon" is store-only.
- Illustration style (grainy gradients) is spot-use only on web: optional hero art on `home`/landing pages once marketing supplies assets; do not generate.

**B6. Downstream surfaces**
- Algolia search UI, chatbot panel (`chatbot.css`), selection-share and swagger-ui (`swagger-ui.css`) restyled via tokens.
- `preview-src/` sample pages updated so reviewers can see the new look.
- Update README with palette/font token docs; update `couchbase-design` skill reference if desired (it still says Open Sans only).

## Suggested order / PRs
PR1 = Phase A (tokens, Inter, Gotham removal). PR2 = B1+B4 (neutral + radius sweep). PR3 = B2+B3 (type and surfaces, after Centra files). PR4 = B5 (logos, once assets arrive). Each behind visual review of preview pages.

## Verification
- `npm install`, then `npx gulp preview:build`/`serve` and review: home, a doc page with all admonition types, tables, tabs, code blocks, nav (collapsed/expanded), search results, chatbot, landing page, 404, REST API page, mobile widths.
- `npx stylelint "src/css/*.css"`; grep for stray `Open Sans|Source Sans|Gotham` and off-palette hexes.
- Contrast check (WCAG AA) on link, nav-active, label and admonition colour pairs on both Cream and White.
- Compare fonts loaded in DevTools Network (Inter, Centra) and check CLS/layout shift from the font swap.
