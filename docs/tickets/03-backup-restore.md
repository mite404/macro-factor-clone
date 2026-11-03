# 03: Export and restore personal data

Depends on: 01, 02. Covers R3, R9, R10. Review boundary: recover a complete diary and food library.

## Outcome

Export a versioned JSON backup through the iOS share sheet and import it from Files with
confirmation.

## Implementation

Add `src/features/backup/`, a settings entry point, and Expo-compatible file/share/document tools.
Export all persisted user records, identifiers, explicit dates, units, and unknown values. Document
a versioned format that later tickets must extend alongside new persisted data. Keep an early-format
fixture. Later readers migrate older backups, supplying empty/default values for collections that
did not exist yet; they must not silently reject this first backup format. Restore is replace-all,
not merge: show a record-count summary and explicit warning first. Validate the entire file before
writing, then restore within one SQLite transaction. Reject future versions, invalid references,
duplicate IDs, invalid values, and oversized inputs with a clear error. Do not export credentials or
present exports as encrypted. Avoid logging personal data.

## Acceptance checks

- Export two dates and a saved food, restore into an empty database, and compare all records.
- Cancel sharing or importing: no data changes. Cancel replacement: existing data remains.
- Malformed JSON, an unknown future version, and a dangling food reference leave data unchanged.
- A simulated database failure halfway through replacement rolls back all changes.
- Use real iOS Files and share-sheet behavior before claiming native restore works.

## Mobile lesson and limits

App storage belongs to the app sandbox. Uninstalling an app is not equivalent to clearing a web
page's component state: personal data may be lost. Backups are user-selected files, not cloud sync.
Run shared verification. Do not add encryption or automatic upload without a separate decision.
