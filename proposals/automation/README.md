# Expensify proposal automation

Personal tooling to watch new Expensify/App issues and draft proposals when `Help Wanted` is applied.

**This is not part of the Expensify App product.** Do not submit these files in PRs to Expensify/App unless you intend to share the tooling.

## Quick start

1. Read `CURSOR_AUTOMATION_SETUP.md` and create the Cursor Automation.
2. Run `npx ts-node scripts/watchExpensifyHelpWanted.ts` to test locally.
3. When Slack notifies you, review `proposals/<issue-number>.md` and post manually:

```bash
gh issue comment <number> --repo Expensify/App --body-file proposals/<number>.md
```
