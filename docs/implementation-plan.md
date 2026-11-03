---
title: Personal iOS nutrition tracker
date: 2026-10-31
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Ten PRs after scaffolding

## Goal Capsule

Build a personal food logger while learning iOS builds and mobile-first interface design. Use React
Native with Expo, as requested. The target is the owner's iPhone 12 Pro, built on their MacBook Pro
M4 Pro. These are ten reviewable increments, not a promise of MacroFactor parity.

Each ticket gets its own Claude Code thread with Opus 5.5 and medium effort. The coordinating thread
integrates verified prerequisites before starting the next ticket. Stop for destructive changes,
paid services, or unavailable model access. Missing hardware blocks native acceptance, not
integration of code-verified prerequisites, unless a device-dependent fact blocks the design. An orb
can verify portable logic and a web preview; it cannot certify native iOS behavior.

## Product Contract

### Problem frame

The owner wants to practice building a mobile app they can use personally. Avoiding subscriptions
matters, but a free existing food logger would not meet the learning goal.

### Requirements

- R1. Record, correct, and remove calorie and macro entries for a chosen calendar day offline.
- R2. Reuse saved foods with explicit portions, without repeating external lookups.
- R3. Export and restore all user-created data without silently losing existing records.
- R4. Set calorie and macro targets manually and compare them with logged intake.
- R5. Find packaged foods by barcode and inspect nutrition before saving or logging.
- R6. Save recipes with measured finished weight and log a weighed portion.
- R7. Copy selected diary entries to another day without changing the original entries.
- R8. Record weight and see measurements alongside a clearly labeled descriptive trend.
- R9. Keep historical nutrition stable when foods, recipes, or provider records change.
- R10. Use accessible mobile controls and document actual native verification separately.

The user chose personal use rather than public distribution. No accounts, backend, payments,
analytics SDK, or App Store release is required. Mobile-first means safe areas, readable type,
keyboard-aware forms, explicit permissions, and usable touch targets, not a shrunken website.

### Deliberate first-release limits

Manual goals, not adaptive coaching. No HealthKit, AI meal estimates, label OCR, cloud sync,
workouts, watch companion, or Android-specific polish in these ten tickets. No claim that React
Native must eventually be replaced by Swift. Add native modules only when a feature needs them.
Recipes use mass, not guessed cup-to-gram conversions. CSV export and favorites can follow later;
full-fidelity JSON backup and repeat logging come first.

## Planning Contract

- KTD1. React Native + Expo + TypeScript (session-settled: user-directed). Reuse React knowledge
  while learning native builds. Start from the official blank TypeScript template, not a web shell.
- KTD2. SQLite owns personal data; no network is required to log saved foods. This is a proposed
  implementation default. Database migrations and backups become necessary once data persists.
- KTD3. Diary entries contain nutrition snapshots, not live references used to recalculate history.
  Store an explicit calendar date; timezone changes must not move previously logged meals.
- KTD4. Barcode lookup checks local foods, USDA, then Open Food Facts. A GTIN identifies a product
  across providers; USDA's `fdcId` identifies a USDA record. Preserve source and retrieval date.
- KTD5. The owner supplies their own USDA key, stored in the device Keychain through SecureStore. Do
  not commit, log, export, or ship a shared key. No proxy server for this one-user app.
- KTD6. Native iOS evidence is a separate acceptance gate. Browser previews are useful for layout
  and portable behavior, but do not prove SQLite, camera, signing, or native lifecycle behavior.

See [the ADR](adr/adr.md) for the mobile-vs-web explanations and
[the research](nutrition-app-research.md) for source citations and unresolved data coverage.

### Data and file ownership

`index.ts` registers the app. `src/App.tsx` composes screens. Add `src/features/<feature>/` only
when a ticket introduces that feature. `src/storage/` owns SQLite opening and schema migrations.
Keep pure portion and nutrient calculations next to the feature that uses them. Do not create
repositories, service containers, global state libraries, or empty folders for anticipated work.

