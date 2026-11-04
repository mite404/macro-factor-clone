# Nutrition app implementation and verification

This repository file is the authoritative delivery and verification record. Update it here, not in
the Amp artifact. The [implementation plan](implementation-plan.md) defines scope and acceptance;
this record distinguishes delivery, observed verification, worker reports, and untested scope.

Moved from revision 23 of the Amp artifact on November 4, 2026. The old artifact points to this
file, not a second maintained copy. Status is the last recorded state, not a live GitHub view.
Earlier reports are retained as history; their superseded statuses do not override newer sections.
Referenced screenshots, recordings, and logs remain in their original thread workspaces. Moving this
record does not add those files to Git or turn worker-reported checks into independent verification.

## Tickets 03–10 are authorized and underway

### Oracle review is required before each upcoming merge

The owner requires an independent oracle code review of each PR before merging, starting with
ticket 06. Address medium-and-higher findings, rerun affected verification, and have the oracle
check the corrections against the final head before merging. Summarize low/minor findings for the
owner and pause for their review before continuing when those findings exist. Do not silently
implement or dismiss them. This gate overrides the previous unattended merge flow. The ticket 06
worker has been informed; the coordinator arranges the review. Tickets 03–05 were already merged
before this requirement; no retrospective review is implied.

### Approved dark lookup flow

The owner explicitly approved making lookup → USDA review → saved-food detail one consistent dark
flow, with matching surfaces, buttons and spacing. This supersedes retaining FoodDetail's light
reference palette. The active ticket 05 worker received the correction. The shared detail screen
must apply it to local saved foods as well, not create a USDA-only variant. Unrelated settings and
target forms are outside this change. Verification must include normal and enlarged text, final
screen comparisons, and a recorded lookup-to-log interaction. Implemented and integrated with
ticket 05. The coordinator inspected the dark-flow and large-text captures and the pointer/keyboard
recording. Settings remains light and is outside the approved three-screen change.

### Design requirement for upcoming views

The owner rejected the backup view's visual fit with the other Storybook screens. Reusing shared
primitives alone is not sufficient. When a user story lacks a direct screen analogue, derive the new
view from existing Storybook compositions, examples in docs, and the MacroFactor product site. Match
their hierarchy, typography, spacing, surfaces and interaction patterns rather than inventing a
generic settings screen. Compare actual rendered states with those references before integration.

Use `emil-design-eng` and the requested `frontend-engineering` skill. The available coordinator
catalog has `frontend-design`, not `frontend-engineering`; that available counterpart was loaded
and the naming discrepancy must remain disclosed. This guidance was sent to the active ticket 04
worker and must be included in every subsequent feature brief. The owner said "next time"; no
retroactive backup redesign has been requested.

The owner authorized agents to ship tickets 03–10, using the previously agreed settings. Each ticket
gets its own Claude Code Opus 5.5 thread at medium effort. Tickets run serially because they share
app composition, migrations and the backup format. Each starts from the previous ticket's integrated
`main`; `orb-setup` is reserved for setup script changes. The coordinator owns integration and merge
order. Native build testing remains deferred until all eight tickets finish, then uses a separate
Amp medium thread with a Mac satellite.

Baseline is `main` at `882fe8f9ca063cc1588792c7fa37b3e790db41c9`. All four prior PRs are merged.
GitHub main run [41746640398][ci-baseline] passed all six jobs; the coordinator independently read
the results. There are no open prerequisite PRs and no prerequisite CI blocker.

