#!/usr/bin/env node
// scripts/verify-gate-schedule.mjs
//
// PRD R-20 / embertide-z40.4 — calendar-triggered gate-flip accountability.
//
// The Elysian Cathedral overhaul has several CI gates that flip from
// warn-only to blocking on a calendar basis (e.g., `perf:motion` 14 days
// after V-7c merge per A-18′, stylelint `app.css` exemption drop at V-5a+14d,
// coverage ratchet at V-10, etc.). Without automation these flips slip.
//
// Manifest: `.claude/prd-build-artifacts/gate-schedule.json`
//   [
//     {
//       "gate": "perf:motion",
//       "trigger": "V-7c+14d (A-18′)",
//       "flipDate": "2026-05-15",  // ISO YYYY-MM-DD, or null if not yet known
//       "status": "pending" | "active" | "blocking",
//       "notes": "optional human explanation"
//     },
//     ...
//   ]
//
// Rule: if a gate's `flipDate` is on or before today AND `status` is not
// `"blocking"`, this script exits 1. Otherwise exits 0. CI runs it every
// build so a missed flip fails the build the day it was due.
//
// Exit codes:
//   0 — all gates healthy (or all flipDates are null/future)
//   1 — one or more gates overdue for flip
//   2 — manifest missing or malformed (hard error)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MANIFEST = resolve(__dirname, '..', '.claude', 'prd-build-artifacts', 'gate-schedule.json');

function die(code, msg) {
  console.error(`[verify:gate-schedule] FAIL: ${msg}`);
  process.exit(code);
}

if (!existsSync(MANIFEST)) {
  die(
    2,
    `manifest not found at ${MANIFEST}. ` +
      `This file is the source of truth for scheduled CI-gate flips (PRD R-20).`,
  );
}

let entries;
try {
  entries = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (err) {
  die(2, `manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
}

if (!Array.isArray(entries)) {
  die(2, `manifest must be a JSON array, got ${typeof entries}`);
}

const VALID_STATUS = new Set(['pending', 'active', 'blocking']);
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const overdue = [];
const problems = [];

entries.forEach((entry, i) => {
  if (!entry || typeof entry !== 'object') {
    problems.push(`entry[${i}] is not an object`);
    return;
  }
  const { gate, trigger, flipDate, status } = entry;
  if (typeof gate !== 'string' || gate.length === 0) {
    problems.push(`entry[${i}].gate missing or not a string`);
    return;
  }
  if (typeof trigger !== 'string' || trigger.length === 0) {
    problems.push(`entry[${i}].trigger (${gate}) missing or not a string`);
    return;
  }
  if (!VALID_STATUS.has(status)) {
    problems.push(
      `entry[${i}].status (${gate}) must be one of pending|active|blocking, got ${JSON.stringify(status)}`,
    );
    return;
  }
  if (flipDate !== null && typeof flipDate !== 'string') {
    problems.push(`entry[${i}].flipDate (${gate}) must be null or an ISO date string`);
    return;
  }
  if (flipDate === null) {
    // Not scheduled yet — fine.
    return;
  }
  const parsed = new Date(flipDate);
  if (Number.isNaN(parsed.getTime())) {
    problems.push(`entry[${i}].flipDate (${gate}) is not a valid date: ${flipDate}`);
    return;
  }
  parsed.setUTCHours(0, 0, 0, 0);
  if (parsed <= today && status !== 'blocking') {
    overdue.push({ gate, trigger, flipDate, status });
  }
});

if (problems.length > 0) {
  die(
    2,
    `manifest has ${problems.length} structural problem(s):\n` +
      problems.map((p) => `  - ${p}`).join('\n'),
  );
}

if (overdue.length > 0) {
  const lines = overdue
    .map(
      (o) =>
        `  - ${o.gate}: flipDate=${o.flipDate} (trigger: ${o.trigger}) still status=${o.status}`,
    )
    .join('\n');
  die(
    1,
    `${overdue.length} gate(s) overdue for flip:\n${lines}\n` +
      `Flip each to status: "blocking" in ${MANIFEST}, or update its flipDate if the trigger slipped (with a PRD-referenced reason).`,
  );
}

console.log(`[verify:gate-schedule] OK — ${entries.length} gate(s) tracked; 0 overdue.`);
