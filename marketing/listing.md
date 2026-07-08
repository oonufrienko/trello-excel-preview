# Marketplace Listing Copy

Drafts for the Atlassian Marketplace submission for **Simple Excel Viewer**.

Paste these strings into the relevant fields in https://trello.com/power-ups/admin and the Atlassian Marketplace listing form.

---

## Public name (≤ 50 chars)

```
Simple Excel Viewer
```

## Tagline / short description (≤ 120 chars)

```
Preview Excel, CSV and other spreadsheets attached to Trello cards — no downloads, no extra apps.
```

(116 chars)

## Long description (≤ 1500 chars)

```
Simple Excel Viewer shows the contents of spreadsheet attachments right inside your Trello card. Click Preview on any .xlsx, .xls, .csv, .xlsm, .xlsb, or .ods file and the spreadsheet opens in a clean, read-only viewer — without leaving Trello and without installing Excel or a third-party desktop app.

What you get:

• Instant in-browser preview of attached spreadsheet files.
• Multi-sheet support — switch between worksheet tabs from the toolbar.
• Embedded images rendered in their original positions (XLSX, XLSM, XLSB).
• Excel column widths preserved so layouts stay readable.
• File management actions: Preview, Download, Rename, Delete — all from the card.
• Works on free Trello plans (up to 10 MB attachments) and paid plans (up to 25 MB through our preview proxy).
• White, distraction-free preview surface regardless of your Trello theme.

Privacy by design:

• Files are parsed in your browser. The proxy fetches the attachment in memory only — nothing is stored on the server.
• Your Trello token is requested through the official Power-Up SDK and lives only inside Trello's own card-private storage during a preview session.
• No analytics, no trackers, no cookies set by the Power-Up.

Ideal for teams that move project budgets, price lists, invoices, inventory, or task lists through Trello and don't want every team-mate to download and open Excel just to read a few cells.

Need help or have a feature request? Email onufrienko.alex@gmail.com — every message is read personally.

Built with AI, product direction by Oleksandr Onufrienko.
```

(1497 chars — under the 1500 limit)

## Category

Primary: **File Management**

(Trello surfaces this in the Power-Ups Marketplace category filter. Best match for a viewer that adds Preview/Download/Rename/Delete to attachments.)

## Support contact

```
onufrienko.alex@gmail.com
```

## Privacy Policy URL

```
https://trello-excel-preview.vercel.app/privacy.html
```

## Terms of Use URL

```
https://trello-excel-preview.vercel.app/terms.html
```

## Author

```
Oleksandr Onufrienko
```

## Iframe Connector URL

```
https://trello-excel-preview.vercel.app/
```

## Public Power-Up icon

`marketing/icon-1024.png` (generated from `images/excel-icon.svg`, 1024×1024).

## Screenshots (manual — needs the developer's browser)

Required: 1, recommended: 4–5. PNG, 1280×720 (or larger 16:9). Suggested shots:

1. **Card with the Excel Files section** — a Trello card showing several .xlsx attachments listed by the Power-Up with Preview + ⋯ buttons.
2. **Multi-sheet preview** — fullscreen modal open on a file with multiple sheet tabs visible.
3. **Embedded images preview** — a catalog/price-list file where product photos appear in their original positions alongside the table.
4. **Actions popup** — the ⋯ menu open showing Download / Rename / Delete.
5. **Error state (optional)** — the "413 File too large" message demonstrating graceful failure on >25 MB files.

Capture from production (`https://trello-excel-preview.vercel.app`) once the Marketplace assets ship, then crop to 1280×720.

## Known limitations to disclose (optional, but honest)

- Embedded image positions may not match the original Excel layout exactly. Images can drift, more visibly on non-first sheets of multi-sheet workbooks or on files with custom column widths or row heights.
- Charts: bar/column, line and pie charts are rendered from the data saved in the file. Other chart types (scatter, area, combo) show a labelled placeholder instead.
- Cell styling (bold, italic, font colors, background fills) is not rendered.
- Files larger than 25 MB are blocked from preview (use Download).
- Old `.xls` binary format renders without embedded images.
