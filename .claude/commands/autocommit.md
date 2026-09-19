# Commit Command

Stage all current changes and commit with a generated message. Do not ask the user any questions - run every step automatically.

## Steps

1. Run these in parallel:
   - `git status` - see all untracked and modified files
   - `git diff` - see unstaged changes
   - `git diff --cached` - see already-staged changes
   - `git log --oneline -10` - see recent commit style to match

2. Safety check: if `git status` lists any of these files, stop and tell the user - do not stage or commit anything: `.env`, `appsettings.Production.json`, `appsettings.Staging.json`, or any file whose name contains `secret`, `credential`, or `password`. Otherwise continue immediately.

3. Run `npm test` (i18n + math + collision suites). If any check fails, stop - do not stage or commit anything - and report the failure to the user instead.

4. Run `git add -A`.

5. Write a commit message based on the diff:
   - Subject line under 72 characters, same verb style as recent commits
   - Focus on why, not what
   - No user confirmation needed - just write it

6. Commit with `git commit -m` using the generated subject line, and end the message
   with the `Co-Authored-By:` attribution line given in this session's own instructions.
   Do not hardcode a model name here - it goes stale (this file said "Sonnet 5" while
   sessions were running on another model).

7. Run `git push` to push the commit to the remote.

8. Run `git status` to confirm the working tree is clean, then report the commit subject and number of files committed.
