import fs from 'fs';
import path from 'path';
import {AUTOMATION_DIR} from './constants';
import type {IssueInfo} from './state';

const TRACKER_CSV = `${AUTOMATION_DIR}/issue-tracker.csv`;

const HEADERS = ['issue_number', 'issue_title', 'issue_url', 'posted_at', 'help_wanted_applied_at', 'is_proposal_posted', 'notes'] as const;

type TrackerRow = Record<(typeof HEADERS)[number], string>;

function resolveFromRoot(relativePath: string): string {
    return path.join(__dirname, '..', '..', relativePath);
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);
    return result;
}

function ensureTrackerFile(): void {
    const filePath = resolveFromRoot(TRACKER_CSV);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `${HEADERS.join(',')}\n`);
    }
}

function readRows(): TrackerRow[] {
    ensureTrackerFile();
    const filePath = resolveFromRoot(TRACKER_CSV);
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');

    if (lines.length <= 1) {
        return [];
    }

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row: TrackerRow = {
            issue_number: '',
            issue_title: '',
            issue_url: '',
            posted_at: '',
            help_wanted_applied_at: '',
            is_proposal_posted: '',
            notes: '',
        };

        HEADERS.forEach((header, index) => {
            row[header] = values[index] ?? '';
        });

        return row;
    });
}

function writeRows(rows: TrackerRow[]): void {
    ensureTrackerFile();
    const filePath = resolveFromRoot(TRACKER_CSV);
    const lines = [HEADERS.join(','), ...rows.map((row) => HEADERS.map((header) => escapeCsv(row[header])).join(','))];
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function findRowIndex(rows: TrackerRow[], issueNumber: number): number {
    return rows.findIndex((row) => row.issue_number === String(issueNumber));
}

export function addTrackerRowOnWatcherStart(issue: IssueInfo): void {
    const rows = readRows();

    if (findRowIndex(rows, issue.number) >= 0) {
        return;
    }

    rows.push({
        issue_number: String(issue.number),
        issue_title: issue.title,
        issue_url: issue.url,
        posted_at: issue.postedAt,
        help_wanted_applied_at: '',
        is_proposal_posted: 'no',
        notes: 'Watcher running',
    });

    writeRows(rows);
}

export function markHelpWantedApplied(issueNumber: number): void {
    const rows = readRows();
    const index = findRowIndex(rows, issueNumber);

    if (index < 0) {
        return;
    }

    rows[index].help_wanted_applied_at = new Date().toISOString();
    rows[index].notes = 'Help Wanted label applied — drafting proposal';
    writeRows(rows);
}

export function markProposalReady(issueNumber: number): void {
    const rows = readRows();
    const index = findRowIndex(rows, issueNumber);

    if (index < 0) {
        return;
    }

    rows[index].is_proposal_posted = 'yes';
    rows[index].notes = 'Proposal drafted — ready to review';
    writeRows(rows);
}

export function markClosedNoLabel(issueNumber: number): void {
    const rows = readRows();
    const index = findRowIndex(rows, issueNumber);

    if (index < 0) {
        return;
    }

    rows[index].is_proposal_posted = 'no';
    rows[index].notes = 'Label not applied in 15 minutes';
    writeRows(rows);
}
