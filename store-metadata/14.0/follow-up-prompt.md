Continue shipping TUNL 14.0. This is a fresh session with no memory of the prior one, so
read before acting. **Do NOT click final "submit for review" / "Zur Prüfung übermitteln"
on either App Store Connect or Play Console without asking the user first** — that is an
explicit standing instruction from the prior session, not yet lifted. Everything else
(commits, pushes, console edits up to but not including that final submit click, web
deploy of the game bundle) can proceed without asking, unless you hit a genuine blocker.

**Start with App Store Connect (iOS) first, then Play Console (Android), then the web
build.**

## Read first

- `project_release_status.md` — current per-platform state. Its "State as of 2026-09-18"
  section describes 14.0 as NOT YET SHIPPED as of that writing; re-verify live, don't
  trust it, per its own standing rule ("a 'still a draft' claim in an old memory is not
  trustworthy without a live re-check").
- `project_achievements_feature.md` and `project_achievements_localization.md` — the
  achievement roster and per-locale text/icon status. Flags that `no_hit` and
  `boulder_meister` console text had NOT been pushed to either store as of the last
  write, and that concurrent-session edits made even `pacifist`/`no_bonus` uncertain.
  **Treat all four as unverified live and re-check fresh.**
- `reference_console_automation.md` — ASC/Play UI mechanics: locale switching, the
  `iris/v1` API shortcuts, Play's "silently drops a multi-locale edit in one page load"
  gotcha, the concurrency hazard section.
- `reference_android_assets_mirror.md` — before assuming an Android build reflects a
  `src/` change.
- The `/release` skill, for file-path reference (version bump locations, release-notes
  shape). Version numbers are already bumped this cycle — don't re-bump.

## What changed since 13.0 (commits `17b8657`..`HEAD`, now on `origin/main`)

Three commits: `f272da2` (hangar liveries, audio bus rework, pre-push dev-flag guard),
`cfca3ed` (bump to 14.0: version numbers, release copy), `37f83f5` (rival death markers,
achievement threshold fixes, build bump). Net effect relevant to store work:

1. **Hangar liveries + full audio pass** — already covered in
   `store-metadata/14.0/release-notes.md` (finished 15-locale What's New + Werbetexte,
   don't rewrite).
2. **Achievement threshold corrections** (`src/constants.js`, translations in
   `branding/game-center/ach_translations_pacifist.json` and `ach_translations_skill.json`,
   both files already correct locally, all 15 locales):
   - `tunl_ach_pacifist`: score 233 → **250**
   - `tunl_ach_no_hit`: score 233 → **250**
   - `tunl_ach_no_bonus`: score 233 → **500**
   - `tunl_ach_boulder_meister`: 5 boulders → **3 boulders**
3. **`tunl_ach_score_100000` ("Sechs Stellen") reworked to a lifetime total** across runs
   instead of a single-run score (a single-run six-digit score became mathematically
   unreachable after the flight-plan rework — see `project_achievements_feature.md`).
   Per that memory, ASC's description text for this one was already live-pushed and
   verified on 2026-09-18 — spot-check it's still correct, don't re-push blind.
4. **Rival death markers** (new feature): the death screen and share card now show other
   players' daily-leaderboard death positions. Native hooks added in `GameView.swift`
   (`fetchRivalDeaths`) and `MainActivity.kt` (`fetchRivalDeaths`) — no new permissions,
   reuses the existing leaderboard read. Web gets an anonymous sample from the Cloudflare
   Worker (`flytunl-site/worker/src/index.js`, changed but **not yet deployed**). This
   feature has had **no device playtest**. Not necessarily worth a "What's New" line (an
   invisible-unless-you-look death-screen addition, achievement text isn't player-facing
   copy at all) — judge it, don't force a rewrite of the finished release notes for it.
5. **Build numbers bumped, marketing version held at 14.0** (explicit user choice, not a
   mistake to "fix" by bumping to 14.1): iOS `CURRENT_PROJECT_VERSION` 49, Android
   `versionCode` 43, `TUNL_VERSION` stays `'14.0'`.

`npm test` was clean at HEAD before this was written — re-run it yourself as your own
sanity check before touching anything live, don't assume it still passes.

## Concurrency check before touching any browser automation

Call `ListAgents` first. If any peer session shows as active (not `idle`) and might be
touching Game Center / Play Console, stop and tell the user rather than racing it — same
standing rule as `reference_console_automation.md`'s concurrency section. Re-check this
periodically if the session runs long.

## Steps

1. **Sanity check.** `git status` (should be clean, HEAD at `37f83f5` or later) and
   `npm test`. If the tree doesn't match this description, stop and report rather than
   guessing what changed.

2. **App Store Connect — achievement text audit, all 4 changed achievements, all 15
   locales.** Don't trust the memory files' claims of what's already live. For each of
   `tunl_ach_pacifist`, `tunl_ach_no_hit`, `tunl_ach_no_bonus`, `tunl_ach_boulder_meister`:
   read the live description text via `iris/v1` (`gameCenterAchievementLocalizations`),
   compare against the corrected local JSON files, and push (also via `iris/v1`, faster
   than the UI) whichever locales are stale. These are pure locale-text edits — per
   `project_release_status.md` they publish live on save with no review queue, so this is
   safe to do independent of the version submission below. Verify every locale you touch
   by re-GETting it after the write, not by trusting the response alone.

3. **App Store Connect — build 49 and the version.** Check TestFlight → iOS Builds for
   build 49 (Xcode Cloud should have built it automatically from the `37f83f5` push — if
   it's missing, check whether Xcode Cloud is still running or failed before assuming a
   manual archive is needed). Open the 14.0 version draft (or check whether one already
   exists from a prior partial attempt), attach build 49, and paste
   `store-metadata/14.0/release-notes.md`'s What's New + Werbetexte for all 15 locales if
   not already there (write-then-verify via `iris/v1`, per the reference doc). **Stop
   before the final "Zur Prüfung übermitteln" click** — get the version to
   "ready to submit" state and report back instead.

4. **Play Console — same achievement text audit and push,** all 4 achievements, all 15
   locales, independent of the app release (publishes on its own "Veröffentlichen", not
   gated on binary review). Watch for the documented "Als Entwurf speichern silently
   drops a multi-locale edit in one page load" gotcha — reload between locales if editing
   more than one on the same page load.

5. **Play Console — the release itself.** versionCode 43 / 14.0. The AAB likely needs to
   be built (`./gradlew bundleRelease` runs unattended) and probably exceeds the browser
   upload tool's ~10MB cap (it has on every recent release) — if so, tell the user it
   needs their own drag-and-drop into the release draft rather than trying to force it
   through the tool. Fill Versionshinweise (release notes) for all 15 locales from the
   same file. **Stop before the final review-submit click**, same as ASC.

6. **Web deploy — ask before deploying the Worker.** `flytunl-site/deploy.sh` deploys the
   game bundle (`/play`) and is routine — fine to run once the above is settled, verify
   via `curl -s https://flytunl.ch/play | grep tunl:version` (should read 14.0). But the
   Cloudflare Worker change (`flytunl-site/worker/src/index.js`, part of the rival-markers
   feature) is shared production infrastructure and untested — **ask the user before
   deploying it**, don't bundle that into the routine site deploy silently. If you deploy
   the site JS without the worker change, the web rival-markers feature will just quietly
   get no data — confirm that's an acceptable interim state rather than assuming it.

7. **Memory.** Update `project_release_status.md` and `project_achievements_feature.md`/
   `project_achievements_localization.md` with the real outcome: what's live vs. staged
   vs. still pending the user's final submit click on each platform, and any new gotcha.

8. **Final report to the user:** what's ready to submit on each platform, what you
   deliberately stopped short of (the submit clicks, the Worker deploy), and anything you
   couldn't verify (e.g. if ASC login is walled off in this browser session again, say so
   explicitly rather than skipping silently).
