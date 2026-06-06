import {ISSUES_TO_FETCH, REPO} from './constants';

export type GitHubIssue = {
    number: number;
    title: string;
    html_url: string;
    created_at: string;
    labels: Array<{name: string}>;
    pull_request?: unknown;
};

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'expensify-help-wanted-watcher',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

export function isPullRequest(issue: GitHubIssue): boolean {
    return !!issue.pull_request;
}

export function hasHelpWanted(issue: GitHubIssue): boolean {
    return issue.labels.some((label) => label.name === 'Help Wanted');
}

export async function fetchRecentIssues(): Promise<GitHubIssue[]> {
    const url = `https://api.github.com/repos/${REPO}/issues?state=open&sort=created&direction=desc&per_page=${ISSUES_TO_FETCH}`;
    const response = await fetch(url, {headers: getHeaders()});

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const issues = (await response.json()) as GitHubIssue[];
    return issues.filter((issue) => !isPullRequest(issue));
}

export async function fetchIssue(number: number): Promise<GitHubIssue> {
    const url = `https://api.github.com/repos/${REPO}/issues/${number}`;
    const response = await fetch(url, {headers: getHeaders()});

    if (!response.ok) {
        throw new Error(`GitHub API error for issue #${number}: ${response.status}`);
    }

    return response.json() as Promise<GitHubIssue>;
}
