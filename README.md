# English Reader V4.5

EPUB reader with continuous scrolling, CEFR-oriented vocabulary highlighting, text marking, font-size controls, and synchronized table of contents.

## V4.5
- 🟨 B2/C1 vocabulary highlighting
- 🩵 B2/C1 phrase highlighting
- Five muted marking colors: red, yellow, blue, purple, green
- Drag-select text and choose a color from the floating palette
- Marking works across inline vocabulary-highlight spans
- Marks are saved in browser local storage
- 18–42px font sizes
- Current chapter is highlighted and auto-scrolled in the TOC
- EPUB is processed locally in the browser

The included vocabulary file is a starter CEFR-oriented dataset. It does not redistribute proprietary Oxford word lists.


### V4.5 marking fix
- The floating marking palette is triggered by `selectionchange`, not by a paragraph-specific handler.
- The five color buttons are always shown next to the selected text.
- Marking no longer uses `Range.surroundContents()` and therefore has no one-paragraph restriction.
- `app.js?v=34` forces browsers/CDN caches to load the new marking implementation.
- Reading width and page margins are restored to a more spacious V3.2-style layout.
- The warm beige paper background is retained.


### V4.5
- The last selected marking color is remembered in browser local storage.
- Choosing a color from the floating selection palette immediately makes it the default for the next selection.
- The default color remains active until another color is selected.


### V4.5
- 📚 Vocabulary library: saved words/phrases can be reviewed and deleted.
- 📝 Notes: create, review, and delete reading notes; notes store the current chapter and EPUB CFI position.
- 🔎 Clicking a highlighted word or phrase opens its meaning card.
- Vocabulary and notes are stored locally in the browser.


### V4.5
- 📊 Reading-time dashboard with today's reading time and all-time reading time.
- 📚 Local book library with reading progress.
- ✅ Books reaching 99.5% progress are automatically marked as finished.
- Finished books are listed separately with completion dates.
- Reading time counts active reading only and pauses when the page is hidden/inactive.


### V4.5 — Highlighting/Marking Focus
- 🟥🟨🩵🟪🟩 Five-color underline palette appears directly after selecting text.
- 🎨 The last selected marking color is persisted and becomes the default next time.
- 🟨 B2+/C1 vocabulary uses a soft yellow highlight.
- 🩵 B2+/C1 phrases use a soft blue highlight.
- Selection marking does not use `Range.surroundContents()`, so it is not restricted to a single paragraph.


### V4.5
- Fixed the marking palette trigger by listening directly to EPUB iframe `mouseup`/`touchend` and selection events.
- Five-color marking palette appears next to selected text.
- Last marking color remains the default across selections and refreshes.
- Added Narrow / Medium / Wide reading-margin controls with local persistence.
- Margin settings are applied to the reader viewport and EPUB content after rendering.


### V4.5 — Marking Fix
- Fixed the missing underline style inside EPUB.js content documents.
- Marked text now visibly renders with the selected Morandi underline color.
- When the marked selection exactly matches a B2+/C1 word or phrase in the vocabulary data, it is automatically added to Vocabulary.
- Ordinary sentence/paragraph marking remains a marking-only action.


### V4.5 — Manual Marking Independent of Vocabulary
- Manual five-color underlining works for **any selected text**, regardless of B2+/C1 status.
- B2+/C1 vocabulary highlighting remains a separate optional system feature.
- B2+/C1 matching is no longer a prerequisite for manual marking.
- Exact vocabulary matches may still be added automatically to Vocabulary when marked.


## V6 — EPUB Compatibility
- Based on the complete V4.5 feature set.
- Preflights EPUB container.xml, OPF, manifest, and spine before rendering.
- Normal EPUB.js rendering uses an explicit viewport height instead of `auto`.
- If EPUB.js fails or produces an empty chapter, a built-in ZIP/XHTML fallback renderer is used.
- Fallback mode resolves local images and CSS resources from the EPUB package.
- EPUB 2/3-style XHTML spine documents are supported when their package metadata is readable.
- Vocabulary, notes, reading-time statistics, finished-book history, B2+/C1 highlighting, margins, font controls, and existing reading UI are preserved.


## V6.1 — 10-Level Margins
- Margin control expanded to 10 levels: 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%.
- Current level is displayed as `1/10` through `10/10` when the existing margin value label is present.
- Margin selection is persisted in localStorage.
- Applies to EPUB.js rendering and the compatibility fallback iframe.
- EPUB compatibility logic from V6 is unchanged.
