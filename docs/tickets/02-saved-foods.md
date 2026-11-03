# 02: Save foods and log portions

Depends on: 01. Covers R2, R9, R10. Review boundary: reuse a food without retyping its nutrition.

## Outcome

Create and edit a personal food, find it locally, and log a measured portion to the selected day.

## Implementation

Add `src/features/foods/` and extend the SQLite schema and diary entry flow. Represent a nutrient
basis explicitly: per 100 g or per 100 ml. A named serving needs a measured amount in that same
unit. Do not equate ml with g or convert cups without food-specific information. Store optional
barcode, source ID, source name, and retrieval date for later provider imports. Snapshot the
selected food's nutrients and portion into the diary entry. Store barcodes as strings. Search saved
names without network access. Keep edit-food and edit-diary semantics distinct.

## Acceptance checks

- A food with 123 kcal and 8 g protein per 100 g yields 184.5 kcal and 12 g protein at 150 g.
- Logging 150 ml of a per-100-ml drink works; requesting grams without conversion data is rejected.
- Edit the food to 140 kcal per 100 g. The previous diary entry remains 184.5 kcal.
- Unknown nutrients remain unknown. A serving with zero base amount is rejected.
- After restart in airplane mode, search and log the saved food without a provider lookup.

## Mobile lesson and limits

A local database is durable app state, unlike transient component state. Add only the migration
needed for these foods; do not introduce an ORM or sync engine. Run shared verification and inspect
the food form with the keyboard open. Archive or hide a food rather than deleting diary history.
