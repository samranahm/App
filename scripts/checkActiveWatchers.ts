/**
 * Checks only issues in active-watchers.json (not all GitHub issues).
 * Each watcher runs for up to 15 minutes from startedAt.
 *
 * Run: npx ts-node scripts/checkActiveWatchers.ts
 */
import {WATCH_WINDOW_MS} from './expensifyWatcher/constants';
import {fetchIssue, hasHelpWanted} from './expensifyWatcher/github';
import {notifyWatcherClosed} from './expensifyWatcher/slack';
import {type ActiveWatcher, readActiveWatchers, readWatchState, writeActiveWatchers, writeHelpWantedResult, writeWatchState} from './expensifyWatcher/state';
import {markClosedNoLabel, markHelpWantedApplied} from './expensifyWatcher/tracker';

export type CheckResult = {
    helpWanted: ActiveWatcher[];
    closed: ActiveWatcher[];
    stillWatching: ActiveWatcher[];
};

export async function checkActiveWatchers(): Promise<CheckResult> {
    const activeWatchers = readActiveWatchers();
    const state = readWatchState();
    const now = Date.now();

    const helpWanted: ActiveWatcher[] = [];
    const closed: ActiveWatcher[] = [];
    const stillWatching: ActiveWatcher[] = [];

    for (const [key, watcher] of Object.entries(activeWatchers.watchers)) {
        if (watcher.status !== 'watching') {
            continue;
        }

        const elapsed = now - new Date(watcher.startedAt).getTime();
        const issue = await fetchIssue(watcher.number);

        if (hasHelpWanted(issue) && !state.processed.includes(watcher.number)) {
            writeHelpWantedResult(watcher, watcher.startedAt);
            markHelpWantedApplied(watcher.number);
            watcher.status = 'help_wanted';
            activeWatchers.watchers[key] = watcher;
            state.processed.push(watcher.number);
            helpWanted.push(watcher);
            console.log(`[${watcher.watcherTitle}] Help Wanted found — ready for proposal`);
            continue;
        }

        if (elapsed >= WATCH_WINDOW_MS) {
            markClosedNoLabel(watcher.number);
            await notifyWatcherClosed(watcher.number, watcher.title, 'Label not applied in 15 minutes');
            delete activeWatchers.watchers[key];
            closed.push(watcher);
            console.log(`[${watcher.watcherTitle}] Closed — no Help Wanted within 15 minutes`);
            continue;
        }

        const remainingMin = Math.ceil((WATCH_WINDOW_MS - elapsed) / 60000);
        console.log(`[${watcher.watcherTitle}] Still watching (${remainingMin} min left)`);
        stillWatching.push(watcher);
    }

    writeActiveWatchers(activeWatchers);
    writeWatchState(state);

    return {helpWanted, closed, stillWatching};
}

async function main(): Promise<void> {
    const result = await checkActiveWatchers();
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
