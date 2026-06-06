import fs from 'fs';
import path from 'path';
import {ACTIVE_WATCHERS_FILE, AUTOMATION_DIR, getWatcherTitle, IGNORED_CSV, RESULTS_DIR, STATE_FILE} from './constants';

export type IssueInfo = {
    number: number;
    title: string;
    url: string;
    postedAt: string;
};

export type ActiveWatcher = IssueInfo & {
    watcherTitle: string;
    startedAt: string;
    status: 'watching' | 'help_wanted' | 'closed';
    pid?: number;
};

export type WatchState = {
    highestSeenIssueNumber: number;
    processed: number[];
    lastDiscoveryAt: string | null;
};

export type ActiveWatchersState = {
    watchers: Record<string, ActiveWatcher>;
};

function resolveFromRoot(relativePath: string): string {
    return path.join(__dirname, '..', '..', relativePath);
}

function ensureAutomationDir(): void {
    const dir = resolveFromRoot(AUTOMATION_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    const resultsDir = resolveFromRoot(RESULTS_DIR);
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, {recursive: true});
    }
}

export function readWatchState(): WatchState {
    ensureAutomationDir();
    const filePath = resolveFromRoot(STATE_FILE);

    if (!fs.existsSync(filePath)) {
        return {highestSeenIssueNumber: 0, processed: [], lastDiscoveryAt: null};
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WatchState & {watching?: unknown[]};

    // Migrate old state format.
    return {
        highestSeenIssueNumber: raw.highestSeenIssueNumber ?? 0,
        processed: raw.processed ?? [],
        lastDiscoveryAt: raw.lastDiscoveryAt ?? null,
    };
}

export function writeWatchState(state: WatchState): void {
    ensureAutomationDir();
    fs.writeFileSync(resolveFromRoot(STATE_FILE), `${JSON.stringify(state, null, 4)}\n`);
}

export function readActiveWatchers(): ActiveWatchersState {
    ensureAutomationDir();
    const filePath = resolveFromRoot(ACTIVE_WATCHERS_FILE);

    if (!fs.existsSync(filePath)) {
        return {watchers: {}};
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ActiveWatchersState;
}

export function writeActiveWatchers(state: ActiveWatchersState): void {
    ensureAutomationDir();
    fs.writeFileSync(resolveFromRoot(ACTIVE_WATCHERS_FILE), `${JSON.stringify(state, null, 4)}\n`);
}

export function appendIgnoredRow(issue: IssueInfo, startedAt: string, reason: string): void {
    ensureAutomationDir();
    const row = [issue.number, escapeCsv(issue.title), issue.url, issue.postedAt, startedAt, new Date().toISOString(), escapeCsv(reason)].join(',');
    fs.appendFileSync(resolveFromRoot(IGNORED_CSV), `${row}\n`);
}

export function writeHelpWantedResult(issue: IssueInfo, startedAt: string): void {
    ensureAutomationDir();
    const result = {
        watcherTitle: getWatcherTitle(issue.number),
        issue,
        startedAt,
        foundAt: new Date().toISOString(),
        status: 'help_wanted',
        needsProposal: true,
    };

    fs.writeFileSync(resolveFromRoot(`${RESULTS_DIR}/issue-${issue.number}.json`), `${JSON.stringify(result, null, 4)}\n`);
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export function createActiveWatcher(issue: IssueInfo): ActiveWatcher {
    return {
        ...issue,
        watcherTitle: getWatcherTitle(issue.number),
        startedAt: new Date().toISOString(),
        status: 'watching',
    };
}
