/**
 * Orchestrator:
 * 1. Discovers newly posted issues (lightweight, no active polling).
 * 2. Starts a dedicated 15-minute watcher per new issue (background process).
 * 3. Each watcher title includes the issue number: "Expensify Watcher #92857"
 *
 * Run discovery only:  npx ts-node scripts/orchestrateExpensifyWatchers.ts
 * Run + spawn locally: npx ts-node scripts/orchestrateExpensifyWatchers.ts --spawn
 *
 * For Cursor Automation: run with --spawn on your Mac, or run discover only in cloud
 * and let local spawn handle the 15-minute watches.
 */
import {spawn} from 'child_process';
import fs from 'fs';
import path from 'path';
import {checkActiveWatchers} from './checkActiveWatchers';
import {discoverNewIssues} from './discoverNewExpensifyIssues';
import {notifyWatcherStarted} from './expensifyWatcher/slack';
import {createActiveWatcher, readActiveWatchers, writeActiveWatchers} from './expensifyWatcher/state';
import {addTrackerRowOnWatcherStart} from './expensifyWatcher/tracker';

type OrchestratorResult = {
    bootstrapped: boolean;
    startedWatchers: Array<{issueNumber: number; watcherTitle: string; pid?: number}>;
    skippedAlreadyWatching: number[];
    newIssuesFound: number;
    helpWanted: Array<{issueNumber: number; watcherTitle: string}>;
    closed: Array<{issueNumber: number; watcherTitle: string}>;
    stillWatching: Array<{issueNumber: number; watcherTitle: string}>;
};

function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function cleanupDeadWatchers(): void {
    const activeWatchers = readActiveWatchers();
    let changed = false;

    for (const [key, watcher] of Object.entries(activeWatchers.watchers)) {
        if (watcher.status !== 'watching' || !watcher.pid) {
            continue;
        }

        if (!isProcessRunning(watcher.pid)) {
            delete activeWatchers.watchers[key];
            changed = true;
        }
    }

    if (changed) {
        writeActiveWatchers(activeWatchers);
    }
}

function spawnIssueWatcher(issueNumber: number, shouldSpawn: boolean): {watcherTitle: string; pid?: number} {
    const scriptPath = path.join(__dirname, 'watchExpensifyIssue.ts');
    const watcherTitle = `Expensify Watcher #${issueNumber}`;

    if (!shouldSpawn) {
        return {watcherTitle};
    }

    const child = spawn('npx', ['ts-node', scriptPath, String(issueNumber)], {
        detached: true,
        stdio: 'ignore',
        cwd: path.join(__dirname, '..'),
    });

    child.unref();

    return {watcherTitle, pid: child.pid};
}

export async function orchestrate(shouldSpawn = false): Promise<OrchestratorResult> {
    cleanupDeadWatchers();

    const discovery = await discoverNewIssues();
    const activeWatchers = readActiveWatchers();
    const startedWatchers: OrchestratorResult['startedWatchers'] = [];
    const skippedAlreadyWatching: number[] = [];

    if (discovery.bootstrapped) {
        return {
            bootstrapped: true,
            startedWatchers: [],
            skippedAlreadyWatching: [],
            newIssuesFound: 0,
            helpWanted: [],
            closed: [],
            stillWatching: [],
        };
    }

    for (const issue of discovery.newIssues) {
        const key = String(issue.number);
        const existing = activeWatchers.watchers[key];

        if (existing && existing.status === 'watching') {
            skippedAlreadyWatching.push(issue.number);
            continue;
        }

        const spawned = spawnIssueWatcher(issue.number, shouldSpawn);
        const watcher = createActiveWatcher(issue);

        watcher.pid = spawned.pid;
        activeWatchers.watchers[key] = watcher;
        writeActiveWatchers(activeWatchers);

        startedWatchers.push({
            issueNumber: issue.number,
            watcherTitle: spawned.watcherTitle,
            pid: spawned.pid,
        });

        addTrackerRowOnWatcherStart(issue);
        await notifyWatcherStarted(issue.number, issue.title, issue.url);

        console.log(`Started ${spawned.watcherTitle}${spawned.pid ? ` (pid ${spawned.pid})` : ''}`);
    }

    // Check for help-wanted results written by background watchers.
    const resultsDir = path.join(__dirname, '..', 'proposals', 'automation', 'results');
    const pendingProposals: string[] = [];

    if (fs.existsSync(resultsDir)) {
        for (const file of fs.readdirSync(resultsDir)) {
            if (file.endsWith('.json')) {
                const content = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
                if (content.needsProposal) {
                    pendingProposals.push(file);
                }
            }
        }
    }

    if (pendingProposals.length > 0) {
        console.log('\n📝 Issues ready for proposal:');
        for (const file of pendingProposals) {
            console.log(`  proposals/automation/results/${file}`);
        }
    }

    // Cloud mode: check active watchers (no background spawn). Local --spawn mode uses dedicated processes.
    const checkResult = shouldSpawn ? {helpWanted: [], closed: [], stillWatching: []} : await checkActiveWatchers();

    return {
        bootstrapped: false,
        startedWatchers,
        skippedAlreadyWatching,
        newIssuesFound: discovery.newIssues.length,
        helpWanted: checkResult.helpWanted.map((w) => ({issueNumber: w.number, watcherTitle: w.watcherTitle})),
        closed: checkResult.closed.map((w) => ({issueNumber: w.number, watcherTitle: w.watcherTitle})),
        stillWatching: checkResult.stillWatching.map((w) => ({issueNumber: w.number, watcherTitle: w.watcherTitle})),
    };
}

async function main(): Promise<void> {
    const shouldSpawn = process.argv.includes('--spawn');
    const result = await orchestrate(shouldSpawn);
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
