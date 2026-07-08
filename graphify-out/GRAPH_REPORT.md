# Graph Report - .  (2026-07-07)

## Corpus Check
- Corpus is ~49,412 words - fits in a single context window. You may not need a graph.

## Summary
- 298 nodes · 426 edges · 36 communities (27 shown, 9 thin omitted)
- Extraction: 90% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.71)
- Token cost: 112,842 input · 6,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Package Manifest & Dependencies|Package Manifest & Dependencies]]
- [[_COMMUNITY_Preview Rendering|Preview Rendering]]
- [[_COMMUNITY_Product Docs & API Pages|Product Docs & API Pages]]
- [[_COMMUNITY_E2E Test Specs|E2E Test Specs]]
- [[_COMMUNITY_Test Fixture Generation|Test Fixture Generation]]
- [[_COMMUNITY_Attachments UI|Attachments UI]]
- [[_COMMUNITY_Trello Board Seeding|Trello Board Seeding]]
- [[_COMMUNITY_Image & Formula Limitations|Image & Formula Limitations]]
- [[_COMMUNITY_Proxy & Rate Limiting|Proxy & Rate Limiting]]
- [[_COMMUNITY_Settings Panel|Settings Panel]]
- [[_COMMUNITY_Bundle Minified Helpers|Bundle Minified Helpers]]
- [[_COMMUNITY_Bundle Helper Functions|Bundle Helper Functions]]
- [[_COMMUNITY_Marketing Demo GIF|Marketing Demo GIF]]
- [[_COMMUNITY_Board Cleanup Script|Board Cleanup Script]]
- [[_COMMUNITY_Formula Variable Resolution|Formula Variable Resolution]]
- [[_COMMUNITY_App Icon Branding|App Icon Branding]]
- [[_COMMUNITY_Bundle Utility Group|Bundle Utility Group]]
- [[_COMMUNITY_Vercel Config|Vercel Config]]
- [[_COMMUNITY_Health Endpoint|Health Endpoint]]
- [[_COMMUNITY_Encoding & Style Fixes|Encoding & Style Fixes]]
- [[_COMMUNITY_Power-Up Connector|Power-Up Connector]]
- [[_COMMUNITY_Test Auth Setup|Test Auth Setup]]
- [[_COMMUNITY_Project Guidelines|Project Guidelines]]
- [[_COMMUNITY_Auth Page Script|Auth Page Script]]
- [[_COMMUNITY_Bundle Minified Pair|Bundle Minified Pair]]
- [[_COMMUNITY_Bundle Helper Pair|Bundle Helper Pair]]
- [[_COMMUNITY_Excel Icon SVG|Excel Icon SVG]]
- [[_COMMUNITY_Print Icon SVG|Print Icon SVG]]

