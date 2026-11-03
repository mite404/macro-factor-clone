# 09: Copy diary entries to another day

Depends on: 01, 08. Covers R1, R7, R9, R10. Review boundary: repeat a meal without rebuilding it.

## Outcome

Select entries from a previous day, choose a destination day, and copy them once.

## Implementation

Extend `src/features/diary/` with entry selection and a copy action. Copy nutrition snapshots and
quantities into fresh entries in one transaction, preserving the original date and entries. Do not
recalculate from current food or recipe definitions. Support copying within the same day as an
explicit action. Prevent a second submit while the first transaction is running, then return to a
visible result so repeat copies are deliberate. No named meal library or recurring scheduling in
this ticket.

## Acceptance checks

- Copy two entries totaling 580 kcal to a day already containing 120 kcal: the result is 700 kcal.
- The source day is unchanged; new entries have distinct IDs and the chosen destination date.
- An edited food or recipe does not change the copied snapshot's values.
- Cancel selection: no rows added. Rapid repeated taps produce only one batch.
- A failed batch inserts no partial meal. Unknown nutrients stay unknown.

## Mobile lesson and limits

Use visible selection controls and an explicit action button, not long-press-only discovery. Run
shared verification, inspect selected and empty states, and record the tap/copy interaction.
