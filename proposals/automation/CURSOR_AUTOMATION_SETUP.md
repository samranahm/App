# Expensify Help Wanted watcher — Cursor Automation setup

This automation watches **new** Expensify issues only. It waits up to **15 minutes** for Melvin to add the `Help Wanted` label, then notifies you on Slack and drafts a proposal. Issues that never get the label are logged to `ignored-issues.csv` (opens in Excel).

## How it works

```
New issue posted on Expensify/App
        ↓
Watcher picks it up (runs every 2 minutes)
        ↓
Watch for up to 15 minutes
        ↓
   ┌────┴────┐
   ↓         ↓
Help Wanted   No label after 15 min
applied       → log to ignored-issues.csv, stop watching
   ↓
Slack notify you
   ↓
Agent drafts proposal → proposals/<issue-number>.md
   ↓
You review and post manually
```

## Files

| File | Purpose |
|------|---------|
| `scripts/watchExpensifyHelpWanted.ts` | Watcher logic (detect, wait, ignore) |
| `proposals/automation/watch-state.json` | Tracks which issues we are watching |
| `proposals/automation/ignored-issues.csv` | Excel-friendly log of ignored issues |
| `proposals/automation/PROPOSAL_AGENT_INSTRUCTIONS.md` | Rules + format for writing proposals |
| `proposals/<issue-number>.md` | Draft proposals (one per issue) |

## Before you start

1. Install GitHub CLI: `brew install gh` then `gh auth login`
2. Optional: set `GITHUB_TOKEN` for higher API rate limits
3. Connect **Slack** in Cursor (cursor.com → Integrations)
4. Open this project in Cursor with the **Agents Window** (needed to create automations)

---

## Open the Automations editor (prefilled draft)

A ready-to-import draft is saved at:

**`proposals/automation/prefill-workflow.json`**

### How to open it

1. Open the **Agents Window** in Cursor (not regular chat).
2. Go to **Automations** → **New automation**.
3. Ask the agent: *"Open the Automations editor with the draft from proposals/automation/prefill-workflow.json"*
4. Or copy the settings below manually into the editor.

### After the editor opens — finish these in the UI

- [ ] **Slack channel** — pick your DM or a private channel (e.g. `#expensify-proposals`)
- [ ] **Cloud agent** — enable if you want it to run while Cursor is closed
- [ ] **GitHub token** — add `GITHUB_TOKEN` secret if rate limits hit (optional)
- [ ] **Push your automation files** — commit `scripts/watchExpensifyHelpWanted.ts` and `proposals/automation/` to `samranahm/App` on `main` so the cloud agent can access them

---

## Cursor Automation draft

Create this in the Cursor Automations editor (Agents Window → Automations → New).

| Setting | Value |
|---------|-------|
| **Name** | Expensify Help Wanted watcher |
| **Description** | Watch new Expensify issues for Help Wanted label, notify on Slack, draft proposal |
| **Trigger** | Every 2 minutes (cron: `*/2 * * * *`) |
| **Tools** | Post to Slack, read/write files in repo |
| **Repo** | Your local Expensify/App checkout |

### Agent instructions (paste into the automation prompt)

```
You are the Expensify Help Wanted watcher. Run every 2 minutes.

STEP 1 — Run the watcher script:
  npx ts-node scripts/watchExpensifyHelpWanted.ts

STEP 2 — Read the JSON output.

STEP 3 — For each issue in "helpWantedFound":
  a. Read the GitHub issue (use gh issue view <number> --repo Expensify/App)
  b. Read proposals/automation/PROPOSAL_AGENT_INSTRUCTIONS.md
  c. Investigate the codebase to find the root cause
  d. Write a proposal to proposals/<issue-number>.md following the format and rules
  e. Send a Slack message to me with:
     - Issue title and number
     - Link to the issue
     - One-line summary of the root cause
     - Path to the draft proposal file
     - Reminder: "Review before posting"

STEP 4 — For each issue in "ignored":
  Do nothing extra (already logged to proposals/automation/ignored-issues.csv).
  Optionally send a short Slack summary if any were ignored this run.

STEP 5 — For issues in "stillWatching":
  Do nothing. They are still within the 15-minute window.

RULES:
- Never post proposals to GitHub automatically.
- Use simple English in proposals (see PROPOSAL_AGENT_INSTRUCTIONS.md).
- File names only in proposal text, not full paths.
- GitHub links must use https://github.com/Expensify/App/blob/main/...
- Skip issues already in proposals/<number>.md unless the issue changed.
```

### Slack setup

In the Automations editor, enable **Post to Slack** and pick your DM or a private channel (e.g. `#expensify-proposals`).

---

## Manual test

Run the watcher once by hand:

```bash
npx ts-node scripts/watchExpensifyHelpWanted.ts
```

You should see JSON output with `helpWantedFound`, `newlyWatching`, `ignored`, and `stillWatching`.

---

## Tuning

| Setting | Default | Where to change |
|---------|---------|-----------------|
| Watch window | 15 minutes | `WATCH_WINDOW_MS` in `scripts/watchExpensifyHelpWanted.ts` |
| Poll interval | 2 minutes | Cron trigger in Cursor Automation |
| Ignored log | CSV (Excel) | `proposals/automation/ignored-issues.csv` |
