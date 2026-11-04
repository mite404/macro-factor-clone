# Backup format

Settings → Backup exports every persisted user record to one JSON file and restores from one. The
code is in `src/features/backup/`. `backup.ts` owns the format, validation, and restore.
`files.ts` (iOS) and `files.web.ts` (browser) own picking, reading, and sharing files.

## Version 1

```json
{
  "format": "nutrition-diary-backup",
  "version": 1,
  "exportedAt": "2026-11-01T14:05:00.000Z",
  "foods": [{ "id": 1, "name": "Oats", "basis": "g", "calories": 379, "protein": 13.2,
    "carbs": null, "fat": 0, "servingName": "cup", "servingAmount": 40, "barcode": "0070",
    "sourceId": null, "sourceName": null, "retrievedOn": null, "archived": false }],
  "diaryEntries": [{ "id": 7, "day": "2026-10-31", "label": "Oats", "calories": 568.5,
    "protein": 19.8, "carbs": null, "fat": 0, "foodId": 1, "amount": 150, "unit": "g" }]
}
```

- Each collection mirrors one SQLite table, column for column, including row ids. Diary entries
  keep the food id they were logged from, so restored history points at the same foods.
- `null` means unknown and `0` means a known zero. Restore preserves both.
- `basis` and `unit` are `g` or `ml`. They never convert into each other.
- `day` is the calendar date the user logged, not a timestamp, so time zones cannot move it.
- Archived foods are included with `archived: true`. Provenance fields are included even while
  they are empty.
- `exportedAt` is informational. Restore shows it and does not store it.

The file holds personal data in plain text. It is not encrypted, and the app never uploads it.
Credentials, such as the owner's USDA key, live in the iOS Keychain through SecureStore, not SQLite.
Export reads only the tables in this document, so they cannot appear in a backup.

## Version 2

Version 2 adds `targets`, the one current set of daily targets. It mirrors the `targets` table.

```json
"targets": [{ "nutrient": "calories", "amount": 2000 }, { "nutrient": "protein", "amount": 100 }]
```

- `nutrient` is `calories`, `protein`, `carbs`, or `fat`, and appears at most once.
- `amount` is above 0, in kcal for calories and grams for the macros. A nutrient without a target
  has no record. There is no `0` or `null` target.
- Targets are not dated. Diary entries keep their own nutrition, so restoring or editing targets
  never changes logged history.

A version 1 file has no `targets` field and restores with no targets. A version 1 file that has
one is rejected as an unexpected field. `src/features/backup/backup-v2.json` is the version 2
fixture.

## Version 3

Version 3 adds `brand` to each food: the brand a provider reported, such as USDA's `brandName`, or
`null` for a food the owner created.

```json
{ "id": 5, "name": "NUT 'N BERRY MIX", "basis": "g", "calories": 500, "protein": 14.3,
  "carbs": 42.9, "fat": 32.1, "servingName": "1 ONZ", "servingAmount": 28,
  "barcode": "077034085228", "brand": "KAR'S", "sourceId": "fdc:2105222",
  "sourceName": "USDA FoodData Central", "retrievedOn": "2026-11-04", "archived": false }
```

- `brand` is a non-empty string or `null`. It sits apart from `name`, so editing a food's name
  keeps its brand, and edits never change `brand` or the source fields.
- A USDA import sets `sourceId` to `fdc:` and its FoodData Central id, `sourceName` to `USDA
  FoodData Central`, and `retrievedOn` to the day it was saved.

Version 1 and 2 files have no `brand` and restore with `brand: null`. A version 1 or 2 food that
has one is rejected as an unexpected field. `src/features/backup/backup-v3.json` is the version 3
fixture.

## Restore rules

Restore replaces all data. It does not merge. The app reads the whole file and validates it before
it shows a confirmation. It rejects the file with a reason and writes nothing when any of these
apply:

- The file is over 20 MB. The app checks the size before it reads the file.
- The file is not JSON, or `format` is not `nutrition-diary-backup`.
- `version` is newer than this app understands, or is not a positive integer.
- A field or collection is missing, a record has an unexpected field, or a value breaks the same
  rule as its SQLite `CHECK` constraint.
- An id appears twice in one collection, or a diary entry refers to a food that is not in the
  file.

The confirmation shows what the file holds and what will be deleted. Cancel changes nothing. Replace
deletes every table and inserts every record inside one SQLite transaction. If any write fails, the
transaction rolls back and the existing data stays.

## Extending the format

Each ticket that adds persisted user data changes the format in the same PR:

1. Add the new collection or field to the `Backup` types, export, validation, and restore, and
   increase `BACKUP_VERSION`.
2. Keep accepting every earlier version. A collection that did not exist yet becomes empty, and a
   new field gets its default, for example `version >= 2 ? raw.targets : []`. Never reject an
   older file because it lacks data that its version could not contain.
3. Keep `src/features/backup/backup-v1.json` unchanged. Its test must still restore it. Add a
   fixture for the new version beside it.
4. Extend the nutrition history check in `.agents/skills/verifying-nutrition-history/`.
