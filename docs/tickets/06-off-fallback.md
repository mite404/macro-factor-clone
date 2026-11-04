# 06: Fall back to Open Food Facts

Depends on: 05. Covers R2, R5, R9. Review boundary: broaden barcode coverage without hiding
failures.

## Outcome

An uncached barcode not found in USDA can resolve through Open Food Facts and become a saved food.

## Implementation

Add an Open Food Facts adapter beside USDA and extend the existing lookup flow, not a second UI. Use
the documented current API schema; research observed the v3.5 nutrition-schema change. Set an
identifying User-Agent and respect current provider rate limits. Request only needed fields.
Automatic fallback follows an exact not-found result. A missing USDA key can use OFF directly. USDA
outage or throttling is not not-found: explain it and offer an explicit OFF retry. Preserve source
attribution and retrieval time. Link applicable ODbL terms; do not download product images in this
ticket. Reuse the same portion validation and confirmation as USDA.

## Acceptance checks

- USDA exact miss plus OFF hit displays OFF attribution and saves a reusable local food.
- Both providers miss: offer custom food creation; neither invents nutrients.
- OFF unknown/missing macros remain unknown, not zero. An old-schema fixture is rejected clearly.
- A USDA timeout does not silently become a permanent not-found record.
- A saved OFF food works offline and survives backup/restore with its source intact.

## Mobile lesson and limits

Connectivity is intermittent. Keep manual and saved-food logging available during provider failure.
No automatic retry loop, fuzzy name matching, or merged nutrient values from conflicting records.
Run shared verification and test provider fixtures plus a live non-sensitive product response.
