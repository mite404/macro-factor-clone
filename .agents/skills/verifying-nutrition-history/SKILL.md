---
name: verifying-nutrition-history
description: "Runs a bounded exhaustive check that logged diary nutrition, unknown nutrients,
  portions, imported brands and sources, saved barcodes, and the current targets survive food
  edits, archiving, corrections, deletes, target edits, reopen, migration, and backup restore,
  against the real foods/diary/goals/backup/lookup/storage code on real SQLite. Use when changing
  src/features/foods/foods.ts, src/features/diary/diary.ts, src/features/goals/goals.ts,
  src/features/backup/backup.ts, src/features/lookup/lookup.ts, or src/storage/, or when asked
  whether diary history stays stable."
---

# Verifying nutrition history

A bounded exhaustive check, not a proof. `scripts/check.ts` enumerates every op sequence the UI
can reach, up to a depth, from 22 ops and 2 start states. It drives the production functions
against Node's built-in SQLite through `src/storage/testDb.ts`. After every step it compares
`listEntries`, `searchFoods`, the archived food rows, and `loadTargets` with a hand-written spec
oracle, and a barcode lookup step compares `lookupBarcode` with it too. The oracle
states expected values. It does not reimplement app code. TypeScript has no verifier that runs on
this code, and the question is what the code does, not whether a design orders events safely. So
this checks real code with generated inputs, not a model.

