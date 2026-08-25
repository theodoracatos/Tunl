# Check Secrets Command

Scan the commits that are about to be pushed for secrets, before running `git push`. This
mirrors the enforcement already done automatically by the `.githooks/pre-push` git hook
(see CLAUDE.md) - use this command to get the same check's verdict *before* attempting a
push, e.g. mid-session after committing.

## Steps

1. Run `git config --get core.hooksPath` - if it does not print `.githooks`, tell the
   user the hook isn't activated in this clone and offer to run
   `git config core.hooksPath .githooks` for them (one-time per clone).

2. Find the commits that would be pushed: `git rev-list HEAD --not --remotes`. If empty,
   report "nothing to push - no new commits" and stop.

3. For each of those commits, check for:
   - **Sensitive filenames** (via `git show --pretty="" --name-only <commit>`): `.env`
     files, `appsettings.Production.json`, `appsettings.Staging.json`, `id_rsa*`, `*.pem`,
     `*.p12`, `*.pfx`, `*.keystore`, `*.jks`, or any path containing `secret`,
     `credential`, or `password`.
   - **Secret-shaped content** in added lines (`git show <commit> | grep '^+' `): private
     key headers (`-----BEGIN ... PRIVATE KEY-----`), AWS access key IDs (`AKIA...`),
     Google API keys (`AIza...`), GitHub tokens (`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_...`),
     Slack tokens (`xox...`), Stripe live keys (`sk_live_...`), and generic
     `key|secret|token|password = <long value>` assignments.

   The exact pattern list lives in `.githooks/pre-push` - use those patterns rather than
   inventing new ones, so this command and the enforced hook never disagree.

4. Report a clear verdict:
   - Clean: "No secrets found in N commit(s) ready to push."
   - Found: list each hit (commit, file/pattern) and say the real `git push` will be
     blocked by the pre-push hook until it's fixed. Do not attempt to fix it yourself
     (e.g. by rewriting history) without being asked - that's destructive and the user
     should decide how (amend, drop the file, rotate the leaked credential, etc.).
