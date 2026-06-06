/**
 * Lightweight discovery — only finds newly posted issues.
 * Does NOT poll active watchers. Use orchestrateExpensifyWatchers.ts to start per-issue watchers.
 *
 * Run: npx ts-node scripts/discoverNewExpensifyIssues.ts
 */
import {WATCH_WINDOW_MS} from './expensifyWatcher/constants';
import {fetchRecentIssues} from './expensifyWatcher/github';
import {createActiveWatcher, type IssueInfo, readActiveWatchers, readWatchState, writeWatchState} from './expensifyWatcher/state';

export type DiscoveryResult = {
    bootstrapped: boolean;
    newIssues: IssueInfo[];
    highestSeenIssueNumber: number;
};

export async function discoverNewIssues(): Promise<DiscoveryResult> {
    const state = readWatchState();
    const activeWatchers = readActiveWatchers();
    const now = Date.now();
    const recentIssues = await fetchRecentIssues();

    const maxIssueNumber = Math.max(...recentIssues.map((issue) => issue.number), state.highestSeenIssueNumber);
    const activeNumbers = new Set(Object.keys(activeWatchers.watchers).map(Number));
    const processedNumbers = new Set(state.processed);
    const newIssues: IssueInfo[] = [];

    // First run: record current highest issue, do not watch old issues.
    if (state.highestSeenIssueNumber === 0) {
        state.highestSeenIssueNumber = maxIssueNumber;
        state.lastDiscoveryAt = new Date().toISOString();
        writeWatchState(state);
        return {bootstrapped: true, newIssues: [], highestSeenIssueNumber: maxIssueNumber};
    }

    for (const issue of recentIssues) {
        const ageMs = now - new Date(issue.created_at).getTime();
        const isNewByNumber = issue.number > state.highestSeenIssueNumber;
        const isRecent = ageMs <= WATCH_WINDOW_MS + 5 * 60 * 1000;

        if (!isNewByNumber && !isRecent) {
            continue;
        }

        if (activeNumbers.has(issue.number) || processedNumbers.has(issue.number)) {
            continue;
        }

        newIssues.push({
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            postedAt: issue.created_at,
        });
    }

    if (maxIssueNumber > state.highestSeenIssueNumber) {
        state.highestSeenIssueNumber = maxIssueNumber;
    }

    state.lastDiscoveryAt = new Date().toISOString();
    writeWatchState(state);

    return {bootstrapped: false, newIssues, highestSeenIssueNumber: state.highestSeenIssueNumber};
}

async function main(): Promise<void> {
    const result = await discoverNewIssues();
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
