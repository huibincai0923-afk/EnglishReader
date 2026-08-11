# English Reader V4.2

EPUB reader with continuous scrolling, CEFR-oriented vocabulary highlighting, text marking, font-size controls, and synchronized table of contents.

## V4.2
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


### V4.2 marking fix
- The floating marking palette is triggered by `selectionchange`, not by a paragraph-specific handler.
- The five color buttons are always shown next to the selected text.
- Marking no longer uses `Range.surroundContents()` and therefore has no one-paragraph restriction.
- `app.js?v=34` forces browsers/CDN caches to load the new marking implementation.
- Reading width and page margins are restored to a more spacious V3.2-style layout.
- The warm beige paper background is retained.


### V4.2
- The last selected marking color is remembered in browser local storage.
- Choosing a color from the floating selection palette immediately makes it the default for the next selection.
- The default color remains active until another color is selected.


### V4.2
- 📚 Vocabulary library: saved words/phrases can be reviewed and deleted.
- 📝 Notes: create, review, and delete reading notes; notes store the current chapter and EPUB CFI position.
- 🔎 Clicking a highlighted word or phrase opens its meaning card.
- Vocabulary and notes are stored locally in the browser.


### V4.2
- 📊 Reading-time dashboard with today's reading time and all-time reading time.
- 📚 Local book library with reading progress.
- ✅ Books reaching 99.5% progress are automatically marked as finished.
- Finished books are listed separately with completion dates.
- Reading time counts active reading only and pauses when the page is hidden/inactive.


### V4.2 — Highlighting/Marking Focus
- 🟥🟨🩵🟪🟩 Five-color underline palette appears directly after selecting text.
- 🎨 The last selected marking color is persisted and becomes the default next time.
- 🟨 B2+/C1 vocabulary uses a soft yellow highlight.
- 🩵 B2+/C1 phrases use a soft blue highlight.
- Selection marking does not use `Range.surroundContents()`, so it is not restricted to a single paragraph.