## God Nodes (most connected - your core abstractions)
1. `test` - 13 edges
2. `loadPreview()` - 12 edges
3. `main()` - 10 edges
4. `u()` - 9 edges
5. `scripts` - 9 edges
6. `main()` - 9 edges
7. `s()` - 8 edges
8. `Release / Marketplace Submission Checklist` - 8 edges
9. `Privacy Policy (EN + UA)` - 8 edges
10. `positionImages()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `README Known Limitations` --semantically_similar_to--> `Listing Known Limitations to Disclose`  [INFERRED] [semantically similar]
  README.md → marketing/listing.md
- `RELEASE.md Known Limitations (public roadmap)` --semantically_similar_to--> `README Known Limitations`  [INFERRED] [semantically similar]
  RELEASE.md → README.md
- `loadPreview()` --references--> `xlsx`  [EXTRACTED]
  js/preview.js → package.json
- `trello()` --indirect_call--> `v()`  [INFERRED]
  tests/setup/seed-board.mjs → js/xlsx-calc.bundle.js
- `trello()` --indirect_call--> `v()`  [INFERRED]
  tests/setup/unseed-real.mjs → js/xlsx-calc.bundle.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Atlassian Marketplace Submission Assets** — release_marketplace_submission, marketing_listing_marketplace_listing, privacy_privacy_policy, terms_terms_of_use, changelog_changelog [EXTRACTED 1.00]
- **Playwright E2E CI Pipeline** — _github_workflows_e2e_playwright_job, tests_readme_e2e_suite, tests_readme_storagestate, tests_readme_safety_guard [EXTRACTED 1.00]
- **Known Limitations Disclosure Across Docs** — readme_known_limitations, release_known_limitations, marketing_listing_known_limitations, todo_charts_not_rendered [INFERRED 0.85]

## Communities (36 total, 9 thin omitted)

### Community 1 - "Package Manifest & Dependencies"
Cohesion: 0.07
Nodes (28): author, bugs, email, contributors, description, devDependencies, dotenv, esbuild (+20 more)

### Community 2 - "Preview Rendering"
Cohesion: 0.13
Nodes (25): applyCellStyles(), applyFormulaCellFormats(), blobUrls, buildCellGrid(), buildColgroup(), buildGridEdges(), currentAnchors, currentStyles (+17 more)

### Community 3 - "Product Docs & API Pages"
Cohesion: 0.14
Nodes (25): Ko-fi Funding (river44), e2e GitHub Actions Workflow (playwright job), Attachments Iframe Page (attachments.html), Attachment Section (Preview/Download/Rename/Delete), Authorization Capabilities (guideline #9), Changelog (Keep a Changelog format), /api/health Uptime Endpoint, Preview Modal (client-side SheetJS parsing) (+17 more)

### Community 4 - "E2E Test Specs"
Cohesion: 0.18
Nodes (5): ALLOWED, CASES, __dirname, IDS_FILE, test

### Community 5 - "Test Fixture Generation"
Cohesion: 0.21
Nodes (16): chunk(), crc32(), crcTable, csvFile(), __dirname, flatColorPng(), formulasNoCache(), large5mb() (+8 more)

### Community 6 - "Attachments UI"
Cohesion: 0.29
Nodes (14): DATE_FMT, deleteAttachment(), downloadAttachment(), ensureToken(), esc(), EXCEL_EXTS, formatDate(), isExcel() (+6 more)

### Community 7 - "Trello Board Seeding"
Cohesion: 0.26
Nodes (13): attachmentExists(), __dirname, findOrCreateCard(), findOrCreateList(), FIXTURES_ROOT, IDS_FILE, listFixtures(), loadIdsFile() (+5 more)

### Community 8 - "Image & Formula Limitations"
Cohesion: 0.20
Nodes (11): Embedded Image Positioning (monotonic grid edges), Client-side Formula Calculation, WMF Labelled Placeholder Decision, xlsx-calc (MIT formula engine), Listing Known Limitations to Disclose, README Known Limitations, RELEASE.md Known Limitations (public roadmap), Charts (graphicFrame) Not Rendered (+3 more)

### Community 9 - "Proxy & Rate Limiting"
Cohesion: 0.36
Nodes (8): ALLOWED_HOSTNAMES, buildTrelloFetch(), clientIp(), handler(), isAllowedUrl(), rateBuckets, rateLimitCheck(), RFC-5987

### Community 10 - "Settings Panel"
Cohesion: 0.33
Nodes (8): actionsEl, onAuthorize(), onDisconnect(), refresh(), renderConnected(), renderDisconnected(), statusEl, t

### Community 11 - "Bundle Minified Helpers"
Cohesion: 0.39
Nodes (9): Dr(), _e(), f(), i(), l(), m(), u(), v() (+1 more)

### Community 12 - "Bundle Helper Functions"
Cohesion: 0.43
Nodes (7): a(), Je(), o(), qe(), s(), t(), w()

### Community 13 - "Marketing Demo GIF"
Cohesion: 0.43
Nodes (7): Power-Up Demo GIF Screenshot, Card Toolbar with Attachment Button (Add / Labels / Dates / Checklist / Attachment), Background Board Card with Attachment Badges (Instruments, 19 May), Marketing Demo Asset for Trello Excel Preview Power-Up Listing, Floating Tab Pill: Power-ups / Automations / Comments, Trello Card Back Modal (test card, list 'В роботі'), Ukrainian Locale UI (list 'В роботі', user 'Олександр О.')

### Community 14 - "Board Cleanup Script"
Cohesion: 0.38
Nodes (6): __dirname, IDS_FILE, main(), REPO_ROOT, requireEnv(), trello()

### Community 15 - "Formula Variable Resolution"
Cohesion: 0.40
Nodes (5): calcNames(), constructor(), getRef(), setVar(), setVarOfExpression()

### Community 16 - "App Icon Branding"
Cohesion: 0.60
Nodes (5): Trello Excel Preview App Icon (1024px), Excel-Style Green Branding, Trello Power-Up Marketplace Listing Asset, Spreadsheet Grid Motif (2x3 Cells), White X Letterform (Excel Motif)

### Community 17 - "Bundle Utility Group"
Cohesion: 0.50
Nodes (4): Ie(), Se(), Ye(), Ze()

### Community 18 - "Vercel Config"
Cohesion: 0.50
Nodes (3): headers, rewrites, version

### Community 20 - "Encoding & Style Fixes"
Cohesion: 0.67
Nodes (3): cp1251 Encoding Fix for Old .xls, Theme-palette Color Resolution, Cell Styles Fix Root Cause (applyCellStyles selector)

## Ambiguous Edges - Review These
- `Background Board Card with Attachment Badges (Instruments, 19 May)` → `Marketing Demo Asset for Trello Excel Preview Power-Up Listing`  [AMBIGUOUS]
  marketing/power-up-gif-screenshot.gif · relation: conceptually_related_to

## Knowledge Gaps
- **68 isolated node(s):** `STARTED_AT`, `rateBuckets`, `RFC-5987`, `EXCEL_EXTS`, `t` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Background Board Card with Attachment Badges (Instruments, 19 May)` and `Marketing Demo Asset for Trello Excel Preview Power-Up Listing`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `loadPreview()` connect `Preview Rendering` to `Package Manifest & Dependencies`, `Bundle Minified Helpers`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `u()` connect `Bundle Minified Helpers` to `Formula Engine Bundle`, `Preview Rendering`, `Bundle Helper Functions`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `loadPreview()` (e.g. with `preview.js` and `u()`) actually correct?**
  _`loadPreview()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `u()` (e.g. with `loadPreview()` and `m()`) actually correct?**
  _`u()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `STARTED_AT`, `rateBuckets`, `RFC-5987` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Formula Engine Bundle` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._