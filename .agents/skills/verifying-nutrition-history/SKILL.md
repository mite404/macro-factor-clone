---
name: verifying-nutrition-history
description: "Runs a bounded exhaustive check that logged diary nutrition, unknown nutrients, and
  portions survive food edits, archiving, corrections, deletes, reopen, and migration, against the
  real foods/diary/storage code on real SQLite. Use when changing src/features/foods/foods.ts,
  src/features/diary/diary.ts, or src/storage/, or when asked whether diary history stays stable."
---

# Verifying nutrition history

A bounded exhaustive check, not a proof. `scripts/check.ts` enumerates every op sequence the UI
can reach, up to a depth, from 15 ops and 2 start states. It drives the production functions
against Node's built-in SQLite through `src/storage/testDb.ts`. After every step it compares
`listEntries` and `searchFoods` with a hand-written spec oracle. The oracle states expected
values. It does not reimplement app code. TypeScript has no verifier that runs on this code, and the
question is what the code does, not whether a design orders events safely. So this checks real
code with generated inputs, not a model.

## Run it

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .agents/skills/verifying-nutrition-history/scripts/check.ts
```

The default depth is 4: 3,448 sequences, about 5 s. Before moving the sync commit, also run
`--depth 5`: 31,436 sequences, about 50 s. Exit 0 prints `PASS`. Exit 1 prints `FAIL <property>`
with a shortest counterexample as numbered steps and the expected and actual rows.

To prove the check can still fail, run `scripts/mutants.ts` the same way. It needs a clean `src/`.
It applies 10 real breakages one at a time and restores each file. Every line must read
`CAUGHT`. It then confirms the baseline passes and `src/` is clean.

## Properties

The harm in every case is a diary that silently changes or misreports what the owner ate.

- **H1 history-snapshot.** A logged entry keeps its label and nutrition until the owner corrects or
  deletes it. Food edits, archiving, other entries, reopening, and migration never change it.
- **H2 unknown-stays-unknown.** An unknown nutrient (`null`) stays unknown through logging,
  storage, correction, and reopen. A known 0 stays 0.
- **H3 portion-unit-and-day.** An entry keeps its day and its portion: food id, measured amount
  (servings × serving amount), and the food's basis unit at log time.
- **H4 unit-rejection.** `logPortion` rejects grams of a per-100 ml food, millilitres of a per-100 g
  food, and servings of a food without one. It accepts everything else.
- **F1 food-record-fidelity.** `searchFoods` returns exactly the last-saved food, including `null`
  nutrients, serving, basis, and barcode leading zeros.
- **F2 archive-hides-only.** Archived foods never appear in search. Archiving changes nothing else.
- **X0 no-error.** No op throws. This covers `migrate` on reopen and on a ticket-01 database.

## Bounds and assumptions

- Ops: save Oats or Juice, edit food 0 to Bar or Oat milk (g → ml), edit food 1 to Rice (ml → g),
  archive either food, five logs (g, ml, and serving, including rejected ones), correct the first
  entry, delete the first entry, and close/reopen/migrate. Ops that the UI cannot reach are pruned,
  such as logging an archived food. `check.ts` keeps the op table and form values.
- Start states: an empty database, and a ticket-01 (`user_version = 1`) database holding one
  quick-add entry with unknown protein and fat.
- One calendar day. One actor, one write at a time. Numbers compare within 1e-9 relative.
- Logs pick the food from `searchFoods(db, '')` as `FoodPanel` does. Corrections go through
  `parseEntryForm` and then `updateEntry`, as `DiaryScreen` does.

## Not covered

- The UI layer. That means `FoodPanel.tsx` and `DiaryScreen.tsx`, their `formOf`/`toText` form
  round trips, and stale component state.
- expo-sqlite on iOS. Node's SQLite stands in for it here.
- `dayTotals`, `addDays`, `localDay`, multiple days, timezones, search queries other than `''`,
  other quantities and values, concurrency, and backups (ticket 03 had not landed at sync).

## Coverage record

Sync commit: `d12662dcd5b44529982e12009d5b3a57133573da`. Tools: Node v26.12.1 with built-in
`node:sqlite` (SQLite 3.54.0), running `.ts` files by type stripping. The repo requires
Node ≥ 22.18.

| Check            | Covered code                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| H1, H3           | `foods.ts` `logPortion`, `updateFood`, `archiveFood`; `diary.ts` `insertEntry`, `updateEntry`, `deleteEntry`, `listEntries` |
| H2               | `foods.ts` `scale`, `parseFoodForm`; `diary.ts` `parseAmount`, `parseNutrition`, `parseEntryForm`, `insertEntry`, `listEntries` |
| H4               | `foods.ts` `logPortion`                                                   |
| F1, F2           | `foods.ts` `parseFoodForm`, `values`, `insertFood`, `updateFood`, `searchFoods`, `archiveFood` |
| X0, start states | `storage/migrations.ts` `migrations`, `migrate`; `storage/testDb.ts`      |

## When code changes

1. Find out whether a change touches covered code:

   ```sh
   git diff --stat d12662dcd5b44529982e12009d5b3a57133573da -- \
     src/features/foods/foods.ts src/features/diary/diary.ts src/storage/
   ```

2. Run the check. On `FAIL`, read the counterexample steps. If the change was not meant to alter
   that behavior, it is a product bug. Report it and leave the property as it is.
3. If the change intentionally alters a promise, update the oracle in `check.ts` and the property
   text here in the same PR. A new nutrient column, persisted field, migration, or user action
   (backup restore, recipes, copy entries) also needs new ops or template fields. The check cannot
   see what it does not drive.
4. If `mutants.ts` prints `STALE`, the target text moved. Retarget the same breakage, and do not
   delete the mutant.
5. Move the sync commit and the tool versions forward only after `--depth 5` and `mutants.ts` pass
   and you have confirmed the table above still names the right functions.
