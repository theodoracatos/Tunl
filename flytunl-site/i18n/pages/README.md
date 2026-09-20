# Guide-page translations

`build-pages.mjs` localizes the hand-written English guide pages
(`site/<page>/index.html`). Each translatable text run becomes a unit keyed by a
7-char hash of its English text; translations live here as
`<lang>.<chunk>.json` = `{ "<key>": "<translated html>" }`. Any number of chunk
files per language is merged.

    node build-pages.mjs --list how-to-play,ships   # English units (key<TAB>text)
    node build-pages.mjs --missing                  # coverage table
    node build-pages.mjs --todo de                  # what is still missing for de
    node build-pages.mjs                            # build (run after build-site.mjs)

Edit an English sentence and its key changes: that one unit falls back to English
(visibly) until retranslated. A language page is only produced at >= 85% coverage.

## Rules for translators
- Keep every HTML tag, `href`, `class` and `<code>...</code>` token exactly as in
  the English unit (the build rejects a unit whose tags/links/code differ).
- Do not translate: TUNL, ship names (PEARL AMBER CRIMSON ELECTRIC TOXIC VOID NOVA
  SOLARIS), code tokens, store names.
- Address the reader informally (du / tu / tú / ты / sen / kamu / ty / आप);
  Japanese です・ます, Korean 해요체, Arabic MSA, Chinese is TRADITIONAL (zh = the game's zh).
- Western digits everywhere. No em dashes (U+2014): use " - " like the source.
- Plain-text units (alt, title, meta description, JSON-LD) contain no tags.
- Escape as the source does: `&amp;`, `&middot;`, `&rarr;`. Raw `"` in attributes is escaped for you.

## Glossary (same words as the game, src/i18n.js, and the homepage)
See GLOSSARY.tsv (term<TAB>de<TAB>fr<TAB>...): keep it in sync when adding a term.
