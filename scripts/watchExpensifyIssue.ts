/**
 * Dedicated 15-minute watcher for ONE issue.
 * Title includes the issue number. Polls every 30 seconds.
 *
 * Run: npx ts-node scripts/watchExpensifyIssue.ts <issueNumber>
 */
import {getWatcherTitle, POLL_INTERVAL_MS, WATCH_WINDOW_MS} from './expensifyWatcher/constants';
import {fetchIssue, hasHelpWanted} from './expensifyWatcher/github';
import {notifyWatcherClosed} from './expensifyWatcher/slack';
import {type IssueInfo, readActiveWatchers, readWatchState, writeActiveWatchers, writeHelpWantedResult, writeWatchState} from './expensifyWatcher/state';
import {markClosedNoLabel, markHelpWantedApplied} from './expensifyWatcher/tracker';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export type IssueWatchResult = {
    watcherTitle: string;
    issueNumber: number;
    status: 'help_wanted' | 'closed';
    startedAt: string;
    endedAt: string;
    issue: IssueInfo;
};

export async function watchSingleIssue(issueNumber: number): Promise<IssueWatchResult> {
    const watcherTitle = getWatcherTitle(issueNumber);
    process.title = watcherTitle;

    const issue = await fetchIssue(issueNumber);
    const issueInfo: IssueInfo = {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        postedAt: issue.created_at,
    };

    const startedAt = new Date().toISOString();
    const deadline = Date.now() + WATCH_WINDOW_MS;

    console.log(`[${watcherTitle}] Started watching for Help Wanted (15 min max)`);
    console.log(`[${watcherTitle}] ${issueInfo.title}`);
    console.log(`[${watcherTitle}] ${issueInfo.url}`);

    while (Date.now() < deadline) {
        const latestIssue = await fetchIssue(issueNumber);

        if (hasHelpWanted(latestIssue)) {
            const endedAt = new Date().toISOString();
            writeHelpWantedResult(issueInfo, startedAt);
            markHelpWantedApplied(issueNumber);

            const activeWatchers = readActiveWatchers();
            if (activeWatchers.watchers[String(issueNumber)]) {
                activeWatchers.watchers[String(issueNumber)].status = 'help_wanted';
                writeActiveWatchers(activeWatchers);
            }

            const state = readWatchState();
            if (!state.processed.includes(issueNumber)) {
                state.processed.push(issueNumber);
                writeWatchState(state);
            }

            console.log(`[${watcherTitle}] Help Wanted label found — ready for proposal`);

            return {
                watcherTitle,
                issueNumber,
                status: 'help_wanted',
                startedAt,
                endedAt,
                issue: issueInfo,
            };
        }

        const remainingMin = Math.ceil((deadline - Date.now()) / 60000);
        console.log(`[${watcherTitle}] No Help Wanted yet — checking again (${remainingMin} min left)`);
        await sleep(POLL_INTERVAL_MS);
    }

    const endedAt = new Date().toISOString();
    markClosedNoLabel(issueNumber);
    await notifyWatcherClosed(issueNumber, issueInfo.title, 'Label not applied in 15 minutes');

    const activeWatchers = readActiveWatchers();
    delete activeWatchers.watchers[String(issueNumber)];
    writeActiveWatchers(activeWatchers);

    console.log(`[${watcherTitle}] Closed — no Help Wanted within 15 minutes`);

    return {
        watcherTitle,
        issueNumber,
        status: 'closed',
        startedAt,
        endedAt,
        issue: issueInfo,
    };
}

async function main(): Promise<void> {
    const issueNumber = Number(process.argv[2]);

    if (!issueNumber || Number.isNaN(issueNumber)) {
        console.error('Usage: npx ts-node scripts/watchExpensifyIssue.ts <issueNumber>');
        process.exit(1);
    }

    const result = await watchSingleIssue(issueNumber);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
