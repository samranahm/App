# Proposal agent instructions

Use these rules every time you write a proposal for an Expensify Help Wanted issue.

## Writing rules

1. Use simple, plain English. No jargon or hard abbreviations.
2. Reference files by **name only** (e.g. `PersonalCardDetailsHeaderMenu.tsx`). Do not use full file paths in the text.
3. GitHub code links must point to the **Expensify/App** repo on the `main` branch:
   - Format: `https://github.com/Expensify/App/blob/main/<filepath>#L<line>`
   - Example: `[PersonalCardDetailsHeaderMenu.tsx#L84](https://github.com/Expensify/App/blob/main/src/pages/settings/Wallet/PersonalCardDetailsHeaderMenu.tsx#L84)`
   - Never use personal forks (e.g. samranahm).
4. Do not post large code diffs. Describe what to change in plain language.
5. Investigate the codebase before writing. Read the issue steps and find the real root cause.

## Proposal format (copy exactly)

```markdown
## Proposal

### What is the root cause of that problem?

[Explain in simple terms what causes the bug. Use file names only.]

### What changes do you think we should make in order to solve the problem?
<!-- DO NOT POST CODE DIFFS -->

[What to change, which file, what line or prop to remove/add.]
[Optional: link to Expensify repo line using markdown link format above.]
[2-3 bullet points on why this fix is correct.]

### What alternative solutions did you explore? (Optional)

[Only include if you explored real alternatives and rejected them. Keep it short.]

**Reminder:** Please use plain English, be brief and avoid jargon. Feel free to use images, charts or pseudo-code if necessary. Do not post large multi-line diffs or write walls of text. Do not create PRs unless you have been hired for this job.
```

## Where to save

Save each draft to: `proposals/<issue-number>.md`

Example: `proposals/92853.md`

Do **not** post to GitHub automatically. The user reviews and posts manually.
