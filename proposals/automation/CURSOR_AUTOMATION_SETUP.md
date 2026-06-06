# Expensify Help Wanted watcher — setup guide

## Your flow

```
1. New issue posted on Expensify/App
        ↓
2. Slack notification immediately:
   "Expensify Watcher #92857 is now running (15 min)"
        ↓
3. Excel row added to issue-tracker.csv
        ↓
4. Watcher runs for 15 minutes
        ↓
   ┌────┴────┐
   ↓         ↓
Help Wanted   No label in 15 min
applied       → is_proposal_posted = no
   ↓          → notes = "Label not applied in 15 minutes"
Draft proposal
   ↓
5. Slack notification:
   "Proposal ready to review — see proposals/92857.md"
        ↓
6. You review and post manually to GitHub
```

## Excel tracker (`issue-tracker.csv`)

Opens in Excel. Columns:

| Column | Description |
|--------|-------------|
| `issue_number` | GitHub issue number |
| `issue_title` | Issue title |
| `issue_url` | Link to issue |
| `posted_at` | When issue was posted |
| `help_wanted_applied_at` | When Help Wanted label was applied (empty if never) |
| `is_proposal_posted` | `yes` if proposal drafted, `no` if not |
| `notes` | `Watcher running` / `Proposal drafted` / `Label not applied in 15 minutes` |

## Slack setup (personal workspace)

### Option A — Incoming Webhook (for script notifications)

1. Slack → **Apps** → **Incoming Webhooks** → **Add to Slack**
2. Pick your channel or DM
3. Copy the webhook URL
4. Add the webhook URL as a secret (see **Where to add secrets** below — it is NOT inside the automation editor).

Script sends notifications for:
- Watcher started (new issue)
- Watcher closed (no label)
- Proposal ready (after drafting)

### Option B — Cursor Slack integration (for agent messages)

1. Cursor → Integrations → **Slack** → Connect your personal workspace
2. In Automations editor, enable **Post to Slack** and pick your channel
3. Agent sends "Proposal ready" message after drafting

Use **both** for best coverage: webhook for instant watcher alerts, Cursor Slack for proposal-ready message.

---

## Scripts

| Script | When it runs |
|--------|--------------|
| `orchestrateExpensifyWatchers.ts` | Every 2 min — discover + start watchers + Slack + Excel |
| `notifyProposalReady.ts` | After proposal drafted — updates Excel + Slack |
| `watchExpensifyIssue.ts <n>` | Dedicated 15-min watcher (local `--spawn` mode) |

## Cursor Automation

| Setting | Value |
|---------|-------|
| **Name** | Expensify Issue Discovery |
| **Trigger** | Every 2 minutes |
| **Tools** | Post to Slack |
| **Secret** | `SLACK_WEBHOOK_URL` (in Cloud Agents dashboard, not in automation editor) |
| **Entry** | `npx ts-node scripts/orchestrateExpensifyWatchers.ts` |

Prefilled draft: `proposals/automation/prefill-workflow.json`

---

## Manual test

```bash
# Set Slack webhook first
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Run orchestrator
npx ts-node scripts/orchestrateExpensifyWatchers.ts

# Test proposal notification
npx ts-node scripts/notifyProposalReady.ts 92853 "Test issue" "https://github.com/Expensify/App/issues/92853"
```

---

## Push to GitHub

Commit and push to `samranahm/App` on `main`:

- `scripts/orchestrateExpensifyWatchers.ts`
- `scripts/notifyProposalReady.ts`
- `scripts/expensifyWatcher/`
- `proposals/automation/`

## Where to add secrets (important)

**Secrets are NOT inside the Automations editor.** They live here:

1. Open [cursor.com/dashboard](https://cursor.com/dashboard) → **Cloud Agents**
2. Click **Secrets** (or **Environment** → **Secrets**)
3. Add a new secret:
   - **Name:** `SLACK_WEBHOOK_URL`
   - **Value:** your Slack Incoming Webhook URL (regenerate if you shared it publicly)
4. Save

Cloud agents and automations read this as an environment variable at runtime.

### If you still cannot find Secrets

- Make sure you are on a **Pro or Business** plan (automations need this)
- Try: Cursor app → **Settings** → search for **Cloud Agents** or **Secrets**
- For **local testing only**, skip the dashboard and run:
  ```bash
  export SLACK_WEBHOOK_URL="your-webhook-url"
  npx ts-node scripts/orchestrateExpensifyWatchers.ts
  ```

### You may not need the webhook at all for proposal messages

If you already connected **Slack** in Cursor Integrations and enabled **Post to Slack** in your automation, the agent can send the "proposal ready" message through Cursor's Slack tool.

The **webhook** is only needed for instant script alerts (watcher started / watcher closed) from `slack.ts`.
