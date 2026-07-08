# Graph Report - trello-excel-preview  (2026-07-08)

## Corpus Check
- 42 files · ~49,704 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 364 nodes · 451 edges · 61 communities (33 shown, 28 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `06ed7b78`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Marketplace Listing Copy|Marketplace Listing Copy]]
- [[_COMMUNITY_🟡 Manual steps that need a browser|🟡 Manual steps that need a browser]]
- [[_COMMUNITY_1.0.0 — 2026-05-13|[1.0.0] — 2026-05-13]]
- [[_COMMUNITY_e2e tests|e2e tests]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_Deploy & Rollback|Deploy & Rollback]]
- [[_COMMUNITY_e2e GitHub Actions Workflow (playwright job)|e2e GitHub Actions Workflow (playwright job)]]
- [[_COMMUNITY_Authorization Capabilities (guideline 9)|Authorization Capabilities (guideline #9)]]
- [[_COMMUNITY_Embedded Image Positioning (monotonic grid edges)|Embedded Image Positioning (monotonic grid edges)]]
- [[_COMMUNITY_Client-side Formula Calculation|Client-side Formula Calculation]]
- [[_COMMUNITY_apihealth Uptime Endpoint|/api/health Uptime Endpoint]]
- [[_COMMUNITY_Proxy Rate Limiting (30 reqminIP)|Proxy Rate Limiting (30 req/min/IP)]]
- [[_COMMUNITY_SSRF Allowlist (Trello + AWS S3, HTTPS only)|SSRF Allowlist (Trello + AWS S3, HTTPS only)]]
- [[_COMMUNITY_Theme-palette Color Resolution|Theme-palette Color Resolution]]
- [[_COMMUNITY_WMF Labelled Placeholder Decision|WMF Labelled Placeholder Decision]]
- [[_COMMUNITY_xlsx-calc (MIT formula engine)|xlsx-calc (MIT formula engine)]]
- [[_COMMUNITY_Graphify Knowledge Graph Integration|Graphify Knowledge Graph Integration]]
- [[_COMMUNITY_Listing Known Limitations to Disclose|Listing Known Limitations to Disclose]]
- [[_COMMUNITY_RELEASE.md Known Limitations (public roadmap)|RELEASE.md Known Limitations (public roadmap)]]
- [[_COMMUNITY_Cell Styles Fix Root Cause (applyCellStyles selector)|Cell Styles Fix Root Cause (applyCellStyles selector)]]
- [[_COMMUNITY_Charts (graphicFrame) Not Rendered|Charts (graphicFrame) Not Rendered]]
- [[_COMMUNITY_Image Positioning Fix (buildGridEdges + header band)|Image Positioning Fix (buildGridEdges + header band)]]
- [[_COMMUNITY_Images v2 (axfrm ext sizing, rotation, groups, WMF)|Images v2 (a:xfrm ext sizing, rotation, groups, WMF)]]
- [[_COMMUNITY_TODO Exploratory Follow-ups|TODO Exploratory Follow-ups]]
- [[_COMMUNITY_UptimeRobot Monitoring on apihealth|UptimeRobot Monitoring on /api/health]]

## God Nodes (most connected - your core abstractions)
1. `test` - 13 edges
2. `Marketplace Listing Copy` - 13 edges
3. `loadPreview()` - 12 edges
4. `main()` - 10 edges
5. `u()` - 9 edges
6. `scripts` - 9 edges
7. `main()` - 9 edges
8. `s()` - 8 edges
9. `Simple Excel Viewer` - 8 edges
10. `positionImages()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `loadPreview()` --references--> `xlsx`  [EXTRACTED]
  js/preview.js → package.json
- `trello()` --indirect_call--> `v()`  [INFERRED]
  tests/setup/seed-board.mjs → js/xlsx-calc.bundle.js
- `trello()` --indirect_call--> `v()`  [INFERRED]
  tests/setup/unseed-real.mjs → js/xlsx-calc.bundle.js
- `listFixtures()` --indirect_call--> `f()`  [INFERRED]
  tests/setup/seed-board.mjs → js/xlsx-calc.bundle.js
- `Privacy Policy (EN + UA)` --references--> `JSZip (zip extraction for embedded images/drawing anchors)`  [EXTRACTED]
  privacy.html → README.md

## Import Cycles
- None detected.

## Communities (61 total, 28 thin omitted)

### Community 1 - "Package Manifest & Dependencies"
Cohesion: 0.07
Nodes (28): author, bugs, email, contributors, description, devDependencies, dotenv, esbuild (+20 more)

### Community 2 - "Preview Rendering"
Cohesion: 0.14
Nodes (25): applyCellStyles(), applyFormulaCellFormats(), blobUrls, buildCellGrid(), buildColgroup(), buildGridEdges(), currentAnchors, currentStyles (+17 more)

### Community 3 - "Product Docs & API Pages"
Cohesion: 0.21
Nodes (12): Ko-fi Funding (river44), Attachments Iframe Page (attachments.html), Attachment Section (Preview/Download/Rename/Delete), Preview Modal (client-side SheetJS parsing), Preview Iframe Page (preview.html), Privacy Policy (EN + UA), Trello Power-Up SDK (p.trellocdn.com), JSZip (zip extraction for embedded images/drawing anchors) (+4 more)

### Community 4 - "E2E Test Specs"
Cohesion: 0.16
Nodes (5): ALLOWED, CASES, __dirname, IDS_FILE, test

### Community 5 - "Test Fixture Generation"
Cohesion: 0.21
Nodes (16): chunk(), crc32(), crcTable, csvFile(), __dirname, flatColorPng(), formulasNoCache(), large5mb() (+8 more)

### Community 6 - "Attachments UI"
Cohesion: 0.29
Nodes (14): DATE_FMT, deleteAttachment(), downloadAttachment(), ensureToken(), esc(), EXCEL_EXTS, formatDate(), isExcel() (+6 more)

### Community 7 - "Trello Board Seeding"
Cohesion: 0.28
Nodes (12): attachmentExists(), __dirname, findOrCreateCard(), findOrCreateList(), FIXTURES_ROOT, IDS_FILE, loadIdsFile(), main() (+4 more)

### Community 8 - "Image & Formula Limitations"
Cohesion: 0.12
Nodes (15): Contact, Known limitations, Legal, Project layout, Simple Excel Viewer, Supported formats, Tech stack, What it does (+7 more)

### Community 9 - "Proxy & Rate Limiting"
Cohesion: 0.36
Nodes (8): ALLOWED_HOSTNAMES, buildTrelloFetch(), clientIp(), handler(), isAllowedUrl(), rateBuckets, rateLimitCheck(), RFC-5987

### Community 10 - "Settings Panel"
Cohesion: 0.33
Nodes (8): actionsEl, onAuthorize(), onDisconnect(), refresh(), renderConnected(), renderDisconnected(), statusEl, t

### Community 11 - "Bundle Minified Helpers"
Cohesion: 0.36
Nodes (8): Dr(), _e(), f(), i(), l(), u(), xr(), listFixtures()

### Community 12 - "Bundle Helper Functions"
Cohesion: 0.43
Nodes (7): a(), Je(), o(), qe(), s(), t(), w()

### Community 13 - "Marketing Demo GIF"
Cohesion: 0.43
Nodes (7): Power-Up Demo GIF Screenshot, Card Toolbar with Attachment Button (Add / Labels / Dates / Checklist / Attachment), Background Board Card with Attachment Badges (Instruments, 19 May), Marketing Demo Asset for Trello Excel Preview Power-Up Listing, Floating Tab Pill: Power-ups / Automations / Comments, Trello Card Back Modal (test card, list 'В роботі'), Ukrainian Locale UI (list 'В роботі', user 'Олександр О.')

### Community 14 - "Board Cleanup Script"
Cohesion: 0.32
Nodes (7): v(), __dirname, IDS_FILE, main(), REPO_ROOT, requireEnv(), trello()

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

### Community 36 - "Marketplace Listing Copy"
Cohesion: 0.14
Nodes (13): Author, Category, Iframe Connector URL, Known limitations to disclose (optional, but honest), Long description (≤ 1500 chars), Marketplace Listing Copy, Privacy Policy URL, Public name (≤ 50 chars) (+5 more)

### Community 37 - "🟡 Manual steps that need a browser"
Cohesion: 0.18
Nodes (10): 1. Production screenshots (1280×720) — ✅ DONE, 2. Trello Power-Up admin (https://trello.com/power-ups/admin), 3. Atlassian Marketplace listing form, 4. CI workflow — ✅ DONE, 5. Post-launch operations, Contact, 🔵 Known limitations to keep on the public roadmap, 🟡 Manual steps that need a browser (+2 more)

### Community 38 - "[1.0.0] — 2026-05-13"
Cohesion: 0.20
Nodes (9): [1.0.0] — 2026-05-13, Added, Added, Changed, Changelog, Fixed, Fixed, Security (+1 more)

### Community 39 - "e2e tests"
Cohesion: 0.25
Nodes (7): CI, e2e tests, Fixtures, Prerequisites, Running, Safety guard, Setup (one-time)

### Community 40 - "CLAUDE.md"
Cohesion: 0.29
Nodes (5): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, graphify

### Community 41 - "Deploy & Rollback"
Cohesion: 0.40
Nodes (4): Deploy & Rollback, Dev (test environment), Prod, Rollback

### Community 42 - "e2e GitHub Actions Workflow (playwright job)"
Cohesion: 0.67
Nodes (3): e2e GitHub Actions Workflow (playwright job), Playwright E2E Suite, storageState.json Trello Session

## Ambiguous Edges - Review These
- `Background Board Card with Attachment Badges (Instruments, 19 May)` → `Marketing Demo Asset for Trello Excel Preview Power-Up Listing`  [AMBIGUOUS]
  marketing/power-up-gif-screenshot.gif · relation: conceptually_related_to

## Knowledge Gaps
- **129 isolated node(s):** `STARTED_AT`, `rateBuckets`, `RFC-5987`, `EXCEL_EXTS`, `t` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Background Board Card with Attachment Badges (Instruments, 19 May)` and `Marketing Demo Asset for Trello Excel Preview Power-Up Listing`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `loadPreview()` connect `Preview Rendering` to `Package Manifest & Dependencies`, `Bundle Minified Helpers`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `u()` connect `Bundle Minified Helpers` to `Formula Engine Bundle`, `Preview Rendering`, `Bundle Helper Functions`, `Board Cleanup Script`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `loadPreview()` (e.g. with `preview.js` and `u()`) actually correct?**
  _`loadPreview()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `u()` (e.g. with `loadPreview()` and `m()`) actually correct?**
  _`u()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `STARTED_AT`, `rateBuckets`, `RFC-5987` to the rest of the system?**
  _137 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Formula Engine Bundle` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._