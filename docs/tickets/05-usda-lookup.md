# 05: Look up a barcode with USDA

Depends on: 02, 03. Covers R2, R5, R9, R10. Review boundary: type a barcode and save its nutrition.

## Outcome

Enter a packaged-food barcode, inspect the match, and save it for subsequent offline use.

## Implementation

Add `src/features/lookup/` with a USDA adapter and a typed-barcode screen. Camera comes in 07. Check
saved foods first. Store GTINs as strings and normalize equivalent UPC/EAN representations without
dropping meaningful leading zeros. Validate barcode format/check digits at input. Use USDA search,
then require an exact normalized `gtinUpc` match rather than trusting search rank. Handle multiple
matching records explicitly; show name, brand, serving, nutrients, and provenance. Read current API
docs before parsing nutrient IDs, units, serving weights, or response errors. The owner enters their
own key into a SecureStore-backed setting. No shared key, EXPO_PUBLIC key, key in export, or key in
logs. No key still permits local foods and manual creation. Save only after confirmation. Keep
unknown nutrients unknown and validate provider data.

## Acceptance checks

- A saved barcode returns locally in airplane mode with no request.
- An unrelated top-ranked USDA result is never treated as an exact match.
- Known equivalent UPC/EAN forms find the same saved food; distinct codes do not collide.
- Timeout, 429, missing key, invalid nutrition, and not-found produce distinct recoverable states.
- Repeat a successful lookup after saving: use the local result; a food refresh does not edit
  history.
- Verify normalization/parser fixtures independently and perform one live lookup when a key is
  available.

## Mobile lesson and limits

A bundled mobile app cannot keep a shared API secret. SecureStore protects this owner's key at rest,
not against its owner. Do not add a server to solve a multi-user problem this app does not have. Run
shared verification; never paste the owner's key into a thread or a fixture.
