# 12: Verify diary history integrity

Depends on: 02. Covers R1, R2, R9. Review boundary: verification only, no product logic changes.

## Outcome

A cold agent can check, with one command, that logged nutrition stays as it was logged. That
includes unknown nutrients and measured portions, through every short sequence of food saves,
edits, archives, logs, corrections, deletes, reopens, and the ticket-01 migration.

## Implementation

Add the project-local skill `.agents/skills/verifying-nutrition-history/`. `scripts/check.ts`
enumerates every op sequence the UI can reach, up to a bound. It drives the production `foods.ts`,
`diary.ts`, and `migrate` against Node's built-in SQLite. After each step it compares the stored
rows with a hand-written spec oracle. TypeScript has no verifier that runs on this code, so these
are bounded exhaustive checks on real code, not a proof and not a hand model of the code.
`scripts/mutants.ts` proves each property can fail on a broken copy of the real code. Do not edit
UI, package files, workflows, or product logic.

## Acceptance checks

- The check passes on the current code at depths 4 and 5 and prints the bounds it ran.
- Each property fails on at least one deliberate breakage of real production lines. Examples: food
  edits recalculating history, archive deleting entries, unknown becoming 0, a lost portion, g/ml
  converting 1:1, a barcode losing leading zeros, archived foods in search, migrations rerunning.
- After the mutation run, `src/` matches the commit and the baseline passes again.
- `npm test` and `npm run typecheck` still pass.
- The skill states properties, bounds, exclusions, source mapping, tool versions, and a sync commit.

## Result

Verified at `d12662d` with Node v26.12.1 and SQLite 3.54.0. Depth 4 runs 3,448 sequences in about
5 s. Depth 5 runs 31,436 sequences in about 50 s. No counterexample was found. All 10 mutants were
caught with shortest counterexamples of 1 to 4 steps. Not covered: the UI form round trips, native
expo-sqlite, totals, multiple days, concurrency, and backups. The skill has the full list.
