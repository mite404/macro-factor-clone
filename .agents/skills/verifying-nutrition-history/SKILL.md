---
name: verifying-nutrition-history
description: "Runs a bounded exhaustive check that logged diary nutrition, unknown nutrients, and
  portions survive food edits, archiving, corrections, deletes, reopen, migration, and backup
  restore, against the real foods/diary/backup/storage code on real SQLite. Use when changing
  src/features/foods/foods.ts, src/features/diary/diary.ts, src/features/backup/backup.ts, or
  src/storage/, or when asked whether diary history stays stable."
---

# Verifying nutrition history

A bounded exhaustive check, not a proof. `scripts/check.ts` enumerates every op sequence the UI
can reach, up to a depth, from 17 ops and 2 start states. It drives the production functions
against Node's built-in SQLite through `src/storage/testDb.ts`. After every step it compares
`listEntries`, `searchFoods`, and the archived food rows with a hand-written spec oracle. The oracle
states expected values. It does not reimplement app code. TypeScript has no verifier that runs on
this code, and the question is what the code does, not whether a design orders events safely. So
this checks real code with generated inputs, not a model.

## Run it

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .agents/skills/verifying-nutrition-history/scripts/check.ts
```

The default depth is 4: 8,196 sequences, about 22 s. Before moving the sync commit, also run
`--depth 5`: 85,388 sequences, about 4 min. Exit 0 prints `PASS`. Exit 1 prints `FAIL <property>`
with a shortest counterexample as numbered steps and the expected and actual rows.

To prove the check can still fail, run `scripts/mutants.ts` the same way. It needs a clean `src/`.
It applies 15 real breakages one at a time and restores each file. Every line must read
`CAUGHT`. It then confirms the baseline passes and `src/` is clean.

## Properties

The harm in every case is a diary that silently changes or misreports what the owner ate.

- **H1 history-snapshot.** A logged entry keeps its label and nutrition until the owner corrects or
  deletes it. Food edits, archiving, other entries, reopening, migration, and restoring a backup of
  the same data never change it.
- **H2 unknown-stays-unknown.** An unknown nutrient (`null`) stays unknown through logging,
  storage, correction, and reopen. A known 0 stays 0.
- **H3 portion-unit-and-day.** An entry keeps its day and its portion: food id, measured amount
  (servings × serving amount), and the food's basis unit at log time.
- **H4 unit-rejection.** `logPortion` rejects grams of a per-100 ml food, millilitres of a per-100 g
  food, and servings of a food without one. It accepts everything else.
- **F1 food-record-fidelity.** `searchFoods` returns exactly the last-saved food, including `null`
  nutrients, serving, basis, and barcode leading zeros.
- **F2 archive-hides-only.** Archived foods never appear in search. Archiving changes nothing else.
- **F3 archived-food-kept.** An archived food stays stored as last saved, read with SQL, including
  through a backup round trip.
- **B1 failed-restore-changes-nothing.** A backup whose entry refers to a missing food is rejected
  before any write. A valid restore whose middle insert fails, after its delete, throws that
  failure and rolls back, so every stored row is unchanged.
- **X0 no-error.** No op throws. This covers `migrate` on reopen and on a ticket-01 database.

## Bounds and assumptions

- Ops: save Oats or Juice, edit food 0 to Bar or Oat milk (g → ml), edit food 1 to Rice (ml → g),
  archive either food, five logs (g, ml, and serving, including rejected ones), correct the first
  entry, delete the first entry, close/reopen/migrate, `restore` (export, `JSON.stringify`,
  `parseBackup`, `restoreBackup` into a new database file, then use it), and `failedRestores`.
  Ops that the UI cannot reach are pruned, such as logging an archived food. `check.ts` keeps the
  op table and form values.
- Start states: an empty database, and a ticket-01 (`user_version = 1`) database holding one
  quick-add entry with unknown protein and fat.
- One calendar day. One actor, one write at a time. Numbers compare within 1e-9 relative.
- Logs pick the food from `searchFoods(db, '')` as `Diary.tsx` does. Corrections go through
  `parseEntryForm` and then `updateEntry`, as `Diary.tsx` does. Restores go through `parseBackup`
  and `restoreBackup`, as `BackupSettings.tsx` does.

## Not covered

- The UI layer. That means `Diary.tsx`, `LoggingScreens.tsx`, and `BackupSettings.tsx`, their
  `formOf`/`toText` form round trips, the restore confirmation, and stale component state.
- expo-sqlite, expo-file-system, expo-document-picker, and expo-sharing on iOS. Node's SQLite stands
  in for SQLite here, and no file leaves the process.
- `dayTotals`, `addDays`, `localDay`, multiple days, timezones, search queries other than `''`,
  other quantities and values, and concurrency.
- Restoring a backup from other data than the database's own, and the other rejection reasons
  (size, JSON, format, version, values, duplicate ids). `src/features/backup/backup.test.ts`
  covers those.

## Coverage record

Sync commit: `71236eb9491ea4dfdfa5f848e1b513d8c5957317`. Tools: Node v26.12.1 with built-in
`node:sqlite` (SQLite 3.54.0), running `.ts` files by type stripping. The repo requires
Node ≥ 22.18.

| Check            | Covered code                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| H1, H3           | `foods.ts` `logPortion`, `updateFood`, `archiveFood`; `diary.ts` `insertEntry`, `updateEntry`, `deleteEntry`, `listEntries` |
| H2               | `foods.ts` `scale`, `parseFoodForm`; `diary.ts` `parseAmount`, `parseNutrition`, `parseEntryForm`, `insertEntry`, `listEntries` |
| H4               | `foods.ts` `logPortion`                                                   |
| F1, F2           | `foods.ts` `parseFoodForm`, `values`, `insertFood`, `updateFood`, `searchFoods`, `archiveFood` |
| X0, start states | `storage/migrations.ts` `migrations`, `migrate`; `storage/testDb.ts`      |
| H1-H3, F1, F3    | `backup.ts` `exportBackup`, `parseBackup`, `restoreBackup` (via `restore`) |
| B1               | `backup.ts` `parseBackup` dangling-reference check, `restoreBackup` rollback |

## When code changes

1. Find out whether a change touches covered code:

   ```sh
   git diff --stat 71236eb9491ea4dfdfa5f848e1b513d8c5957317 -- \
     src/features/foods/foods.ts src/features/diary/diary.ts src/features/backup/backup.ts \
     src/storage/
   ```

2. Run the check. On `FAIL`, read the counterexample steps. If the change was not meant to alter
   that behavior, it is a product bug. Report it and leave the property as it is.
3. If the change intentionally alters a promise, update the oracle in `check.ts` and the property
   text here in the same PR. A new nutrient column, persisted field, migration, or user action
   (recipes, copy entries, a new backup collection) also needs new ops or template fields. The
   check cannot see what it does not drive.
4. If `mutants.ts` prints `STALE`, the target text moved. Retarget the same breakage, and do not
   delete the mutant.
5. Move the sync commit and the tool versions forward only after `--depth 5` and `mutants.ts` pass
   and you have confirmed the table above still names the right functions.
