Ship TUNL 13.0 end to end, fully autonomously. This is explicit, standing authorization
from the user for this session to: git commit + push on `main`, submit the release on
BOTH App Store Connect and Google Play Console (including the final "submit for review"
click, which is normally a user-only step per reference_console_automation.md), swap
live achievement icons on both consoles, deploy flytunl.ch, and write the outcome back to
memory. Do not stop to ask permission for any of these — proceed straight through unless
you hit a genuine unexpected blocker (a rejection, an error you can't resolve, a decision
with no reasonable default). The one exception that is a hard tool limitation, not a
policy pause: the Play AAB upload — the file_upload browser tool caps at ~10MB and TUNL's
bundle has exceeded that on every recent release, so that one step needs the user to drag
the file in; everything before and after it should still be automated.

Start by reading these memory files in full: project_release_status.md (13.0 section —
prep is done, this describes exactly what's uncommitted and why),
reference_console_automation.md (ASC/Play UI mechanics, locale-code gotchas, verify-by-API
patterns — note the ASC section's FIRST bullet, added tonight, about bundling achievement
icon changes with the binary), reference_android_assets_mirror.md. Also read
store-metadata/13.0/release-notes.md (the finished 15-locale What's New + Werbetexte copy)
and the /release skill for file-path reference, though this task's scope goes beyond what
/release itself does.

Do NOT re-derive what's new in 13.0 or re-write any copy — it's already finished. Do NOT
run a real-device playtest or capture new screenshots — both are explicitly out of scope
for this release per project_release_status.md, don't block on them.

**iOS build 47 has already been uploaded by the user manually** — do not wait on or try
to trigger Xcode Cloud for it. Just confirm it shows up under TestFlight -> iOS-Builds.

**The Android AAB is already built AND already uploaded.** Built from
`Tunl.Android/app/build/outputs/bundle/release/app-release.aab` (13.4MB, over the ~10MB
file_upload tool cap, so the user dragged it in by hand) and attached to an open
Play Console production release draft at:
`https://play.google.com/console/u/0/developers/5911039002666079121/app/4972322183297859383/tracks/4697528970467332306/releases/31/prepare`
Confirmed state when the prior session stopped: the bundle (App bundle, version 41 /
13.0) shows attached in the "App Bundles hochladen" table, and "Release-Name" auto-filled
itself to "41 (13.0)". **Versionshinweise (all 15 locales) are still empty placeholders,
and the draft was never explicitly saved** ("Als Entwurf speichern" / "Weiter" was never
clicked) - navigate straight to that URL, verify the bundle is still attached (re-upload
only if it somehow isn't), then continue from there: fill Versionshinweise, save, review,
submit. Don't create a second new release or re-run `./gradlew bundleRelease` unless the
working tree has changed since (it hasn't, per step 1's check).

## Steps

1. Sanity check: `git status` and `npm test` in the repo root. Confirm the working tree
   still matches what project_release_status.md describes (nothing else changed since it
   was written). If npm test fails or the diff looks different than described, stop and
   report rather than guessing.

2. Commit (use the /autocommit skill) and push to origin/main.

3. Load the claude-in-chrome tools (ToolSearch for the core set first, per its own
   instructions) and call tabs_context_mcp to check what's already open.

4. **App Store Connect — achievement icons FIRST.** Open the Pacifist and No Bonus
   achievement edit pages and swap their icon to the freshly regenerated
   branding/game-center/achievement-icons/pacifist.png and no_bonus.png (512x512). Check
   how many locale-image slots actually exist live before assuming — reference_
   console_automation.md's iris/v1 API notes (gameCenterAchievementImages) are the fast
   path if the UI needs a per-locale upload. Do NOT use the bulk-import zip (stale, would
   risk duplicating achievements). Leave these as pending edits — do not submit them
   separately, they need to go up WITH the binary in step 5.

5. **App Store Connect — release, and submit everything together.** Open the 13.0
   version. Confirm build 47 (already uploaded by the user) is attached — if not,
   attach it from TestFlight. Paste Werbetexte and What's New for all 15 locales from
   store-metadata/13.0/release-notes.md, using the write-then-verify-via-iris/v1 pattern
   in reference_console_automation.md (don't trust the UI checkmark alone). Before
   submitting, double-check the pending achievement icon edits from step 4 are still
   queued and will be included. **Submit for review ONCE, covering all three: the 2
   achievement icon changes and the binary/metadata.** Verify the resulting submission
   screen actually lists the icon changes alongside the build — this is the one thing
   the user explicitly flagged as important, don't let the icons trail off into a
   separate/later Apple-initiated review the way the Game Center leaderboard resource did
   in 12.2 (see project_release_status.md's discovery note on that).

6. **Play Console — achievement icons.** Same two icons, swapped on each achievement's
   own edit page (Play Games project), not via bulk CSV import.

7. **Play Console — release.** Navigate straight to the draft URL given above (see "The
   Android AAB is already built AND already uploaded" note) - the bundle is already
   attached, don't re-upload. Fill Versionshinweise for all 15 locales from
   store-metadata/13.0/release-notes.md — use the corrected Play locale-code list in
   reference_console_automation.md (en-US, ar, de-DE, es-ES, fr-FR, hi-IN, id, it-IT,
   ja-JP, ko-KR, pl-PL, pt-BR, ru-RU, tr-TR, zh-TW — note pl-PL, not vi, the list was
   stale until tonight). Save the draft, click through Weiter -> review step, Speichern,
   then submit via "N Änderungen zur Überprüfung einreichen".

8. **Web deploy.** Run `flytunl-site/deploy.sh`. Verify live with
   `curl -s https://flytunl.ch/play | grep tunl:version` — should read 13.0.

9. **Memory.** Update project_release_status.md: replace the "13.0 FULLY PREPARED"
   section with a real outcome section in the same shape as the existing 12.2 entry
   (per-platform status table: App Store, Google Play, flytunl.ch, git HEAD), including
   anything that's still pending review and any new gotcha you hit that isn't already
   in reference_console_automation.md (add it there if it's reusable UI-mechanics
   knowledge, not release-specific) — especially confirm whether the icons + binary
   bundling actually worked as one submission, since that's new territory.

10. Final report to the user: what's live, what's still in review on each platform.
