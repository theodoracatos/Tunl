# Commit Command

Stage all current changes and commit with a generated message. Do not ask the user any questions - run every step automatically.

## Steps

1. Run these in parallel:
   - `git status` - see all untracked and modified files
   - `git diff` - see unstaged changes
   - `git diff --cached` - see already-staged changes
   - `git log --oneline -10` - see recent commit style to match

2. Safety check: if `git status` lists any of these files, stop and tell the user - do not stage or commit anything: `.env`, `appsettings.Production.json`, `appsettings.Staging.json`, or any file whose name contains `secret`, `credential`, or `password`. Otherwise continue immediately.

3. Run `git add -A`.

4. Write a commit message based on the diff:
   - Subject line under 72 characters, same verb style as recent commits
   - Focus on why, not what
   - No user confirmation needed - just write it

5. Commit:
   ```bash
   git commit -m "$(cat <<'EOF'
   <generated subject line>

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   EOF
   )"
   ```

6. Run `git push` to push the commit to the remote.

7. Run `git status` to confirm the working tree is clean, then report the commit subject and number of files committed.
