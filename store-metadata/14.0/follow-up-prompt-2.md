# TUNL 14.0 — session 2 handoff (continuing from follow-up-prompt.md)

This is a fresh session with no memory of the prior two. Read this whole file before
touching the browser. It picks up exactly where a prior session ran out of browser
access mid-task. **Do NOT click final "submit for review" / "Zur Prüfung übermitteln" on
either App Store Connect or Play Console without asking the user first** — same standing
instruction as before, still not lifted. Everything else (commits, pushes, console edits
up to but not including that final submit click, web deploy of the game bundle) can
proceed without asking, unless you hit a genuine blocker.

## Concurrency check first

Call `ListAgents` before touching the browser. If any peer session shows as active (not
`idle`) and might be touching Game Center / Play Console, stop and tell the user rather
than racing it.

## Sanity check second

`git status` (should be clean, HEAD at `37f83f5` or later — check `git log -1`) and
`npm test` (was clean, 0 failures, at the start of the prior session). If the tree
doesn't match, stop and report rather than guessing what changed. Also re-run
`diff -rq src/ Tunl.Android/app/src/main/assets/src/` — it was resynced
(`cp -r src/* Tunl.Android/app/src/main/assets/src/`) in the prior session and should
show no differences; if it does, something touched `src/` since and the mirror needs
resyncing again before any Android build.

## Where things actually stand — READ CAREFULLY, this supersedes both prior memory
files and the original follow-up-prompt.md's assumptions

### App Store Connect (iOS) — DONE, stopped short of the submit click on purpose

All of this was live-verified this session, not assumed from memory:

1. **All 4 achievement text fixes (Pacifist/No-Hit Run/No Bonus/Boulder Meister) are
   live and verified correct across all 15 locales**, pushed via `iris/v1` PATCH,
   re-GET-verified byte-exact against the corrected local JSON
   (`branding/game-center/ach_translations_pacifist.json` and `_skill.json`). Nothing
   further needed here. IDs for reference:
   - App id `6789721765`, gameCenterDetail id `0eef1cf3-8902-4eff-9f44-b3e716c5749f`
   - Achievement ids: pacifist `5d781c8e-2b6b-4ff6-87a3-036155a388dd`, no_hit
     `520e2bb0-abe0-4619-bc0d-832589a4fcfa`, no_bonus
     `5dcb0fc2-d2d0-4f0b-8185-15e91e5445e4`, boulder_meister
     `33b7a8b2-5ec8-4179-8c4f-e1a361678d38`
2. **Version 14.0 (id `5b929270-6d62-4498-9b7f-e169b6676309`) has build 49
   (id `01f610f5-3b08-4a00-a60e-3d7f2b64e718`) attached** — Xcode Cloud built it
   automatically from the `37f83f5` push, no manual archive was needed.
3. **What's New + Werbetexte are filled and verified byte-exact for all 15 locales**
   from `store-metadata/14.0/release-notes.md`, pushed via `iris/v1` PATCH on
   `appStoreVersionLocalizations`.
4. **The version was moved to "ready to submit" state**: clicked "Zur Prüfung
   hinzufügen", which created a `reviewSubmissions` draft (panel titled
   "Übermittlungsentwurf" showing "iOS-App 14.0 (49)" ready, sidebar shows "14.0 Bereit
   zur Prüfung"). The panel's own "Zur Prüfung übermitteln" button is what actually
   sends it to Apple — that button was deliberately **not** clicked, per the standing
   instruction.

**iOS needs nothing further from you except reporting it's ready and, if the user says
go, clicking that one "Zur Prüfung übermitteln" button** (App Store Connect → TUNL →
Vertrieb → the "Übermittlungsentwurf" panel, or reload the version page and it'll show
again).

### Google Play (Android) — IN PROGRESS, this is the actual remaining work

App id `4972322183297859383` under developer account `5911039002666079121`. Achievement
edit-page ids (Play Games project id `56432371324`):
- Pacifist: `CgkI_MyGndIBEAIQKQ`
- No-Hit Run: `CgkI_MyGndIBEAIQJQ`
- No Bonus: `CgkI_MyGndIBEAIQIw`
- Boulder Meister: `CgkI_MyGndIBEAIQJw`

