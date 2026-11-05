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

The owner requires an independent oracle code review of each PR before merging. They subsequently
clarified that the implementation thread owns this review, after creating its PR and before its
first CI jobs run. The coordinator no longer arranges reviews for other ticket threads. The
publication sequence and severity rules are in [repository guidance](../AGENTS.md).

The local CI change skips draft-PR jobs and starts them on `ready_for_review`. It preserves checks
for non-draft updates and main pushes. Until that workflow change is published, opening a draft PR
under the old workflow can still run CI. Ticket 06's worker received the new ownership instruction.
Tickets 03–05 were merged before the review requirement; no retrospective review is implied.

The independent oracle reviewed the local draft-PR gate and guidance changes. No medium-or-higher
findings were reported. One low finding awaits the owner: clarify that integration requires all six
expected checks to have executed successfully for the reviewed head. Skipped draft jobs can report
success, so a green aggregate alone is insufficient. This clarification has not been applied.
Local YAML/expression checks passed ten event cases for both jobs and confirmed all existing test
commands remain unchanged. Hosted draft-to-ready behavior has not yet been exercised.

The owner subsequently requested Fable at xhigh for Claude Code ticket reviews, independent of the
Opus 5.5 medium implementation. The local [review route](../.agents/pstack-models.md) now pins a
separate Claude Code thread and requires findings plus exact reviewed head to return to the ticket
thread. Amp-native Dial threads keep the Review-button workflow. Official Amp and Claude docs
confirm the feature spelling and model support. No live Fable invocation, included-plan entitlement,
or effective runtime effort was verified. The account setting reads `subscription-only`; Fable
extra-usage eligibility still needs checking before launch. No model substitution is authorized.

### Method audit of tickets 03–06

The coordinator read the four implementation-thread histories and inspected current goals, lookup,
backup, and diary orchestration code. This audit found inconsistent red-green TDD, not consistent
test-first development. A failing behavioral test must run before its implementation to count as
test-first. Removing an implemented module or mutating completed code is not that initial red step.

| Ticket | Observed test chronology |
| --- | --- |
| [03][backup-thread] | Tests written first but first run after implementation; later restore-race correction did run red before the fix. |
| [04][targets-thread] | Goals lacked an initial behavioral red; backup v2 had a real pre-implementation red. |
| [05][lookup-thread] | GTIN/USDA and backup v3 implementation preceded their tests. Later mutations checked sensitivity, not test-first chronology. |
| [06][off-thread] | OFF and its oracle corrections were implementation-first; regressions were subsequently run against unfixed code. |

The inspected code uses pure parsers/calculations and fresh-object transformations. For example,
`Diary.tsx` replaces nested forms with spreads. `parseBackup` maps foods into new objects.
Goals places types and calculations before database actions. Lookup places types/parsers before
HTTP and local-first orchestration. Ordering is not universal: backup's pure `summarize` follows
the effectful `exportBackup`, and lookup's pure `parsed` helper follows `get`.

Effects are explicit in database parameters and network adapters, but clocks, timers and React refs
remain stateful. Mutation of fresh local accumulators does not mutate caller-owned values. This is
functional-core style, not pervasive immutability or strict separation into four files.
The ticket 06 worker was reminded to run the red test before implementing future corrections.

### Repository record publication

The record migration shipped to main as [5bc691a][record-commit]. An independent oracle found no
actionable defects in the two documentation files. Local lint, typecheck, `npm test` (34 passed),
the depth-4 nutrition check (44,956 sequences), iOS JavaScript export, Storybook build and browser
checks (36 stories) passed before the push.

