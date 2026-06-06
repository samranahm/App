/**
 * Watches newly posted Expensify/App issues for the Help Wanted label.
 *
 * Flow:
 * 1. Detect new open issues (not PRs) we have not seen before.
 * 2. Watch each new issue for up to 15 minutes.
 * 3. If Help Wanted appears → report it (agent drafts proposal + Slack notify).
 * 4. If 15 minutes pass with no Help Wanted → log to ignored-issues.csv and stop watching.
 *
 * Run: npx ts-node scripts/watchExpensifyHelpWanted.ts
 */
import fs from 'fs';
import path from 'path';

const REPO = 'Expensify/App';
const HELP_WANTED_LABEL = 'Help Wanted';
const WATCH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ISSUES_TO_FETCH = 30;

const AUTOMATION_DIR = path.join(__dirname, '..', 'proposals', 'automation');
const STATE_FILE = path.join(AUTOMATION_DIR, 'watch-state.json');
const IGNORED_CSV = path.join(AUTOMATION_DIR, 'ignored-issues.csv');

type GitHubIssue = {
    number: number;
    title: string;
    html_url: string;
    created_at: string;
    labels: Array<{name: string}>;
    pull_request?: unknown;
};

type WatchingIssue = {
    number: number;
    title: string;
    url: string;
    postedAt: string;
    firstSeenAt: string;
};

type WatchState = {
    highestSeenIssueNumber: number;
    watching: WatchingIssue[];
    processed: number[];
    lastRunAt: string | null;
};

type WatcherResult = {
    helpWantedFound: WatchingIssue[];
    newlyWatching: WatchingIssue[];
    ignored: WatchingIssue[];
    stillWatching: WatchingIssue[];
    stillWatchingCount: number;
};

function readState(): WatchState {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw) as WatchState;
}

function writeState(state: WatchState): void {
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 4)}\n`);
}

function appendIgnoredRow(issue: WatchingIssue, reason: string): void {
    const row = [issue.number, escapeCsv(issue.title), issue.url, issue.postedAt, issue.firstSeenAt, new Date().toISOString(), escapeCsv(reason)].join(',');
    fs.appendFileSync(IGNORED_CSV, `${row}\n`);
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function hasHelpWanted(issue: GitHubIssue): boolean {
    return issue.labels.some((label) => label.name === HELP_WANTED_LABEL);
}

function isPullRequest(issue: GitHubIssue): boolean {
    return !!issue.pull_request;
}

async function fetchRecentIssues(): Promise<GitHubIssue[]> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'expensify-help-wanted-watcher',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${REPO}/issues?state=open&sort=created&direction=desc&per_page=${ISSUES_TO_FETCH}`;
    const response = await fetch(url, {headers});

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const issues = (await response.json()) as GitHubIssue[];
    return issues.filter((issue) => !isPullRequest(issue));
}

async function fetchIssue(number: number): Promise<GitHubIssue> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'expensify-help-wanted-watcher',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${REPO}/issues/${number}`;
    const response = await fetch(url, {headers});

    if (!response.ok) {
        throw new Error(`GitHub API error for issue #${number}: ${response.status}`);
    }

    return response.json() as Promise<GitHubIssue>;
}

export async function runWatcher(): Promise<WatcherResult> {
    const state = readState();
    const now = Date.now();
    const nowIso = new Date().toISOString();

    const recentIssues = await fetchRecentIssues();
    const helpWantedFound: WatchingIssue[] = [];
    const newlyWatching: WatchingIssue[] = [];
    const ignored: WatchingIssue[] = [];
    const stillWatching: WatchingIssue[] = [];

    const watchingNumbers = new Set(state.watching.map((issue) => issue.number));
    const processedNumbers = new Set(state.processed);

    const maxIssueNumber = Math.max(...recentIssues.map((issue) => issue.number), state.highestSeenIssueNumber);

    // First run: record the current highest issue number but do not watch old issues.
    if (state.highestSeenIssueNumber === 0) {
        state.highestSeenIssueNumber = maxIssueNumber;
        state.lastRunAt = nowIso;
        writeState(state);
        return {
            helpWantedFound: [],
            newlyWatching: [],
            ignored: [],
            stillWatching: [],
            stillWatchingCount: 0,
        };
    }

    // Step 1: Add new issues to the watch list (posted after our last highest seen number,
    // or very recent issues we may have missed between runs).
    for (const issue of recentIssues) {
        const ageMs = now - new Date(issue.created_at).getTime();
        const isNewByNumber = issue.number > state.highestSeenIssueNumber;
        const isRecent = ageMs <= WATCH_WINDOW_MS + 5 * 60 * 1000; // 20 min buffer

        if (!isNewByNumber && !isRecent) {
            continue;
        }

        if (watchingNumbers.has(issue.number) || processedNumbers.has(issue.number)) {
            continue;
        }

        const entry: WatchingIssue = {
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            postedAt: issue.created_at,
            firstSeenAt: nowIso,
        };

        state.watching.push(entry);
        watchingNumbers.add(issue.number);
        newlyWatching.push(entry);
    }

    if (maxIssueNumber > state.highestSeenIssueNumber) {
        state.highestSeenIssueNumber = maxIssueNumber;
    }

    // Step 2: Check each watched issue for Help Wanted or timeout.
    const remainingWatchList: WatchingIssue[] = [];

    for (const watched of state.watching) {
        const issue = await fetchIssue(watched.number);
        const elapsed = now - new Date(watched.firstSeenAt).getTime();

        if (hasHelpWanted(issue) && !processedNumbers.has(watched.number)) {
            helpWantedFound.push(watched);
            state.processed.push(watched.number);
            continue;
        }

        if (elapsed >= WATCH_WINDOW_MS) {
            appendIgnoredRow(watched, `No Help Wanted label within 15 minutes`);
            ignored.push(watched);
            continue;
        }

        remainingWatchList.push(watched);
        stillWatching.push(watched);
    }

    state.watching = remainingWatchList;
    state.lastRunAt = nowIso;
    writeState(state);

    return {
        helpWantedFound,
        newlyWatching,
        ignored,
        stillWatching,
        stillWatchingCount: stillWatching.length,
    };
}

async function main(): Promise<void> {
    const result = await runWatcher();

    console.log(JSON.stringify(result, null, 2));

    if (result.helpWantedFound.length > 0) {
        console.log('\n🎯 Help Wanted found — draft a proposal for:');
        for (const issue of result.helpWantedFound) {
            console.log(`  #${issue.number} ${issue.title}`);
            console.log(`  ${issue.url}`);
        }
    }

    if (result.ignored.length > 0) {
        console.log('\n⏭️  Ignored (no Help Wanted in 15 min):');
        for (const issue of result.ignored) {
            console.log(`  #${issue.number} ${issue.title}`);
        }
    }

    if (result.newlyWatching.length > 0) {
        console.log('\n👀 Now watching:');
        for (const issue of result.newlyWatching) {
            console.log(`  #${issue.number} ${issue.title}`);
        }
    }
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
}
