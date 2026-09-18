# TUNL 14.0 — session 4 handoff (continuing from follow-up-prompt-3.md)

This is a fresh session with no memory of the prior four. **Read this whole file before
touching the browser or console.** `follow-up-prompt-2.md` in this same directory still
holds the original achievement IDs, edit URLs, and Play Console locale-switcher mechanics
reference — keep it open for that, but **this file supersedes its "what's done" status**,
because session 4 found a serious bug that invalidates part of what session 2 believed was
saved. `follow-up-prompt-3.md` was a near-empty handoff (browser extension was mid-update)
and adds nothing beyond pointing back to `-2.md`.

**Do NOT click final "submit for review" / "Zur Prüfung übermitteln" on either App Store
Connect or Play Console without asking the user first** — same standing instruction as
every prior session, still not lifted.

## THE CRITICAL FINDING — read this before writing anything to Play Console

**The achievement edit page's "Als Entwurf speichern" (Save as Draft) button shows the
"Deine Änderungen wurden gespeichert" success toast, but the save can silently NOT persist
to the backend** if you navigate away (e.g. switch the locale dropdown, or reload) too
soon after clicking it. Measured this session on the Boulder Meister achievement
(`CgkI_MyGndIBEAIQJw`): edited + saved + got the success toast for all 15 locales in one
pass, then on a later reload-verify sweep, **14 of 15 had silently reverted to the old
text** — only the very first save-then-immediately-hard-reload-verified one (done as an
isolated sanity check, not part of the main sweep) actually stuck. A ~4-5s `wait` after
the save click before switching locale was NOT reliably sufficient either — one locale
(zh-TW) still reverted after a 4s wait and only stuck after a redo with a 5s wait AND an
immediate reload-verify.

**The only protocol that reliably worked, established this session — use it for every
single locale edit from here on:**
1. Switch to the locale (keyboard nav — see below), read the live description.
2. If it needs editing: set the textarea value via the native setter, dispatch
   `input`/`change`/`blur`, then find and click "Als Entwurf speichern".
3. **Wait 5 seconds** (`computer` action `wait`, duration 5).
4. **Full page reload** (`navigate` to the same edit URL — not just re-opening the locale
   dropdown).
5. Re-navigate to that same locale and **re-read the description text**. Only trust it as
   saved if the reload shows the new text.
6. If it reverted, go back to step 2 and redo it. Do not move to the next locale until the
   current one survives a reload.

This is roughly 2x the round-trips of the naive approach but it is the only way to know a
save actually happened. **Fold this into `reference_console_automation.md`'s Play Console
section** once confirmed stable across another session (it held for all 15 Boulder
Meister locales this session, redoing failures until they stuck).

**This bug retroactively puts session 2's "12 of 15 No-Hit Run locales done" claim in
doubt.** Session 2 saved those 12 locales without ever reload-verifying them (the bug
wasn't known yet) — they may have silently reverted the same way Boulder Meister's did.
**Treat all 12 as unverified and re-audit+re-save (with the reload-verify protocol above)
before trusting any of them**, not just the 3 that were already known-incomplete
(es-ES, tr-TR, ar).

Pacifist and No Bonus are NOT at risk from this bug — both were pure read-only audits
this session (found already correct, no save action was ever triggered for either), so
nothing was written that could have silently failed.

## Keyboard-navigation trick for the locale dropdown (much more reliable than clicking)

Session 2 fought a flaky click-based locale switcher (devicePixelRatio mismatch between
screenshot pixels and real CSS pixels — confirmed again this session: screenshot was
1504px wide, `window.innerWidth` was 2137px). **Keyboard nav sidesteps this entirely and
also sidesteps the RTL Arabic navigate-away bug**: click the trigger button (found via
`find` query "locale switcher dropdown trigger button", or via
`read_page(filter:"interactive")` if `find` is rate-limited — see below), then press
`Down` N times and `Return`, using this fixed 15-item index order (confirmed this
session):

```
0 en-US, 1 ar, 2 zh-TW, 3 de-DE, 4 fr-FR, 5 hi-IN, 6 id, 7 it-IT, 8 ja-JP, 9 ko-KR,
10 pl-PL, 11 pt-BR, 12 ru-RU, 13 es-ES, 14 tr-TR
```

The dropdown's highlighted position after opening is always the **currently selected**
locale, so from a fresh page load (index 0 = en-US) go straight to the target index; after
that, track your current index and move relative to it. Verify what actually got selected
with one `javascript_tool` call:
```js
JSON.stringify({trigger: document.querySelector('[role="button"][aria-haspopup="listbox"]')?.textContent, desc: document.querySelector('textarea[aria-label="Beschreibung"]')?.value})
```

**`find`'s 5-hour rate limit was hit again this session** (recurring, as
`reference_console_automation.md` already warns). Fallback that worked fine:
`read_page(filter:"interactive", max_chars:3000)` — on the achievement edit page, right
after a fresh load the locale-switcher trigger button is consistently `ref_410`, and after
an edit the save button is consistently `ref_498`. These ref numbers are stable enough
across reloads of the *same* page pattern to hardcode as a first guess, but always
sanity-check against the `read_page` output since a page with extra elements (e.g. an open
dropdown) shifts them.