The first push was rejected because main had advanced to `350327a`. The documentation commit was
rebased without conflicts; its two-file content remained identical to the reviewed version. Per the
owner's instruction, the suite was not repeated after this later rebase. These results therefore
do not independently verify the newly fetched upstream fixes. The GitHub completion event for
[run 41775963291](https://github.com/mite404/macro-factor-clone/actions/runs/41775963291)
subsequently reported all six checks successful on the exact pushed head. This is not native iOS
acceptance.
This checkpoint predates publication of the review-ownership, draft-CI gate and method-audit changes.

### Ticket 06 correction handoff remains unpublished

The [ticket 06 worker][off-thread] reports local head
`48b376ee116713a9aa9915642d15d75864aee681`, with fixes for modified nutrient values, total-carb
semantics, and the shared OFF request gate. Its reported checks pass, including 35 unit tests,
36 browser stories, 26 caught mutants, and depth-5 history coverage. The coordinator has not
imported these commits or independently rerun those checks.

The worker's generic read-only subagent review does not meet the newly requested Fable/xhigh route.
Two low findings await the owner: wall-clock rollback can leave the OFF gate busy, and the earlier
missing-protein wording. Publication remains unauthorized; no correction push is implied here.

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
| 07 | Camera scanning | [PR #10][pr10], merged after Fable review and green CI; native acceptance pending |
| 08 | Weighed recipes | PR #12, merged as `4f8f49f` |
| 09 | Copy diary entries | [PR #14][pr14], merged as `a7459e0`; native acceptance pending |
| 10 | Weight history | [PR #13][pr13], merged as `9d975c0`; native acceptance pending |

Feature delivery is 4 of 8 merged, but ticket 06 has unresolved oracle findings and ticket 07 is
held. Last confirmed remote main is [4d2c9ca][main06]. No Mac satellite has been started.

The ticket 08 to 10 rows were updated on November 4 from `git log origin/main`. That paragraph is
the earlier state. Remote main is `9d975c0`. A separate thread owns the Mac build.

## Storybook App preview sizing follow-up

Draft [PR #15][pr15] on `fix/storybook-app-phone-size`, from main at `9d975c0`. Implemented in
[this thread][sizing-thread], requested as Claude Code Opus 5.5 at medium effort. The model ID
`claude-opus-5-5` was observed. The effort was not observable and is not provider-attested.

The owner saw that resizing Storybook reflowed the app and that TargetsLargeText looked taller
than other previews. The App decorator used `height: 100vh` with no width limit, inside the
fullscreen layout. Reproduced in this orb: at 1280 × 900 and 320 × 700 windows, EmptyDiary and
TargetsLargeText both rendered the screen at the full window size. The decorator now gives a
centered screen up to 390 CSS px wide and 844 px high. It narrows below 390 px and shortens to the
window height below 844 px. Content scrolls inside it. Storybook only. The production app, `src/`,
and live stories keep no device frame.

`test:storybook` now opens both stories at 1280 × 900, then resizes to 320 × 700 and back. It
requires a centered `min(390, page width)` × 844 screen. On the old wrapper it failed with
`[1280, 900, 0]` against `[390, 844, 445]`. The 390 × 844 pass over all 50 stories is unchanged.

Observed in this orb, at head `58e6106` before this record:

- `npm run typecheck` and `npm run lint` passed.
- `npm test` passed 49 of 49 tests.
- `npm run export:ios` and `npm run build-storybook` passed.
- `npm run test:storybook` passed 50 stories plus both size checks on the dev server. It passed the
  same way with `STORYBOOK_URL` on the static build.
- A scratch copy of `verify.mjs` at 1280 × 900 passed all 50 play functions. TargetsLargeText kept
  whole totals, and Dessert scrolled above the footer.
- The `verifying-nutrition-history` depth-4 check passed: 56,362 sequences in 146 s. No
  persistence code changed, so mutants and depth 5 were not run.
- Screenshots in the Storybook manager at 1280 × 900 show EmptyDiary, TargetsLargeText, and a
  design reference. All three are 390 px wide and centered. A 320 px screenshot and a resize and
  scroll recording were inspected. The list scrolls inside the screen while the footer stays put.
  The recorder keeps a 1280 × 900 frame, so narrow widths look stretched in the video only.

At 320 px with 1.5× text, "240 of 250 g" wraps its unit. The same wrap happened before this change,
and it is production layout outside this PR's scope. Untested: native iOS.

### Review of PR #15

At the coordinator's request, this thread started [the Fable 5.1 reviewer][t15-review] with
`external-agent:claude-code` and features `model:claude-fable-5-1` and `effort:xhigh`. It reported
the model ID `claude-fable-5-1`. The xhigh effort was not observable from inside the run. It
reviewed base `9d975c0` and head `b5314d8`: approve, no high or medium findings, and three lows.

1. A fixed 844 px screen in a shorter window made the web safe-area provider pad the bottom by the
   overflow. At 320 × 700 the footer sat 144 px above the screen's bottom edge. The earlier claim
   that the footer stays put held only for windows at least 844 px tall.
2. The size check could not tell `height: 844` from `min-height: 844`.
3. This record still said the reviewer had not started.

The owner chose to fix all three, as relayed by the reviewer thread. The decorator height is now
`min(844px, 100vh)`. `App` renders its own `SafeAreaProvider`, so a decorator cannot zero the inset
from outside. The size check now requires the screen height to be `min(844, window height)` with
no page scroll, and the TargetsLargeText list to scroll inside the screen. The new check failed on
`b5314d8` at 320 × 700 with `[320, 844, 0, 844]` against `[320, 700, 0, 700]`. A `min-height`
wrapper failed at 1280 × 900 with a 7,938 px screen. With the fix, at 320 × 700 the screen is
700 px with no bottom padding, the footer ends 8 px above the window bottom, and the page does not
scroll. In the manager at 1280 × 900, the preview pane is 560 px tall, so the screen is now 560 px
tall rather than an 844 px screen inside a scrolling iframe.

Observed in this orb after the correction: typecheck and lint passed. `test:storybook` passed 49
stories plus both size checks with `app--recipe-edit-keeps-history` excluded. That story fails on
November 5, 2026 at `b5314d8` and with the correction: "Found multiple elements with the role
button". `backup-v5.json` holds a Trail oats entry dated 2026-11-05, and the story seeds the same
entry on today's date. This is a date-dependent fixture on main since `9d975c0`, not part of this
PR, and CI runs this suite.

The reviewer's recheck of `f60407a` approved the corrections and raised one docs-only low: the
size-check paragraph above describes the first fix in the present tense. That low awaits the owner.
The owner, as relayed by the reviewer thread, chose to fix the fixture collision in this PR. The
Trail oats entry, id 11, in `backup-v4.json` and `backup-v5.json` now falls on 2026-11-03, and
`backup.test.ts` reads it from that day. No fixture diary entry falls on today or later, so a
story's `localDay()` seed cannot duplicate one. On November 5, `npm test` passed 49 of 49 and the
unmodified `npm run test:storybook` passed 50 stories plus both size checks. The depth-4 nutrition
check passed 56,362 sequences. The fix awaits the
reviewer's recheck, and the PR stays draft until it passes.

## Tickets 09 and 10 merge facts

Observed from `git log origin/main`: ticket 09 merged as [PR #14][pr14] at
`a7459e026ec01d20a85514a37cfa93e55134b1ab`. Ticket 10 merged as [PR #13][pr13] at
`9d975c0eb56ae4b93c589309090461c3f3bb2082`. Native acceptance is pending for both.

The following were reported by the coordinator and not independently checked here. For ticket 09,
the Fable recheck approved `023b3c4`. The owner deferred Space toggling copy checkboxes on web. The
ticket 10 thread reported Fable clean on the final merge-resolution head `c53622d`, which merged as
`9d975c0`. It also reported 49 tests, 50 stories, six passing CI jobs, and a depth-4 nutrition
PASS over 56,362 sequences.

## Ticket 09: copy diary entries

[Implementation thread][t09-thread]. Built on main at `4f8f49f`, which includes ticket 08.

The food log has a Copy entries button below a day's entries. It opens a screen with one visible
checkbox per entry and a destination day that starts at today, or tomorrow when viewing today.
Copying to the same day is allowed and shows a warning. Cancel returns with nothing added. The copy
button stays disabled until an entry is selected. The existing write lock ignores repeat taps while
the batch runs. The log then opens the destination day with a "Copied N entries" notice.
`copyEntries` is one `INSERT ... SELECT` of the stored snapshots and portions. A failure copies
nothing, and later food or recipe edits never change a copy. There is no meal library or schedule.

Observed in this orb: typecheck, lint, 43 Node tests, iOS export, 45 Storybook stories at 390 px,
the depth-4 nutrition-history check with a new copy op (56,362 sequences), and 32 of 32 mutants
caught. A row-by-row copy fails the new Node test's injected-failure case. Removing the write lock
fails `CopyEntriesToToday`. The web preview was driven and recorded through the empty, selected,
same-day, and result states. Untested: depth 5, VoiceOver, large text on the copy screen, and the
native build.

[The Fable 5.1 oracle][t09-review] reviewed base `4f8f49f` to head `f356295`: approve, no high or
medium findings, and four lows. Its effort level was not observable from inside the run. The owner
chose to fix lows 2 to 4 and leave 1. Low 1: on web, Space does not toggle a copy checkbox; Enter
does, and iOS is unaffected. Low 2: the log and copy day chevrons now expose the shown day as
their accessible value, so VoiceOver reads it after a press. Low 3: the Copy button reads Copying
and is disabled while the batch runs. Low 4: the new mutant where a copy reads the food's current
calories needs four ops, so `mutants.ts` now pins the check to depth 4.

## Ticket 07: camera scanning

[Implementation thread][t07-thread]. The owner started ticket 07 on November 4 while the ticket 06
oracle corrections were still off main. Those touch `lookup.ts`; this ticket does not.

The Barcode tab's ▥ button opens `expo-camera` 58.0.14 for EAN-13, EAN-8, UPC-A and UPC-E codes.
Permission is requested on that tap, never at startup. A ref lock accepts one detection per opening;
the scan closes the camera, fills the field, and runs the existing resolver. ▥ rescans explicitly.
Leaving the tab or a result unmounts the camera. expo-camera stops its session in the background and
restarts it on return; no app code handles that. Denial shows Allow camera or Open Settings, with
typed entry kept.
`NSCameraUsageDescription` is set; the microphone description is omitted. No frames are stored.

Observed in this orb: typecheck, lint, 35 Node tests, iOS export, 39 Storybook stories, and the
depth-4 nutrition-history check passed. A Storybook `expo-camera` stand-in fires each code on every
render; removing the lock made `BarcodeScanOnceAndRescan` fail. The real web module rendered the
denied state in headless Chromium. Untested: a real camera, the iOS prompt, background/foreground,
VoiceOver, and the native build. The physical iPhone 12 Pro gate is pending.

A pre-review by a generic Amp Task subagent, not the required Fable 5.1 xhigh oracle, found one high
issue. A scanned UPC-E was read as EAN-8, so its check digit failed or it resolved to another GTIN.
Scans of type `upc_e` now expand to UPC-A first. A Node test covers each rule, the 2/3 boundary, and
number system 1; the subagent found 0 mismatches against its own expander over all 2,000,000 codes.
Typed 8-digit codes still read as EAN-8. The PR was opened ready, then returned to draft when main's
review gate arrived.

The owner had all three of its low findings fixed. Camera access is off now shows only once access
is denied, not behind the open iOS prompt. A media reset expo-camera recovers from no longer closes
the camera, and a failed start no longer claims the device has no camera. iOS gives expo-camera no
way to report a missing camera, so the Simulator still shows an empty square. Returning to the app,
for example from Settings, re-reads camera permission. `BarcodeScanPromptOpen`,
`BarcodeScanMountErrors`, and `BarcodeScanDeniedTypeUnknown` each fail with its fix reverted; 41
stories pass. Fable 5.1 xhigh oracle review started on `4924f9c` in [its thread][t07-review]; the
re-read came after that head.

[The Fable 5.1 oracle][t07-review] reviewed base `74bddb0` to heads `4924f9c` and `2567cb8`: no high
or medium findings and six lows. Its effort level was not observable from inside the run. The owner
chose to fix lows 1 and 4, note 2 and 3, and leave 5 and 6. The Settings re-read now swallows a
rejected permission read, and the scan hint shows only once access is granted, not behind the open
iOS prompt. Low 2: iOS reports Screen Time or device-management restriction as denied, so a
restricted phone still sees Open Settings, which cannot help; this layer cannot tell the two apart.
Low 3: the AppState re-read is exercised only through the Storybook stand-in on web. iOS normally
terminates the app when camera access changes in Settings, so the iOS path is covered by the scanner
remounting on relaunch. The re-read is unverified on a device. Left as is: a UPC-E scan fills the
field with its expanded 12-digit UPC-A, and Allow camera is unreachable on iOS.

The same oracle approved the fixes at `e23be4b` and the merge of main's ticket 06 corrections at
`9a8c284`, which changed only the Storybook README table. GitHub CI run [41789295767][ci07] passed
all six jobs on `9a8c284`. The owner authorized this thread to merge after review and green CI;
[PR #10][pr10] merged at 07:04:08 UTC on November 4 as `93c944c`. The physical iPhone 12 Pro camera
gate remains pending; see `docs/ios-builds.md`.

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
[pr10]: https://github.com/mite404/macro-factor-clone/pull/10
[pr13]: https://github.com/mite404/macro-factor-clone/pull/13
[pr14]: https://github.com/mite404/macro-factor-clone/pull/14
[pr15]: https://github.com/mite404/macro-factor-clone/pull/15
[sizing-thread]: https://ampcode.com/threads/T-6fcfccf8-1bea-4c68-bf06-7666fb1b1346
[t15-review]: https://ampcode.com/threads/T-86681d9d-fab9-466e-a721-b781cdb2a7d1
[ci07]: https://github.com/mite404/macro-factor-clone/actions/runs/41789295767
[main06]:
  https://github.com/mite404/macro-factor-clone/commit/4d2c9ca30594542a9161ee4668bbb1a262abd31f
[coordinator]: https://ampcode.com/threads/T-01a19290-a404-75d0-9b1c-735ad66c0b4e
[ui-thread]: https://ampcode.com/threads/T-f3543611-9f9b-44f2-8037-090845203361
[history-thread]: https://ampcode.com/threads/T-01a1a39d-c369-77ac-9a80-b1993d5d057a
[ci-thread]: https://ampcode.com/threads/T-118f58c0-7f55-46e6-9d1f-83d662f2b3dc
[t07-thread]: https://ampcode.com/threads/T-4bd49a1c-f754-4a63-8218-563690c638dd
[t07-review]: https://ampcode.com/threads/T-4f9e25ad-9fd5-4eb6-89fe-07f62a8955c1
[t09-thread]: https://ampcode.com/threads/T-a7a0c8d3-3e33-418d-91eb-279195c746f2
[t09-review]: https://ampcode.com/threads/T-ad4e43d0-9258-41e5-9f1a-3afc75f46dc5
[backup-thread]: https://ampcode.com/threads/T-92446160-d0c9-4113-8d29-e772c221d832
[targets-thread]: https://ampcode.com/threads/T-726bca15-3a60-4507-a2a7-e12b1b49595e
[lookup-thread]: https://ampcode.com/threads/T-68986624-b1ed-44fc-be7b-6ae0d6bed2eb
[off-thread]: https://ampcode.com/threads/T-fc6d0b84-ec13-47c8-8b1f-26a2caab882f
[record-commit]:
  https://github.com/mite404/macro-factor-clone/commit/5bc691abed14bfc84c61aa3eb670eea07e2b35f1
[off-aggregation]:
  https://github.com/openfoodfacts/openfoodfacts-server/tree/d4e3cd4/lib/ProductOpener
[off-carbs]:
  https://github.com/openfoodfacts/openfoodfacts-server/tree/d4e3cd4/docs/api/ref/schemas
[usda-nutrients]: https://fdc.nal.usda.gov/Foundation_Foods_Documentation/
[off-limits]: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/#rate-limits
