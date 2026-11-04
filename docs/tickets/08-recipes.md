# 08: Log portions of a weighed recipe

Depends on: 02, 03. Covers R6, R9, R10. Review boundary: turn ingredients into a reusable meal.

## Outcome

Choose saved ingredients and amounts, enter finished edible weight, and log a weighed portion.

## Implementation

Add `src/features/recipes/`, recipe persistence, composition UI, and a diary logging action.
Snapshot each ingredient's nutrient basis and amount into the recipe. Require a positive finished
weight in grams; ingredients must be in grams or have a known gram serving. Do not guess density.
Sum ingredient nutrients, divide by finished weight, and scale to the logged grams. Unknown
ingredient nutrients make that recipe nutrient incomplete. Recipe edits affect future logs only.
Extend backup/restore for recipe definitions and ingredient snapshots. Do not add nested recipes.

## Acceptance checks

- Ingredients total 900 kcal and 60 g protein; finished weight is 600 g. A 150 g portion yields 225
  kcal and 15 g protein, regardless of the raw ingredient weight.
- Zero finished weight is rejected; a missing ingredient protein value makes protein incomplete.
- Editing a saved ingredient does not silently alter an existing recipe snapshot.
- Editing the recipe does not change a previously logged portion.
- Export/restore retains ingredients, units, yield, and historical diary totals.

## Mobile lesson and limits

A multi-step form must keep its draft while choosing ingredients and returning with the keyboard.
Yield corrects water-weight changes, not nutrient losses during cooking; state this limitation. Run
shared verification and inspect a recipe with enough ingredients to require scrolling.
