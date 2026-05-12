---
name: ticket-end
description: Use when the user wants to finish/complete the current Linear ticket (e.g. "end ticket", "finish CHE-50", "merge and close", "ship this ticket"). Verifies the build, --no-ff merges the feature branch into main, pushes, moves the Linear ticket to Done, and posts a comment summarizing the commits + files changed. Requires Linear MCP, git, and an existing pushed remote.
---

# End a Linear ticket

When invoked, follow this sequence carefully. Bail (don't merge) if any safety check fails.

## 1. Identify the ticket

- Run `git branch --show-current`. Extract the ticket id from the branch name (e.g. `sankalans/che-50-...` → `CHE-50`). If the branch doesn't follow that pattern, ask the user which ticket this is.
- Fetch the ticket via `mcp__linear__get_issue` so you have title + current status for the merge commit + comment.

## 2. Pre-flight checks

Do all of these BEFORE touching main:

- `git status --short` — if dirty, ask the user whether to commit or abort. Never auto-commit silently.
- `git log main..HEAD --oneline` — confirm there is at least one commit on this branch. If none, abort: there's nothing to ship.
- Run the project's build / typecheck. For this project: `npm run build`. If it fails, abort and report the error. Never push broken code to main.

## 3. Collect work summary

Compute, but don't print until after the merge succeeds:

- Commit subjects: `git log main..HEAD --pretty=format:"- %s"`
- File-change stats: `git diff main..HEAD --stat`
- Total commits / files / +lines / −lines

## 4. Merge to main with --no-ff

```bash
git checkout main
git pull --ff-only
git merge --no-ff <feature-branch> -m "Merge <TICKET-ID>: <ticket title>"
git push
```

`--no-ff` is required so the ticket's history stays grouped under one merge commit (visible via `git log --first-parent`). If `git pull --ff-only` reports diverged main, STOP and ask the user — do not force-pull or rebase silently.

## 5. Move the ticket to Done

Use `mcp__linear__save_issue` with `id: <ticketId>` and `state: "Done"`. If the workspace uses a different terminal state name, first call `mcp__linear__list_issue_statuses` and pick the state whose type is `completed`.

## 6. Post a work-summary comment on the ticket

Use `mcp__linear__save_comment` with body formatted like:

```markdown
Merged to `main` in commit <SHA>.

**Commits**
- <subject 1>
- <subject 2>
...

**Files** (<N> changed, +<X> / -<Y>)
```
<output of git diff --stat>
```

**Notes**
<one or two lines on anything non-obvious: trade-offs, follow-ups, deferred work. If everything was straightforward, write "Straightforward implementation; no surprises.">
```

Keep it factual and short — the durable record of what happened belongs in this comment.

## 7. Clean up the branch

Ask the user if they want to delete the feature branch. If yes:

```bash
git branch -d <feature-branch>
git push origin --delete <feature-branch>
```

Use `-d` (safe), not `-D` (force). If `-d` refuses because the branch isn't merged, something is wrong — investigate, don't force.

## 8. Update task tracking

Mark the related TaskCreate task as completed.

## Notes

- Solo-dev flow: direct merge to main as above. If the project ever moves to a PR flow, replace step 4 with `gh pr create --fill` + a hand-off message, and stop. Do not auto-merge PRs.
- Do not force push to main. Ever. If the push is rejected, stop and report.
- The Linear comment is the durable record. Make it specific. Avoid boilerplate ("did the work as planned") — name the actual files and decisions.