## Run it

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .agents/skills/verifying-nutrition-history/scripts/check.ts
```

The default depth is 4: 44,956 sequences, about 135 s. Before moving the sync commit, also run
`--depth 5`: 609,320 sequences, about 37 min. Exit 0 prints `PASS`. Exit 1 prints
`FAIL <property>` with a shortest counterexample as numbered steps and the expected and actual
rows.

To prove the check can still fail, run `scripts/mutants.ts` the same way. It needs a clean `src/`.
It applies 25 real breakages one at a time and restores each file. Every line must read
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
  nutrients, serving, basis, barcode leading zeros, and an import's brand and source. Edits keep
  the brand and source. A USDA import saves the record whose own GTIN matches, not the top one.
  An Open Food Facts import keeps a macro unknown when only another record in the reply lists it.
- **F2 archive-hides-only.** Archived foods never appear in search. Archiving changes nothing else.
- **F3 archived-food-kept.** An archived food stays stored as last saved, read with SQL, including
  through a backup round trip.
- **T1 targets-current.** `loadTargets` returns exactly the last-saved target set: blank fields
  have no target, a later save replaces the whole set, and reopening, migrating, and restoring a
  backup of the same data keep it. Saving targets never changes a diary entry (H1).
- **L1 saved-barcode-offline.** Looking up a saved, unarchived food's barcode in another GTIN
  length returns exactly the matching saved foods with no key read and no request. This covers
  both a USDA and an Open Food Facts import. Archived or edited-away barcodes fall through to the
  key check, which reports a missing key and then asks only Open Food Facts.
- **B1 failed-restore-changes-nothing.** A backup whose entry refers to a missing food is rejected
  before any write. A valid restore whose middle insert fails, after its delete, throws that
  failure and rolls back, so every stored row, targets included, is unchanged.
- **X0 no-error.** No op throws. This covers `migrate` on reopen and on a ticket-01 database.

## Bounds and assumptions

- Ops: save Oats or Juice, import Kar's nut mix from a USDA reply that ranks a decoy first,
  import Nutella through `lookupBarcode` with no key from an Open Food Facts reply whose protein
  comes from another record, look up both barcodes with no key and only Open Food Facts reachable, edit food 0 to Bar or Oat milk (g → ml), edit food 1 to
  Rice (ml → g),
  archive either food, five logs (g, ml, and serving, including rejected ones), correct the first
  entry, delete the first entry, set targets (2000 kcal and 100 g protein), edit targets
  (calories blank, protein 120 g, fat 62,5 g), close/reopen/migrate, `restore` (export,
  `JSON.stringify`, `parseBackup`, `restoreBackup` into a new database file, then use it), and
  `failedRestores`.
  Ops that the UI cannot reach are pruned, such as logging an archived food. `check.ts` keeps the
  op table, form values, and the hand-written USDA reply. Barcodes are valid GTINs with leading
  zeros, because the food form now checks check digits.
- Start states: an empty database, and a ticket-01 (`user_version = 1`) database holding one
  quick-add entry with unknown protein and fat.
- One calendar day. One actor, one write at a time. Numbers compare within 1e-9 relative.
- Logs pick the food from `searchFoods(db, '')` as `Diary.tsx` does. Corrections go through
  `parseEntryForm` and then `updateEntry`, as `Diary.tsx` does. Targets go through `parseTargets`
  and then `saveTargets`, as `Diary.tsx` does. Imports go through `parseGtin`,
  `parseUsdaSearch`, and `insertFood(db, food, food)`, as `Diary.tsx` saves a reviewed record.
  Restores go through `parseBackup` and `restoreBackup`, as `BackupSettings.tsx` does.

## Not covered

- The UI layer. That means `Diary.tsx`, `LoggingScreens.tsx`, `TargetsForm.tsx`,
  `BackupSettings.tsx`, `BarcodeScreens.tsx`, and `UsdaKey.tsx`, their form round trips, the
  restore confirmation, the USDA review, and stale component state.
- The provider network paths: `searchUsda` and `searchOff` requests, headers, status codes,
  timeout, the old Open Food Facts schema, the explicit `lookupOff` retry, and the other reply
  shapes. `src/features/lookup/lookup.test.ts` covers those with recorded replies. SecureStore and the key
  itself are not driven.
- `compareTargets`, the over, left, and incomplete wording. `src/features/goals/goals.test.ts`
  covers it, and the Storybook stories render it.
- expo-sqlite, expo-file-system, expo-document-picker, and expo-sharing on iOS. Node's SQLite stands
  in for SQLite here, and no file leaves the process.
- `dayTotals`, `addDays`, `localDay`, multiple days, timezones, search queries other than `''`,
  other quantities and values, and concurrency.
- Restoring a backup from other data than the database's own, including version 1 files and the
  removal of existing targets by a restore, and the other rejection reasons (size, JSON, format,
  version, values, duplicate ids and targets). `src/features/backup/backup.test.ts`
  covers those.

## Coverage record

Sync commit: `e54d5ba3e4289d7c4e12150b617775b4484f5623`. Tools: Node v26.12.1 with built-in
`node:sqlite` (SQLite 3.54.0), running `.ts` files by type stripping. The repo requires
Node ≥ 22.18.

| Check            | Covered code                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| H1, H3           | `foods.ts` `logPortion`, `updateFood`, `archiveFood`; `diary.ts` `insertEntry`, `updateEntry`, `deleteEntry`, `listEntries` |
| H2               | `foods.ts` `scale`, `parseFoodForm`; `diary.ts` `parseAmount`, `parseNutrition`, `parseEntryForm`, `insertEntry`, `listEntries` |
| H4               | `foods.ts` `logPortion`                                                   |
| F1, F2           | `foods.ts` `parseFoodForm`, `values`, `insertFood`, `updateFood`, `searchFoods`, `toFood`, `archiveFood`; `lookup.ts` `parseUsdaSearch`, `parseOffProduct` |
| L1               | `foods.ts` `parseGtin`, `findFoodsByBarcode`; `lookup.ts` `lookupBarcode` local path and no-key Open Food Facts fallback |
| X0, start states | `storage/migrations.ts` `migrations`, `migrate`; `storage/testDb.ts`      |
| H1-H3, F1, F3    | `backup.ts` `exportBackup`, `parseBackup`, `restoreBackup` (via `restore`), brand included |
| T1               | `goals.ts` `parseTargets`, `saveTargets`, `loadTargets`; `backup.ts` targets export and restore |
| B1               | `backup.ts` `parseBackup` dangling-reference check, `restoreBackup` rollback |

## When code changes

1. Find out whether a change touches covered code:

   ```sh
   git diff --stat e54d5ba3e4289d7c4e12150b617775b4484f5623 -- \
     src/features/foods/foods.ts src/features/diary/diary.ts src/features/goals/goals.ts \
     src/features/backup/backup.ts src/features/lookup/lookup.ts src/storage/
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
