---
name: ticket-start
description: Use when the user wants to begin work on a specific Linear ticket (e.g. "start CHE-50", "let's work on CHE-50", "begin ticket X"). Moves the ticket to In Progress, creates a fresh git feature branch using the ticket's gitBranchName, and prepares for implementation. Requires the Linear MCP server, git, and a clean-ish working tree.
---

# Start a Linear ticket

When invoked, follow this sequence end-to-end. Do NOT begin coding until the branch is created and the ticket is moved.

## 1. Resolve the ticket

- Parse the ticket identifier from the user's message (e.g. `CHE-50`). If multiple are mentioned or the message is ambiguous, ask the user which one.
- Fetch the ticket via `mcp__linear__get_issue` (load the tool first via ToolSearch if not already loaded). Read:
  - `title`
  - `description`
  - `gitBranchName`
  - current `status`
- If the ticket is already in a completed state (Done / Cancelled), warn the user and confirm they really want to reopen it before continuing.

## 2. Pre-flight: clean working tree

- Run `git status --short`. If anything is uncommitted, STOP and tell the user. Offer to stash, commit, or abort. Never silently throw away their work.
- Run `git branch --show-current`. If they are already on the branch matching this ticket's `gitBranchName`, skip step 4 and jump to step 5.

## 3. Move the ticket to In Progress

Use `mcp__linear__save_issue` with `id: <ticketId>` and `state: "In Progress"`. If the workspace uses a different active-state name, first call `mcp__linear__list_issue_statuses` for the team and pick the state whose type is `started`.

## 4. Create the feature branch

Use the EXACT `gitBranchName` returned by Linear (e.g. `sankalans/che-50-compute-eval-drop-from-users-perspective`). Run:

```bash
git checkout main
git pull --ff-only
git checkout -b <gitBranchName>
```

If the branch already exists locally, just check it out instead of failing.

## 5. Hand off to implementation

- Show the user the ticket title and a one-line summary of the description so the focus is clear.
- Surface any sub-tasks or acceptance criteria from the description.
- Create a TaskCreate entry for the ticket so progress is visible, and set it to in_progress.
- Begin work. Stay focused on the scope in the ticket description — do not silently expand scope.

## Notes

- This skill does NOT push the branch — that's `ticket-end`'s job.
- This skill does NOT run tests; the user may want to inspect first. Run tests inside the implementation phase, not here.
- If `git pull --ff-only` fails (main has diverged unexpectedly), STOP and ask the user — do not force-pull.
