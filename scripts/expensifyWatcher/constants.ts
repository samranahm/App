export const REPO = 'Expensify/App';
export const HELP_WANTED_LABEL = 'Help Wanted';
export const WATCH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
export const ISSUES_TO_FETCH = 30;

export const AUTOMATION_DIR = 'proposals/automation';
export const STATE_FILE = `${AUTOMATION_DIR}/watch-state.json`;
export const ACTIVE_WATCHERS_FILE = `${AUTOMATION_DIR}/active-watchers.json`;
export const IGNORED_CSV = `${AUTOMATION_DIR}/ignored-issues.csv`;
export const RESULTS_DIR = `${AUTOMATION_DIR}/results`;

export function getWatcherTitle(issueNumber: number): string {
    return `Expensify Watcher #${issueNumber}`;
}
