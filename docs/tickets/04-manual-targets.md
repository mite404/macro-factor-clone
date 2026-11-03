# 04: Set manual daily targets

Depends on: 01, 03. Covers R4, R10. Review boundary: compare today's intake with chosen goals.

## Outcome

Set calorie, protein, carbohydrate, and fat targets, then see consumed and remaining amounts.

## Implementation

Add `src/features/goals/`, a small settings form, and diary progress presentation. Targets are
optional positive finite values; no automatic diet prescription or prefilled target. Calorie and
macro targets are independently entered; do not force a 4/4/9 match. Show over-target amounts
explicitly, not as zero remaining. Unknown intake must not look complete. One current target set
applies to diary comparisons; label it as current rather than implying a historical target archive.
Extend migrations and backup/restore for targets in this PR.

## Acceptance checks

- With no targets, show intake without dividing by zero or inventing a goal.
- A 2,000 kcal target and 2,150 kcal intake displays 150 kcal over.
- A 100 g protein target with incomplete protein intake is marked incomplete.
- Editing targets updates the comparison, not historical diary snapshots.
- Export/restore preserves targets; labels remain readable with larger system text.

## Mobile lesson and limits

Use text labels as well as progress color; mobile accessibility cannot depend on hover or color. Run
shared verification and inspect unset, below-target, and over-target states. No coaching.