The diary stores dates and snapshots. Saved foods store nutrient bases, serving weights, provenance,
and optional barcodes. Provider responses are validated at the network boundary, not trusted as
application types. Unknown nutrient values remain unknown, not zero. Daily totals must show when
they are incomplete. Published calories are not overwritten with a 4/4/9 macro calculation.

Backup files include a version and every persisted user-data collection. Each later ticket that adds
persisted data extends export, validation, and restore in the same PR. Restore rejects future
formats and validates the complete file before replacing data in one transaction. Earlier backups
remain readable throughout these ten tickets: migrate absent later collections to empty/default
values. Keep an early-format fixture and test it whenever persistence changes.

### Sequencing

Run 01 through 10 serially. Some features are logically independent, but all initially share app
composition, migrations, and the backup contract. Serial integration avoids competing schema
versions and stale starting points. Each PR must run without future tickets.

The user chose `https://github.com/mite404/macro-factor-clone.git` as the new default remote. Each
ticket remains an atomic review boundary; a ticket or thread is not a published pull request.
Transfer local changes explicitly between orbs; a thread message or commit SHA does not transfer
files. Publishing work requires a push instruction, separate from changing the remote URL.

## Implementation Units

| Unit | Ticket                                                     | Feature dependencies |
| ---- | ---------------------------------------------------------- | -------------------- |
| U1   | [01: Quick-add diary](tickets/01-quick-add-diary.md)       | Scaffold             |
| U2   | [02: Saved foods and portions](tickets/02-saved-foods.md)  | U1                   |
| U3   | [03: Backup and restore](tickets/03-backup-restore.md)     | U1, U2               |
| U4   | [04: Manual targets](tickets/04-manual-targets.md)         | U1, U3               |
| U5   | [05: USDA barcode lookup](tickets/05-usda-lookup.md)       | U2, U3               |
| U6   | [06: Open Food Facts fallback](tickets/06-off-fallback.md) | U5                   |
| U7   | [07: Camera scanning](tickets/07-barcode-camera.md)        | U6                   |
| U8   | [08: Weighed recipes](tickets/08-recipes.md)               | U2, U3               |
| U9   | [09: Copy diary entries](tickets/09-copy-entries.md)       | U1, U8               |
| U10  | [10: Weight history](tickets/10-weight-history.md)         | U3                   |

Ticket bodies own each unit's files, approach, acceptance examples, and stop conditions.

## Verification Contract

- Scaffold: `npm run typecheck`, `npx expo-doctor`, and `npm run export:ios` must succeed.
- Feature tickets: add `npm test` in U1 using a small behavioral test setup compatible with the
  installed Expo version. Prefer Node's test runner for portable calculations; exercise persistence
  against a real SQLite implementation rather than a mock that returns expected rows.
- Each ticket adds the smallest test that catches a plausible mistake in its contract. Establish a
  failing test before implementing non-trivial calculations or persistence behavior.
- Run the existing suite, typecheck, and iOS bundle export on every integrated ticket.
- Inspect rendered empty, populated, validation, and relevant offline states. Check large text,
  VoiceOver labels, keyboard access, and iPhone-width layout. Record interaction changes.
- Follow [the iOS build guide](ios-builds.md) for device installation. Record OS/tool versions and
  results for native camera, SQLite reopen, airplane mode, app restart, and export/restore.
- Never turn unperformed Mac/iPhone checks into passed checks. A ticket may be code-verified with
  native acceptance pending; it is not proven ready for daily use until that acceptance passes.

## Definition of Done

Every unit delivers its named user action with its own acceptance checks, extends backups when
needed, and leaves the app runnable. Remove abandoned experiments. Preserve sources and licenses.
Record deviations and outstanding device checks with the ticket's implementation result.

The first release is useful when the owner can log a real day's food, repeat it offline, recover it
from an export on another installation, and inspect their weight history on the iPhone. USDA/OFF
coverage must be sampled against the owner's actual groceries before promising coverage.
