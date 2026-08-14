# English Reader V4.4

EPUB reader with continuous scrolling, CEFR-oriented vocabulary highlighting, text marking, font-size controls, and synchronized table of contents.

## V4.4
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


### V4.4 marking fix
- The floating marking palette is triggered by `selectionchange`, not by a paragraph-specific handler.
- The five color buttons are always shown next to the selected text.
- Marking no longer uses `Range.surroundContents()` and therefore has no one-paragraph restriction.
- `app.js?v=34` forces browsers/CDN caches to load the new marking implementation.
- Reading width and page margins are restored to a more spacious V3.2-style layout.
- The warm beige paper background is retained.


### V4.4
- The last selected marking color is remembered in browser local storage.
- Choosing a color from the floating selection palette immediately makes it the default for the next selection.
- The default color remains active until another color is selected.


### V4.4
- 📚 Vocabulary library: saved words/phrases can be reviewed and deleted.
- 📝 Notes: create, review, and delete reading notes; notes store the current chapter and EPUB CFI position.
- 🔎 Clicking a highlighted word or phrase opens its meaning card.
- Vocabulary and notes are stored locally in the browser.


### V4.4
- 📊 Reading-time dashboard with today's reading time and all-time reading time.
- 📚 Local book library with reading progress.
- ✅ Books reaching 99.5% progress are automatically marked as finished.
- Finished books are listed separately with completion dates.
- Reading time counts active reading only and pauses when the page is hidden/inactive.


### V4.4 — Highlighting/Marking Focus
- 🟥🟨🩵🟪🟩 Five-color underline palette appears directly after selecting text.
- 🎨 The last selected marking color is persisted and becomes the default next time.
- 🟨 B2+/C1 vocabulary uses a soft yellow highlight.
- 🩵 B2+/C1 phrases use a soft blue highlight.
- Selection marking does not use `Range.surroundContents()`, so it is not restricted to a single paragraph.


### V4.4
- Fixed the marking palette trigger by listening directly to EPUB iframe `mouseup`/`touchend` and selection events.
- Five-color marking palette appears next to selected text.
- Last marking color remains the default across selections and refreshes.
- Added Narrow / Medium / Wide reading-margin controls with local persistence.
- Margin settings are applied to the reader viewport and EPUB content after rendering.


### V4.4 — Marking Fix
- Fixed the missing underline style inside EPUB.js content documents.
- Marked text now visibly renders with the selected Morandi underline color.
- When the marked selection exactly matches a B2+/C1 word or phrase in the vocabulary data, it is automatically added to Vocabulary.
- Ordinary sentence/paragraph marking remains a marking-only action.


## V5 — CFI Marking
- Replaced manual text marking with EPUB.js CFI-based annotations.
- Selection can be any text; it is not restricted to one paragraph or vocabulary level.
- Five heart buttons: ❤️ 🧡 💙 💜 💚.
- The last selected color is remembered.
- Marks are stored by EPUB CFI and restored after navigation/reopening.
- Existing Vocabulary, notes, reading statistics, finished books, vocabulary highlighting, and margin controls are preserved from V4.4.


## V5.1 — Editorial UI + Focus Timer
- Redesigned the interface with a restrained editorial aesthetic inspired by modern reading apps.
- Added a dedicated Focus/Pomodoro panel with 25/45/50-minute presets.
- Timer supports start/pause, reset, skip, session counts, total focus minutes, persistence, and keyboard shortcuts.
- Existing V5 CFI marking, vocabulary, notes, reading statistics, finished books, highlighting, margins, and EPUB reading behavior are preserved.


## V5.2 — Browser Annotations, Auto Notes & Typography
- Added an optional **Web annotations** reading surface that mirrors the current EPUB XHTML into ordinary top-level DOM, allowing browser annotation extensions that do not support iframe/all-frames injection to interact with the book text.
- Added Georgia, Arial, and Helvetica reading fonts with persistent selection.
- Notes is now an automatic record of marked passages; the manual note composer was removed.
- Each saved mark appears in Notes with its text, color, chapter, and timestamp.
- Removed the manual-note path that could surface arbitrary pasted text.