Edit URL pattern: `https://play.google.com/console/u/0/developers/5911039002666079121/app/4972322183297859383/games/edit-achievement?id=<ID>`

**Critical finding, must re-verify before pushing anything (see gotcha in
`reference_console_automation.md`): Play's live wording is NOT always the same as the
JSON snapshot's phrasing, even when the JSON was originally generated from Play.** The
safe pattern used all session, and the one to keep using: switch to the target locale,
read the live description text via `document.querySelector('textarea[aria-label="Beschreibung"]').value`,
confirm it's the OLD score number (233 for no_hit/pacifist-style, or whatever the old
value is for no_bonus/233→500 and boulder_meister/5→3), do a **plain string substitution
on that live text** (`.replace('233','250')` etc.), never paste in the JSON's canonical
sentence wholesale. Every locale checked this session matched the JSON's phrasing
exactly once the number was swapped, but don't assume that holds for the locales/
achievements not yet checked — read-then-substitute regardless.

#### Achievement-by-achievement status

**Pacifist (`CgkI_MyGndIBEAIQKQ`)** — only en-US was spot-checked (already correct: "Reach
score 250 in a single run without collecting any coins at all.", i.e. live and matching).
**The other 14 locales were never checked on Play this session.** Given ASC's Pacifist
was already fully correct across all 15 locales before this session started, Play's
Pacifist is *probably* also already done (same class of achievement, same timing as
No Bonus which the memory file also claims is done) — but **do not assume, audit live**,
same read-substitute-verify loop as below. If any locale still says 233, fix it.

**No Bonus (`CgkI_MyGndIBEAIQIw`)** — **not checked at all this session.** Per
`project_achievements_feature.md`'s claim (unverified this session, could be stale):
"pacifist/no_bonus pushed... as of 2026-09-18" — but that memory conflates ASC and Play
and was written before this session's Play-side work, so **treat as unverified and audit
all 15 locales live**, same as Boulder Meister below. The old value to look for is 233
(if it mirrors no_hit) — verify what the actual live English string says before assuming
the number.

**No-Hit Run (`CgkI_MyGndIBEAIQJQ`)** — **12 of 15 locales done and verified this
session** (live text read, "233"→"250" substituted, saved, and either directly verified
via a reload+re-switch or via a hard reload's English-persists spot check): en-US,
de-DE, fr-FR, zh-TW, it-IT, hi-IN, id, ja-JP, ko-KR, pl-PL, pt-BR, ru-RU.

**3 locales remain for No-Hit Run:**
- **es-ES**: the live text was read ("Alcanza una puntuación de 233 en una sola partida
  sin ser golpeado ni una sola vez.") and the substitution to 250 was made **in the page's
  DOM**, but the save click never completed (the `find` tool hit its own 5-hour rate
  limit right at that point, and then browser access ended). **This edit is almost
  certainly lost** — the browser tab's state doesn't survive to a new session. Start
  fresh: navigate to the edit URL, switch to es-ES, confirm it's still showing 233, redo
  the substitution, save, verify.
- **tr-TR**: not started.
- **ar (Arabic)**: not started, and it **failed three separate times** in the prior
  session with a distinctive failure mode — clicking the "Arabisch – ar" option (via a
  freshly-`find`-resolved ref, not a stale one) caused the whole page to navigate away to
  `.../app-list` (the "Startseite" app dashboard) instead of switching the locale, as if
  the click landed on the "Alle Apps" breadcrumb instead of the intended option. This
  didn't happen for any other locale. If it recurs, try: (a) retrying from a fresh page
  load each time (already the standing practice), (b) trying `scroll_to` on the option's
  ref before clicking (this fixed a similar one-off failure on Italian), (c) if it keeps
  failing, consider whether Arabic's RTL layout is shifting the option's real screen
  position in a way that confuses the click resolution, and try zooming in on the actual
  dropdown before clicking to sanity-check the option is really where the ref claims.

**Boulder Meister (`CgkI_MyGndIBEAIQJw`)** — **not started at all**, all 15 locales
still need the same read-substitute-verify treatment. Local JSON reference (already
correct, all 15 locales — do NOT push this wholesale, use it only to sanity-check the
live text's phrasing matches after substitution):
`branding/game-center/ach_translations_skill.json` — target text is "3 boulders" /
"3 Felsbrocken" / etc. (was "5"/whatever the old count was — check live first).

#### Play Console locale dropdown — full option list and mechanics learned this session

The 15 options as they appear in the dropdown (exact strings, useful for `find` queries):
"Standard – Englisch (Vereinigte Staaten) – en-US", "Arabisch – ar", "Chinesisch
(Traditionell) – zh-TW", "Deutsch – de-DE", "Französisch (Frankreich) – fr-FR", "Hindi –
hi-IN", "Indonesisch – id", "Italienisch – it-IT", "Japanisch – ja-JP", "Koreanisch –
ko-KR", "Polnisch – pl-PL", "Portugiesisch (Brasilien) – pt-BR", "Russisch – ru-RU",
"Spanisch (Spanien) – es-ES", "Türkisch – tr-TR".

**New gotchas found this session, not yet in `reference_console_automation.md` — add
them there once confirmed stable:**

1. **The locale switcher trigger button is flaky to open.** It's found via `find` query
   "locale switcher dropdown trigger button" and clicked by ref (never coordinates —
   confirmed dead on arrival every time, screenshot pixel space and CSS click space
   don't line up, the doc's existing devicePixelRatio warning is real and worse than
   expected here). A single click on the ref frequently does **not** open it — no error,
   it just silently stays closed. **The only reliable check is a screenshot**, not
   `find`'s own "is the dropdown open" read (which was wrong both directions repeatedly:
   claiming closed when a screenshot showed it open, and vice versa). Loop: click ref →
   screenshot → if closed, click same ref again → screenshot → repeat (took 1–4 clicks
   in practice, no discernible pattern to how many).
2. **Once open, clicking an option by a freshly-`find`-resolved ref usually works, but
   not always.** Failure modes seen: (a) the click silently no-ops and the dropdown
   stays open on the old locale — cheap to detect and retry, just re-`find` the same
   option and click again; (b) the whole page navigates away to `.../app-list` — this is
   the expensive one, recover by re-navigating to the edit URL and starting the locale
   switch over. This happened for Arabic three times in a row and nowhere else, and also
   once each for German (2nd attempt) and Hindi (1st attempt) before succeeding on retry.
3. **Verify a locale switch succeeded via a single `javascript_tool` call**, not a
   screenshot (cheaper, and avoids visually parsing script you may not read):
   `JSON.stringify({url: location.href, trigger: document.querySelector('[role="button"][aria-haspopup="listbox"]')?.textContent, desc: document.querySelector('textarea[aria-label="Beschreibung"]')?.value})`
   — if `url` shows `app-list`, you navigated away, go back. If `trigger` still shows the
   old locale, the option click no-op'd, retry it. Otherwise `desc` is the live text to
   substitute in.
4. **Edit via the native setter trick** (already documented) —
   `document.querySelector('textarea[aria-label="Beschreibung"]')`, get the value
   descriptor's setter from `HTMLTextAreaElement.prototype`, call it, then dispatch
   `input`/`change`/`blur`. `find` query "Als Entwurf speichern button" reliably finds
   the save button once the field's been touched (its `disabled` flips false one React
   tick after the event fires, per the pre-existing documented gotcha — no extra wait
   needed in practice, the `find` round-trip itself is enough delay).
5. **Verify the save landed via** `document.body.innerText.includes('Deine Änderungen wurden gespeichert')`
   in a `javascript_tool` call right after clicking save (give it ~2s first). This
   confirms the save fired but is an in-session confirmation only — per the pre-existing
   documented gotcha, a hard reload is the only real proof a multi-locale-editing-session
   didn't silently drop something. This session followed the safe pattern throughout
   (one locale's edit + save fully completed, occasionally reload-verified, before ever
   touching the next locale's switch) so the 12 completed No-Hit Run locales should be
   solid, but a spot-check reload of 2–3 of them wouldn't hurt before moving on.
6. **`find`'s own separate 5-hour rate limit was hit this session** (confirmed the
   existing doc's claim: `computer`, `javascript_tool`, `read_page` all kept working
   fine after it fired). If it recurs, fall back to
   `read_page(filter:"interactive", max_chars: 6000)` to get element refs instead of
   `find` — the refs work identically once obtained, `read_page` just requires scanning
   more text to spot the right one (button refs near a `textbox "Beschreibung"` entry are
   almost always the save/discard button pair right after it).

#### An unresolved and IMPORTANT discrepancy — check this FIRST before any Play work

While navigating Play Console this session, the "Testen und veröffentlichen" dashboard
showed **"Neuester Produktionsrelease: 42 (14.0) · Vor 13 Stunden · 100%"** — i.e. a
production release of versionCode **42**, marketing version 14.0, already live, dated
roughly 13 hours before this session started. This **does not match** the expectation
carried in both `project_release_status.md` and the original
`store-metadata/14.0/follow-up-prompt.md`, which describe Android as still needing a
**versionCode 43** release built and uploaded from scratch, with **nothing yet live for
14.0**. This was never investigated or resolved this session — do it first, before
touching the Play release flow:

1. Check `Tunl.Android/app/build.gradle` for the actual current `versionCode` /
   `versionName` (the follow-up prompt claims it was bumped to 43 in commit `37f83f5` —
   verify against `git show 37f83f5 -- Tunl.Android/app/build.gradle`).
2. Check Play Console's Produktion track page directly
   (`.../app/4972322183297859383/tracks/production` or via the sidebar) for the actual
   live/latest release entry, its versionCode, and its release notes/timestamp — the
   dashboard summary card can be stale or misleading, get the ground truth from the
   track page itself.
3. Figure out whether versionCode 42 is: (a) a legitimate 14.0 release that a concurrent
   session already pushed (check `ListAgents` history / ask the user), (b) an accidental
   or partial release that needs to be superseded by 43, or (c) something this session
   simply misread. **Do not assume — get the real numbers before deciding what, if
   anything, needs releasing.**
4. If a versionCode 43 build genuinely still needs producing:
   `cd Tunl.Android && ./gradlew bundleRelease` runs unattended (keystore is local). The
   resulting AAB has exceeded the ~10MB browser-upload cap on every recent release — hand
   it to the user for drag-and-drop into the release draft rather than fighting the
   `file_upload` tool's cap.

#### Play release notes (Versionshinweise)

Not yet touched this session. Once the versionCode discrepancy above is resolved and
(if needed) a release draft exists, fill Versionshinweise for all 15 locales from
`store-metadata/14.0/release-notes.md` (same content used for ASC's What's New — Play's
15 locale codes differ slightly from ASC's, see the `reference_console_automation.md`
note on this, and the locale list right above in this doc for Play's exact codes).
**Stop before the final review-submit click**, same as ASC.

### Web deploy — not started this session

`flytunl-site/deploy.sh` deploys the game bundle to `/play` and is routine (fine to run
once the achievement/console work above is settled) — verify via
`curl -s https://flytunl.ch/play | grep tunl:version` (should read 14.0). The
Cloudflare Worker change (`flytunl-site/worker/src/index.js`, part of the rival-markers
feature, untested) is separate shared production infrastructure — **ask the user before
deploying it**, per the original follow-up prompt's instruction, still standing.

### Memory — not updated this session

Once the Play Console achievement audit and (if applicable) release are settled, update
`project_release_status.md`, `project_achievements_feature.md`, and
`project_achievements_localization.md` with the real outcome: what's live vs. staged vs.
still pending the user's final submit click on each platform, the resolved versionCode
discrepancy, and the new Play locale-switcher gotchas above (fold into
`reference_console_automation.md`'s Play Console section once you've confirmed they're
not just this-session flukes).

## Suggested order for this session

1. `ListAgents`, `git status`, `npm test`, re-check the Android assets mirror sync.
2. **Resolve the versionCode 42-vs-43 discrepancy first** — this could change what the
   rest of the Android work even is.
3. Finish the Play Console achievement audit: Pacifist (spot-check remaining 14
   locales), No Bonus (full 15-locale audit+push), Boulder Meister (full 15-locale
   audit+push), No-Hit Run (redo es-ES, do tr-TR, retry ar).
4. Handle the Play release itself once the versionCode question is resolved (build if
   needed, hand AAB to user if over the upload cap, fill Versionshinweise, stop before
   submit).
5. Web deploy (ask separately about the Worker).
6. Update memory files.
7. Report to the user: what's ready to submit on each platform, what you deliberately
   stopped short of (both submit clicks, the Worker deploy), and anything you couldn't
   verify.