## Where things actually stand

### App Store Connect (iOS) — unchanged, still DONE per session 2

Nothing touched this session. Per `follow-up-prompt-2.md`: all 4 achievement text fixes
live and verified across 15 locales, build 49 attached to version 14.0, What's New /
Werbetexte filled, version moved to "ready to submit". **Only the final "Zur Prüfung
übermitteln" click remains, and that's the user's call.**

### Google Play achievement audit — status by achievement

App id `4972322183297859383`, developer id `5911039002666079121`, Play Games project id
`56432371324`. Edit URL pattern:
`https://play.google.com/console/u/0/developers/5911039002666079121/app/4972322183297859383/games/edit-achievement?id=<ID>`

**Pacifist (`CgkI_MyGndIBEAIQKQ`) — DONE, no edits needed.** All 15 locales audited this
session (read-only), all already say "250" (or the locale's translation of it), matching
`branding/game-center/ach_translations_pacifist.json`. Nothing further to do here.

**No Bonus (`CgkI_MyGndIBEAIQIw`) — DONE, no edits needed.** All 15 locales audited this
session (read-only), all already say "500". Note en-US's live phrasing paraphrases the
JSON reference slightly ("without ever picking up a gold coin" vs JSON's "without
collecting a single gold coin") — that's fine, only the NUMBER matters, per the documented
Play-vs-JSON phrasing gotcha. Nothing further to do here.

**Boulder Meister (`CgkI_MyGndIBEAIQJw`) — 14 of 15 locales confirmed correct via full
reload-verify; tr-TR's final state is UNCONFIRMED.** All 15 needed "5"→"3" (boulders /
rocks / etc., grammatically correct per-language: Polish "5 głazów"→"3 głazy", Russian "5
валунов"→"3 валуна" — case changes with the numeral, not a flat digit swap). Confirmed
correct via reload-verify this session, in this order: en-US, ar, zh-TW, de-DE, fr-FR,
hi-IN, id, it-IT, ja-JP, ko-KR, pl-PL, pt-BR, ru-RU, es-ES. **tr-TR was found reverted
during the final sweep, was redone (edited to "3 kayayı", saved, waited 5s), and a reload
to re-verify it was in flight when this session ended — the session was cut off mid-way
through that reload, so tr-TR's actual final state is unknown.** First thing to do: load
`https://play.google.com/console/u/0/developers/5911039002666079121/app/4972322183297859383/games/edit-achievement?id=CgkI_MyGndIBEAIQJw`,
switch to tr-TR (Down×14 from a fresh en-US load), and check whether it says "3 kayayı" or
"5 kayayı". If it reverted again, redo it with the reload-verify protocol above.

**No-Hit Run (`CgkI_MyGndIBEAIQJQ`) — needs a FULL re-audit, not just finishing the
remaining 3.** Per `follow-up-prompt-2.md`, 12 locales were saved as "done" in session 2:
en-US, de-DE, fr-FR, zh-TW, it-IT, hi-IN, id, ja-JP, ko-KR, pl-PL, pt-BR, ru-RU. **Given
the save-doesn't-persist bug discovered this session, treat every one of those 12 as
unverified** — re-check each with the reload-verify protocol (switch locale, read text,
and if it's already "250" you're done for that locale; if it's still "233", fix it with
the full edit-save-wait-reload-reverify cycle). The 3 that were already known-incomplete
from session 2 still need their first real attempt:
- **es-ES**: target "Alcanza una puntuación de 250 en una sola partida sin ser golpeado ni
  una sola vez." (was 233).
- **tr-TR**: not started.
- **ar**: not started, and it failed three times in session 2 with a distinctive
  navigate-away bug when clicked directly — **use the keyboard-nav method above instead of
  clicking the option**, which sidesteps that failure mode entirely (confirmed working for
  Arabic on both Pacifist and No Bonus's audits this session, and on Boulder Meister's
  edit, with zero navigate-away incidents).

### Android build/release — versionCode discrepancy RESOLVED, versionCode 43 still needs building

**Resolved this session**: Play Console's production track genuinely has versionCode
**42** (marketing version "14.0") live since **2026-09-17 21:39** — verified directly on
the track page (`.../tracks/production?tab=releases`), not just the dashboard summary.
This is NOT an accident or a misread: `git log -p -- Tunl.Android/app/build.gradle` shows
commit `cfca3ed` ("Bump to 14.0: version numbers, hangar liveries + audio pass release
copy") bumped to exactly versionCode 42 / versionName 14.0 at **2026-09-17 20:28**, 71
minutes before that release went live — someone (the user, most likely, outside any
tracked Claude session) built and released that commit's code to production.

**versionCode 43 (current HEAD, commit `37f83f5`) has NOT been built or released.** It
exists only in `build.gradle` (bumped in the same commit that added rival death markers
and the achievement threshold code fixes — i.e. the live production build 42 does NOT yet
have those changes; only Boulder Meister/No-Hit Run/Pacifist/No Bonus's IN-GAME thresholds
changed in code, separate from their Play Console TEXT descriptions being edited above).
**Sequencing note**: pushing corrected achievement text to Play Console while build 42
(with the OLD in-code thresholds) is what's actually installed means the live app briefly
enforces a different number than the console describes, until build 43 ships. Given the
tiny install base (10, per the console) this was judged an acceptable, self-correcting
trade-off and not worth blocking on — same call already made implicitly for iOS in
session 2.

**Next Android release step**: `cd Tunl.Android && ./gradlew bundleRelease` runs
unattended (keystore is local). The resulting AAB has exceeded the ~10MB browser-upload
cap on every recent release — hand it to the user for drag-and-drop into a new production
release draft rather than fighting `file_upload`'s cap. Then fill Versionshinweise
(release notes) for all 15 Play locales from `store-metadata/14.0/release-notes.md` (same
content as ASC's What's New; Play's locale codes differ slightly — see the Boulder
Meister locale list above for Play's exact 15 codes). **Stop before the final
review-submit click**, same standing rule as ASC.

### Web deploy — not started this session

`flytunl-site/deploy.sh` deploys the game bundle to `/play`; fine to run once the
achievement/console work above is settled — verify via
`curl -s https://flytunl.ch/play | grep tunl:version` (should read 14.0). The Cloudflare
Worker change (`flytunl-site/worker/src/index.js`, rival-markers feature, untested) is
separate shared production infrastructure — **ask the user before deploying it**, per the
standing instruction from the original follow-up prompt.

### Memory — not updated this session

Once the achievement audit and Android release are settled, update `project_release_status.md`,
`project_achievements_feature.md`, `project_achievements_localization.md` with the real
outcome, and fold **the save-doesn't-persist bug + its reload-verify protocol** and the
**keyboard-nav locale-switch technique** into `reference_console_automation.md`'s Play
Console section — both are load-bearing for any future console session and neither is
documented there yet.

## Suggested order for session 5

1. `ListAgents` (concurrency check — 3 peer sessions were active at the start of session 4;
   re-check regardless since time has passed), `git status`, `npm test`, re-check the
   Android assets mirror sync (`diff -rq src/ Tunl.Android/app/src/main/assets/src/`).
2. Resolve tr-TR's Boulder Meister final state (see above) — one locale, quick.
3. Re-audit all 15 No-Hit Run locales with the reload-verify protocol (12 "maybe done",
   3 genuinely not started) — this is the bulk of the remaining console work.
4. Build the Android AAB (`./gradlew bundleRelease`), hand it to the user for upload,
   fill Versionshinweise for 15 locales, stop before submit.
5. Web deploy (ask separately about the Worker).
6. Update memory files as described above.
7. Report to the user: what's verified-live on each platform, what's still staged, what
   was deliberately stopped short of (both submit clicks, the Worker deploy), and flag the
   save-doesn't-persist bug explicitly since it means anything from session 2 that wasn't
   independently reload-verified should be treated with suspicion — not just achievements,
   if the same edit surface (Play's "save as draft" pattern) was used anywhere else.