| Ticket | Work | State |
| --- | --- | --- |
| 03 | JSON backup and restore | [PR #5][pr5], merged |
| 04 | Manual targets | [PR #6][pr6], merged |
| 05 | USDA lookup | [PR #7][pr7], merged |
| 06 | Open Food Facts fallback | [PR #8][pr8], merged by worker; oracle corrections pending |
| 07 | Camera scanning | Code-verified in this orb, uncommitted; native acceptance pending |
| 08 | Weighed recipes | Queued after 07 |
| 09 | Copy diary entries | Queued after 08 |
| 10 | Weight history | Queued after 09 |

Feature delivery is 4 of 8 merged, but ticket 06 has unresolved oracle findings and ticket 07 is
held. Last confirmed remote main is [4d2c9ca][main06]. No Mac satellite has been started.

## Ticket 07: camera scanning

[Implementation thread][t07-thread]. The owner started ticket 07 on November 4 while the ticket 06
oracle corrections were still off main. Those touch `lookup.ts`; this ticket does not.

The Barcode tab's ▥ button opens `expo-camera` 58.0.14 for EAN-13, EAN-8, UPC-A and UPC-E codes.
Permission is requested on that tap, never at startup. A ref lock accepts one detection per opening;
the scan closes the camera, fills the field, and runs the existing resolver. ▥ rescans explicitly.
Leaving the tab or a result unmounts the camera. Backgrounding relies on iOS suspending the capture
session; no app code handles it. Denial shows Allow camera or Open Settings, with typed entry kept.
`NSCameraUsageDescription` is set; the microphone description is omitted. No frames are stored.

Observed in this orb: typecheck, lint, 34 Node tests, iOS export, 39 Storybook stories, and the
depth-4 nutrition-history check passed. A Storybook `expo-camera` stand-in fires each code on every
render; removing the lock made `BarcodeScanOnceAndRescan` fail. The real web module rendered the
denied state in headless Chromium. Untested: a real camera, the iOS prompt, background/foreground,
VoiceOver, and the native build. The physical iPhone 12 Pro gate is pending.

## Ticket 06 oracle corrections are required after shipping

The coordinator confirmed with `gh pr view 8` and `git ls-remote origin refs/heads/main` that
[PR #8][pr8] merged at 04:18:17 UTC on November 4, with main at [4d2c9ca][main06]. The owner
directly told the worker to ship to main at 04:17:46 UTC. The coordinator's oracle gate arrived at
04:11:28 UTC, but the oracle findings arrived after the push. The later ship message did not
explicitly mention or waive oracle review. This timing is confirmed by reading the worker's full
thread, not inferred from its report. Do not describe ticket 06 as having passed pre-merge oracle
review. The worker reports all six original-head CI checks passed; follow-up main CI was pending.

The oracle reviewed the exact base `ea18b10543c89037fa4776eaa6ad8dc81162b518` to head `4d2c9ca` diff
in a scratch clone and requested changes. Receipt is subagent `TU-034rXtsRNRPHwXisI0djb4` in the
[coordinator thread][coordinator]. Corrections are follow-up work, not changes to an unmerged PR.

### Medium findings sent to the ticket worker for correction

1. `lookup.ts:124–132` ignores OFF nutrient modifiers. OFF can promote computed energy into `value`
   with `modifier: "~"` while keeping a manufacturer source. Qualified macros such as `<5` also
   become exact numbers. The oracle reproduced saving, logging and restoring approximate calories
   as exact nutrition on real SQLite. Reject unsupported qualified calories; keep qualified macros
   unknown. Do not reject an exact entered value just because a comparison `value_computed` exists.
2. `lookup.ts:40–44` mixes OFF net carbohydrates with USDA total carbohydrates in one diary field.
   A same-record OFF example with net 20, total 30 and fiber 10 imports 20. Prefer same-record total
   carbohydrate; if absent, either use valid same-record net plus fiber or leave it unknown. Never
   assume missing fiber is zero. The implementation worker must disclose the selected rule.
3. `lookup.ts:189–195` has no shared rate gate. An injected-fetch probe sent all 16 sequential
   requests without waiting, exceeding OFF's documented 15 product reads/minute/IP. Add a shared
   gate across all OFF entry paths and a recoverable cooldown, without queued automatic retries.

Primary evidence consulted by the oracle:

- [OFF aggregation code][off-aggregation], `Nutrition.pm` lines 469–489.
- [OFF carbohydrate definitions][off-carbs], `nutrients_v3_with_source.yaml` lines 70–88.
- [USDA nutrient documentation][usda-nutrients]
- [OFF rate limits][off-limits]

Both OFF source links use revision `d4e3cd400daa4adf791fd2f67fb9747f74731c77`.

### Low finding awaits the owner

`BarcodeScreens.tsx:163–165` says OFF lists no protein even when the app excluded supplied protein
because it came from a different nutrition record. Suggested wording is "No usable protein in the
selected nutrition record." Keep the conservative filtering. The worker was told not to change
this low item until the owner decides.

The worker is correcting the medium findings locally and must report back for re-review. No
correction push or merge was authorized in this handoff. Ticket 07 remains queued. The oracle ran
focused probes, not the full test suite, browser checks or native acceptance. Integration
verification remains pending; the worker's original test/media claims are not independent sign-off.

### The earlier manual review was not the independent oracle review

After the owner questioned the conflicting verdicts, the coordinator read the full ticket 06 thread.
The manual review inspected four source-file diffs and the 16-file diffstat, then reported no
actionable bugs. No independent reviewer invocation, upstream schema fetch, or targeted probe was
recorded in that review interval. Its response said it was still waiting for the coordinator's
oracle review. Both reviews covered the same head and base. The later oracle's primary-source
checks and targeted reproductions support the corrections; the reviewer label alone does not.

## Ticket 05 integrated with the dark-flow correction

The coordinator inspected PR #7 at `e8c5080b5c6018a817a9e3db96af822979fd5d78` and merged it without
rewriting history as `ea18b10543c89037fa4776eaa6ad8dc81162b518`. The main tree matches the verified
head and local source was clean. All six PR-head hosted checks passed. Post-merge CI run
[41765111794][ci05] passed all six reported jobs on the exact merge head.

After clean `npm ci`, independent lint, typecheck, `npm test` (28 passed, 0 failed), depth-4
nutrition history (34,862 sequences), iOS JavaScript export, Storybook build and browser checks all
passed. `npm run test:storybook` rendered 33 stories with all play assertions passing. The
coordinator inspected the dark lookup, review and saved/local detail screens, enlarged text and
the pointer/keyboard lookup-save-log-repeat recording.
Settings stays light outside the approved flow.
The FoodDetail footer band is resolved. Full logs are retained in
`.amp/in/artifacts/verification/ticket05-integration.log` in the coordinator workspace.

GTIN lookup validates check digits, compares equivalent forms and checks saved foods before keys or
requests. USDA matches require the record's exact normalized barcode. Missing macros remain unknown
and conflicting duplicate nutrients are rejected. Source, brand and retrieval date survive saving
and backup v3; v1/v2 fixtures are unchanged. The coordinator checked USDA's current branded food
documentation for the per-100 g/ml basis and missing-value semantics.

Worker-reported additional checks include depth 5 (459,338 sequences), all 23 mutants caught, and a
production lookup of Kar's record 2105222 using USDA's documented public DEMO_KEY, followed by local
reuse. These were not independently rerun by the coordinator. Native SecureStore, Dynamic Type,
VoiceOver, number pad, airplane mode, builds and real chooser cancellation remain untested. Existing
foods with invalid old barcodes still restore, but editing requires fixing or clearing that barcode.
Typed UPC-E expansion remains deferred to camera ticket 07.

## Ticket 04 integrated after large-text correction

The coordinator inspected head `1ddc70bea4013ac5774cff484d1675f48f968f2f` and merged PR #6
as `02be5d56449085c1485684d4abf5fa662a204d20`. The main tree matches the verified head; local source
was clean. All six exact-head hosted checks passed. Post-merge CI run
[41758357634][ci04] passed all six jobs, confirmed by the exact-head completion event.

Independent final commands passed: lint, typecheck, `npm test` (21 passed, 0 failed), the depth-4
history check (17,536 sequences), `export:ios`, `build-storybook`, and `test:storybook` (26 stories,
all play assertions passed). The large-text regression checks complete numbers and that the last
diary card can scroll above the search footer. The coordinator inspected corrected food-log
captures at normal and enlarged text, the scrolled last entry, Food Detail, the form and the
reference Nutrition card. The summary wraps instead of shrinking or truncating its values.
Normal-size captures retain four columns. Native Dynamic Type remains untested.

At that time, the worker reported the unrelated normal-size Food Detail footer band through
suggest_fix; no additional task was started for it there. Ticket 05 then became active with the same
design requirements. Its later resolution is recorded above.

### Earlier review, blocker now resolved

The following preserves the pre-correction status, not the current delivery state.

PR #6 head `b6b52811749c0617c16f3cc7eacc57024ea23047` remained open. All six hosted checks passed.
The coordinator inspected the source and supplied unset, under/incomplete, over, validation,
after-save, reference and large-text captures, plus the pointer/keyboard recording. Normal-size
screens followed the established food-log, Nutrition card and form design more closely.

Integration was held for unreadable quantities at 1.5× browser text. Calories showed `1…` instead of
1500, and carbs showed `≥1…` instead of ≥150. This was a readability failure, not native acceptance
evidence. The worker was asked to adapt layout without truncating quantities, retain
normal-size reference styling, add a regression check, and verify the form and scrolling. Ticket 05
remained queued until the correction was integrated.

Independent checks on that head passed: `npm test` (21/21), depth-4 nutrition history (17,536
sequences), lint, typecheck, iOS JavaScript export, Storybook build, and all 25 browser stories at
390 px. The managed Storybook service was restarted before this browser run. The worker reported
depth 5 at 206,492 sequences and 19 caught mutants; those were not independently rerun. No native
build, Dynamic Type, keyboard, VoiceOver or Files-picker acceptance was claimed.

The backup upgrade preserves the v1 fixture and restores v1 with no targets. Version 2 includes the
current target set. Target edits leave diary snapshots unchanged. No additional storage defect was
found in this inspection.

## Ticket 03 integrated after corrections

The coordinator re-inspected final head `2e9f26b48c49cda3ec7baaf401762273ce8c7224` and merged PR #5
without rewriting history. The merge tree is identical to that verified head, and the local checkout
was clean. All six hosted checks passed on the exact PR head. Post-merge CI run
[41753158766][ci03] passed all six jobs on main commit `9608f6436b04fd45d30e54a688cb80a4aa3adc2e`,
as reported by the exact-head GitHub completion event.

Independent final checks passed: `npm run lint`, `npm run typecheck`, `npm test` (13/13), the
nutrition-history checker (8,196 depth-4 sequences), `npm run export:ios`, and
`npm run build-storybook`. `npm run test:storybook` initially timed out on the existing dev server;
a managed service restart followed by the same command passed all 21 stories at 390 px, including
the in-flight restore navigation regression. Full logs remain in the coordinator's verification
artifacts. The coordinator inspected both corrected screenshots and the pointer recording.

Own-key validation now rejects the three inherited property names. Restore keeps Cancel, back, and
Replace disabled during the transaction and restores navigation after completion. The browser
regression asserts disabled semantics and unchanged navigation before releasing real SQLite writes.
The worker also reports depth 5 passing 85,388 sequences and all 15 mutants caught; these deeper
checks were not repeated by the coordinator on the correction head.

Native Files/share-sheet, actual file-chooser cancellation, signing and reinstall recovery remain
untested. Confirmation cancellation and in-flight navigation locking have browser coverage.
Ticket 04 then became active and had to preserve v1 backup restoration and these protections.

### Earlier findings, now resolved

The following preserves the pre-correction status, not the current delivery state.

PR #5 head `ad570c951b46255c94c8ae8a62990fd95b3e670f` had six green hosted jobs. The coordinator
inspected the source and final settings/confirmation screenshots and recording. Independent
`npm test` passed 13/13; the bounded history checker passed 8,196 depth-4 sequences. The UI clearly
warned about replacement and showed incoming and existing record counts.

Merge was held for two scoped corrections sent to the ticket owner. A direct production-parser probe
confirmed that extra JSON fields named `constructor`, `toString`, and `__proto__` were accepted
because schema membership used inherited keys. They had to be rejected by own-key checks. Source
inspection also found Cancel/back remained active while the asynchronous replacement transaction
ran, allowing a false cancellation message and navigation into competing diary writes. The worker
was asked to reproduce that race through the real App UI with delayed real SQLite, prevent
cancellation/navigation while restore is active, and add behavioral regression coverage.

The recording verifies confirmation cancellation, not real file-picker cancellation: its headless
chooser needed automation and a suppressed cancel event. Native Files/share-sheet and on-device
restore remain deferred. This limitation must remain in the ticket's verification report. Ticket 04
started after the corrected ticket 03 was integrated.

## Prerequisite delivery record

This section records the prerequisite integration state before tickets 03–10, not current main.

The owner explicitly requires `main` as the default and reserves `orb-setup` for orb setup scripts
only. The coordinator incorrectly treated `orb-setup` as the integration branch. Amp's project base
was changed to `main`, confirmed by the settings update response. The owner changed GitHub's default
to `main`; the coordinator verified it through the GitHub API. Both GitHub and Amp now target `main`
by default. After approving branch repair, the owner authorized merging prerequisites without
requiring green CI. The coordinator merged PR #3 (foundation), PR #1 (nutrition verification), and
PR #2 (UI) into `main` in that order. Each dependent PR was retargeted to `main` only after its
prerequisite landed. Merge commits preserve history; no force-pushes or branch deletions occurred.
GitHub read-back confirmed all three were merged. `origin/main` then became
`887b90808c275c5e526957caaec3bbf837138f92`, with a tree identical to UI head
`6f57dc25e973375f835f22b968f2fa99e6974b60`. The coordinator checkout fast-forwarded cleanly to that
main commit.

The owner separately authorized the UI correction push in its implementation thread. PR #2's final
head was `6f57dc25e973375f835f22b968f2fa99e6974b60`, now merged into main. Refreshed captures and
the pointer recording were inspected; the stale alert and clipped-source capture problems resolved.
The coordinator fast-forwarded locally to that published commit. Tests, typecheck, the depth-4
history check, iOS JS export and Storybook build exited 0 locally. The initial Storybook browser run
timed out. After restarting the already-running Storybook service,
`npm run test:storybook` on merged main exited 0: all 17 stories rendered at 390 px and all play
assertions passed. No source change was needed. This independently exercises six application flows
and eleven fixture-only design references, not native iOS.

CI shipped as [PR #4][pr4], head `890e72a461033518adee7e158e273d2c1a192c20`. The coordinator
inspected the workflow/tooling diff and hosted run logs, confirmed all six jobs passed, and merged
it into `main` as `882fe8f9ca063cc1588792c7fa37b3e790db41c9`. The post-merge main CI run also passed
all six jobs. Main included TypeScript 7.0.2, Oxlint and the browser/SQLite/history/export gates.
Native iOS remained pending.

The sections below preserve earlier reports and are superseded by the later status above where
branch defaults, publication state or verification results differ.

## Earlier delivery record (superseded)

At this stage, GitHub was the Amp project's primary repository and its base branch was `orb-setup`.
All three tickets used separate Claude Code Opus 5.5 threads at medium effort. Verification was
published in [PR #1][pr1]. The owner rejected the implementation approach in [PR #2][pr2]; it needed
correction despite passing behavioral tests. Both PRs remained unmerged. The CI branch was pushed on
the provisional UI base, but had no PR or hosted CI result yet.

### Ticket 11: local correction under verification

The owner wanted the original complete Storybook screen components moved into production, not the
old app restyled or reduced to a few shared primitives. The coordinator's first brief missed that
requirement.

The worker was to move the original FoodLog, FoodSearch, QuickAdd, FoodDetail and CreateFood
implementations and their component kit into production, replace fixture inputs and disabled
handlers with real data/actions, and remove superseded DiaryScreen/FoodPanel implementations.
Storybook had to import those same production exports.

Coordinator defaults preserved the original per-screen light/dark choices, retained deferred design
stories with explicit fixtures and the same component kit, omitted dead production tabs, and omitted
invented targets until ticket 04 supplied data. Simulated device/status/keypad chrome stayed out of
live native screens. The earlier uniform-dark suggestion was withdrawn. Additional pushes were held
pending corrected-publication approval. The later approved dark lookup flow supersedes this palette
decision for its three screens only.

#### Correction received, not yet signed off

The UI worker committed `6f57dc25e973375f835f22b968f2fa99e6974b60` locally on top of published
`8a0817359b747231ee1316ec3ef5e77c190bfd25`. No corrective push was authorized at that stage. The
coordinator downloaded the changed source into an inspection directory, compared the five screen
implementations with the archived originals, and inspected all six supplied images. The
coordinator's application checkout remained clean at the published provisional head.

The moved screens preserved the original component composition with real inputs and actions. The
source removed the old DiaryScreen/FoodPanel and used Diary for storage calls and view state. Six
App stories exercised live behavior; eleven separate design-reference stories used fixtures. The
reported 17 passing stories did not mean 17 implemented application flows.

The worker reported 8 tests, typecheck, iOS JS export, both Storybook builds/runs, depth-4 and
depth-5 history checks, and 10 caught mutants. These results had not yet been independently rerun
by the coordinator or on the combined CI tree. Native acceptance was pending.

Visual evidence needed correction before sign-off. The Quick Add comparison showed 250 kcal with
"Calories are required", while the inspected code cleared that error on field edit and its story
asserted that behavior. The original FoodSearch comparison was largely blank, and the FoodLog
reference was clipped. The coordinator requested fresh comparable captures and the corrected
interaction recording, not a speculative code change. The short macro-color marks were fixed
16-pixel accents in source, not calculated progress bars.

A Git bundle was requested so both coordinator and CI owner could transfer the exact unpublished
commit without a push. The CI owner was to merge it locally onto published
`9be7f262acda6a2eef967922dd1606b34462820c`, rerun combined gates and review lint overrides.
Publication remained held pending owner approval.

#### Evidence for the rejected iteration, not the correction

[Implementation thread][ui-thread]

Published branch `shared-storybook-ui`, head `8a0817359b747231ee1316ec3ef5e77c190bfd25`, included
ticket 12 as an ancestor. The coordinator compared every previous unpublished file with the
transferred archive, confirmed no later unique edits, reviewed the published replacements,
and fast-forwarded locally. Old reference sources remained in an ignored local backup.
`git status --porcelain` was empty: no tracked or untracked source changes remained stranded there.

The coordinator reran 8 tests, typecheck, the 3,448-sequence invariant check, iOS JS export,
Storybook build, and all 6 story play tests successfully. Real Metro quick-add validation, save, and
browser reload retained 240 kcal/17g protein with unknown carbs and fat.
Empty, validation, populated and portion screenshots were inspected.
The worker's final pointer recording was also inspected,
including a contact sheet: a 150g portion logged 184.5 kcal and remained unchanged after editing the
source food to 140 kcal/100g.

Storybook imported production App and used Expo's real wa-sqlite engine through an in-memory
test-only adapter. This avoided duplicate screens but did not test the production expo-sqlite
provider lifecycle. Native iOS remained pending. Cosmetic search-field focus styling was unchanged;
no functional blocker was found in that inspection.

### Ticket 12: nutrition invariant verification

[Implementation thread][history-thread]

Published branch `ticket-12-nutrition-invariants`, head `f5202e84917801ad09d01723c8103d4822a3d598`,
included the loadable skill and shared thread guidance. The coordinator fast-forwarded its local
branch to this prerequisite, preserving unrelated unpublished work. The published root guidance
matched the local file byte for byte, so that local change was reconciled.

The coordinator reran depth 5: 31,436 sequences passed across the fixed operation/input domain.
All 10 production-code mutants were caught; restoration then passed 3,448 depth-4 sequences with
clean production source. Checks covered snapshot history, unknown versus zero nutrients,
portions/units/day, unit rejection, food record fidelity, archive behavior, and migration/reopen.
No findings within these bounds. This is bounded real-code execution, not an unbounded proof, UI
acceptance, concurrency coverage, or native iOS evidence.

Published command:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  .agents/skills/verifying-nutrition-history/scripts/check.ts
```

### Ticket 13: TypeScript 7 and GitHub CI

[Implementation thread][ci-thread]

The worker reported five unpushed commits on `ci-native-typescript`, based on ticket 12. They added
TypeScript 7.0.2, pinned Oxlint 1.91.0, and CI jobs for lint, typecheck, SQLite tests, Metro iOS
export, and nutrition invariants. Typechecking explicitly included the verification scripts.
Clean-install checks passed: 8 tests, depth-4/depth-5 invariant checks, and all 10 mutants.
Deliberate hook, unused-variable, and verification-script type errors were rejected. These remained
worker-reported results; the coordinator had not rerun that combined tree.

The worker published `ci-native-typescript` at `9be7f262acda6a2eef967922dd1606b34462820c` before the
coordinator's hold message arrived. It contained the invariant gate and a static Storybook browser
job using pinned agent-browser 0.38.1, but had no PR. Feature-branch pushes did not trigger the
workflow. Local checks passed on the provisional UI, not the requested correction. The worker had to
preserve published history, integrate the corrected UI without force-pushing, and rerun combined
verification. Mutation checks remained a local sign-off step; expo-doctor warnings were disclosed
as non-blocking.

The project setting `AMP_DISABLE_AMP_COAUTHOR_TRAILER=1` was saved and read-back verified. Active
workers were told to refresh their orb environments at a safe checkpoint. The CI worker removed
agent coauthor trailers from its own unpushed commits without changing the tree. Already-published
ticket-12 commits contained Amp coauthor trailers and remained unchanged; rewriting published
history requires separate approval.

### Earlier delivery gates (superseded)

1. Move and connect the actual original screen components, verify the corrected app, then obtain
   approval to publish the correction. PR #2 was not accepted as complete at that stage.
2. Integrate the corrected UI into the CI branch, rerun combined checks, and publish its PR when
   authorized.
3. Resume feature tickets 03 through 10 in order, each in its own Opus 5.5 medium thread.
4. After those feature tickets finish, create the requested Amp medium Mac-satellite thread for
   native compilation and simulator testing. Physical iPhone signing and acceptance remain separate.

No merges are authorized by this record. No native build has been verified by these Linux checks.

[ci-baseline]: https://github.com/mite404/macro-factor-clone/actions/runs/41746640398
[ci03]: https://github.com/mite404/macro-factor-clone/actions/runs/41753158766
[ci04]: https://github.com/mite404/macro-factor-clone/actions/runs/41758357634
[ci05]: https://github.com/mite404/macro-factor-clone/actions/runs/41765111794
[pr1]: https://github.com/mite404/macro-factor-clone/pull/1
[pr2]: https://github.com/mite404/macro-factor-clone/pull/2
[pr4]: https://github.com/mite404/macro-factor-clone/pull/4
[pr5]: https://github.com/mite404/macro-factor-clone/pull/5
[pr6]: https://github.com/mite404/macro-factor-clone/pull/6
[pr7]: https://github.com/mite404/macro-factor-clone/pull/7
[pr8]: https://github.com/mite404/macro-factor-clone/pull/8
[main06]:
  https://github.com/mite404/macro-factor-clone/commit/4d2c9ca30594542a9161ee4668bbb1a262abd31f
[coordinator]: https://ampcode.com/threads/T-01a19290-a404-75d0-9b1c-735ad66c0b4e
[ui-thread]: https://ampcode.com/threads/T-f3543611-9f9b-44f2-8037-090845203361
[history-thread]: https://ampcode.com/threads/T-01a1a39d-c369-77ac-9a80-b1993d5d057a
[ci-thread]: https://ampcode.com/threads/T-118f58c0-7f55-46e6-9d1f-83d662f2b3dc
[t07-thread]: https://ampcode.com/threads/T-4bd49a1c-f754-4a63-8218-563690c638dd
[off-aggregation]:
  https://github.com/openfoodfacts/openfoodfacts-server/tree/d4e3cd4/lib/ProductOpener
[off-carbs]:
  https://github.com/openfoodfacts/openfoodfacts-server/tree/d4e3cd4/docs/api/ref/schemas
[usda-nutrients]: https://fdc.nal.usda.gov/Foundation_Foods_Documentation/
[off-limits]: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/#rate-limits
