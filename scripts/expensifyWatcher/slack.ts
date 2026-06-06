/**
 * Sends Slack notifications via Incoming Webhook.
 * Set SLACK_WEBHOOK_URL in your environment or Cursor automation secrets.
 *
 * Create webhook: Slack workspace → Apps → Incoming Webhooks → Add to channel/DM
 */

export async function sendSlackMessage(text: string): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        console.log('[Slack] SLACK_WEBHOOK_URL not set — skipping notification:');
        console.log(text);
        return;
    }

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text}),
    });

    if (!response.ok) {
        throw new Error(`Slack webhook error: ${response.status} ${response.statusText}`);
    }
}

export async function notifyWatcherStarted(issueNumber: number, title: string, url: string): Promise<void> {
    const message = [
        `🆕 *New Expensify issue detected*`,
        `*Issue:* #${issueNumber} — ${title}`,
        `*Watcher:* Expensify Watcher #${issueNumber} is now running (15 min)`,
        `*Link:* ${url}`,
    ].join('\n');

    await sendSlackMessage(message);
}

export async function notifyProposalReady(issueNumber: number, title: string, url: string, proposalPath: string): Promise<void> {
    const message = [
        `✅ *Proposal ready to review*`,
        `*Issue:* #${issueNumber} — ${title}`,
        `*Draft:* \`${proposalPath}\``,
        `*Link:* ${url}`,
        `Please review before posting to GitHub.`,
    ].join('\n');

    await sendSlackMessage(message);
}

export async function notifyWatcherClosed(issueNumber: number, title: string, reason: string): Promise<void> {
    const message = [`⏭️ *Watcher closed*`, `*Issue:* #${issueNumber} — ${title}`, `*Reason:* ${reason}`].join('\n');

    await sendSlackMessage(message);
}
