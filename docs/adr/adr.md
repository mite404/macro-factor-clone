# Architecture decisions and mobile lessons

Started October 31, 2026. This single file is intentional for a casual learning project. Accepted
means chosen for this project, not necessarily implemented. Proposed defaults can change before the
relevant ticket is implemented. Sources are in [the research](../nutrition-app-research.md).

## ADR-001: React Native with Expo

Accepted by the user's React Native scaffold request. Use TypeScript and the official Expo blank
template. SwiftUI would be a good Apple-only option, but the owner wants to reuse React knowledge
while learning native builds. Do not schedule a Swift rewrite at an arbitrary success milestone.

**Web difference:** React components render native views, not DOM elements. CSS, browser APIs,
hover, and web routing assumptions do not automatically transfer. Native Swift code can coexist with
React Native later without replacing the whole app.

## ADR-002: Local builds and personal installation

Accepted explicitly by the owner on October 31, 2026: build on the MacBook Pro M4 Pro and install on
the iPhone 12 Pro using free Apple Personal Team signing. The owner accepts re-signing after the
seven-day provisioning expiry. Do not require EAS cloud, paid Apple membership, or a macOS satellite
for this workflow. No public release planned.

**Web difference:** a JavaScript bundle alone is not an installable iOS app. Xcode compiles and
signs the native application. Debug builds usually use Metro; a Release build bundles JavaScript for
use away from the development machine. Expo Go is a host app, not our standalone app.

## ADR-003: Local SQLite, no application backend

Proposed default for tickets 01 onward. SQLite owns diary entries, foods, recipes, goals, and
weight. Direct food-provider requests retrieve public food data only. No login or cross-device sync.

**Web difference:** the installed app owns a persistent sandbox. Schema changes must migrate
existing data across upgrades. Uninstalling can destroy it. A successful local write is not a
backup, so export/restore arrives before the food-provider integrations.

## ADR-004: Explicit dates and historical nutrition snapshots

Proposed default for ticket 01. Diary entries preserve the values actually logged and their chosen
calendar date. Food and recipe edits change future logging, not the nutritional history.

**Web difference:** phones travel between timezones and lose connectivity. Recomputing a diary day
from UTC timestamps on every render can move yesterday's meal. This is a nutrition-domain rule made
more visible by mobile use, not a limitation unique to React Native.

## ADR-005: Device credentials and provider provenance

Proposed default for ticket 05. The owner supplies a personal USDA key stored through SecureStore.
Local saved-food lookup comes before external providers. Imported foods retain their source,
identifier, nutrient basis, and retrieval date. OFF records retain required attribution.

**Web difference:** values bundled into a mobile app are extractable, much like frontend web code.
Keychain storage helps protect an owner's credential at rest but cannot make a distributed shared
secret safe. We do not need a proxy because this app has one owner, not a pool of customer keys.

## ADR-006: Generated native projects and verification boundaries

Proposed default: Expo configuration and config plugins define native settings; generated `ios/` and
`android/` folders stay ignored. Generate locally when building. Reconsider if substantial
handwritten native code makes continuous native generation inconvenient.

**Web difference:** a native module or permission-description change requires a native rebuild.
JavaScript refresh is not enough. A successful web preview or Metro export does not prove camera
permissions, SQLite persistence, share sheets, VoiceOver, or iPhone signing. Keep those checks
explicitly pending until run on Apple's tools and hardware.
