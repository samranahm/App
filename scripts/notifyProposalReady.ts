/**
 * Call after proposal is drafted. Updates tracker + sends Slack notification.
 *
 * Run: npx ts-node scripts/notifyProposalReady.ts <issueNumber> "<title>" "<url>"
 */
import {notifyProposalReady} from './expensifyWatcher/slack';
import {markProposalReady} from './expensifyWatcher/tracker';

async function main(): Promise<void> {
    const issueNumber = Number(process.argv[2]);
    const title = process.argv[3] ?? '';
    const url = process.argv[4] ?? `https://github.com/Expensify/App/issues/${issueNumber}`;
    const proposalPath = `proposals/${issueNumber}.md`;

    if (!issueNumber || Number.isNaN(issueNumber)) {
        console.error('Usage: npx ts-node scripts/notifyProposalReady.ts <issueNumber> "<title>" "<url>"');
        process.exit(1);
    }

    markProposalReady(issueNumber);
    await notifyProposalReady(issueNumber, title, url, proposalPath);

    console.log(`Notified Slack and updated tracker for issue #${issueNumber}`);
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
