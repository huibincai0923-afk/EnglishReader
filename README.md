# English Reader V3.2

A browser-based EPUB reader with a CEFR-oriented vocabulary layer.

### Highlighting
- 🟨 Light yellow = B2+ words
- 🩵 Light blue = B2+ phrases / phrasal verbs / collocations
- Switch to C1-only from the top bar
- Click an item for its meaning and CEFR level
- Add items to a local vocabulary list

### Vocabulary architecture
Vocabulary is stored separately in `vocabulary.json`, so the reader engine does not need to be edited when the dataset is expanded.

The project is designed around the CEFR framework. Oxford's public materials describe the Oxford 3000/5000 and Oxford Phrase List as CEFR-aligned resources; the Oxford Phrase List includes idioms, phrasal verbs, collocations and common prepositional phrases. This project does **not** redistribute Oxford's proprietary full lists. citeturn0search0turn0search1turn0search6

The included data is a starter dataset. For a production-grade version, replace/extend `vocabulary.json` with an appropriately licensed or open CEFR dataset.

EPUB files are processed locally in the browser and are not uploaded to a backend.


### V3.1 reading mode
The EPUB renderer now uses continuous vertical scrolling (`scrolled-doc`) instead of paginated/spread reading. Mouse wheel and trackpad scrolling are the primary navigation methods. Previous/Next controls remain available for moving between EPUB sections.


### V3.2
- User text marking with five muted Morandi-style colors: red, yellow, blue, purple, green.
- Font size selector expanded from 18px up to 42px.
- Current chapter is automatically highlighted and scrolled into view in the table of contents.


## V3.2 + Manual Marking
- Based directly on V3.2.
- Any selected text can be underlined with five Morandi colors.
- Last selected underline color is remembered.
- Reading background is soft ivory/milky-yellow.
- Existing V3.2 functionality is preserved.
