# A subscription-free iOS nutrition app

Research date: October 31, 2026. Scope: MacroFactor Nutrition, not MacroFactor Workouts.

This is a feasibility report, not an implementation or a claim of feature parity. The repository
had no tracked files, application code, dependencies, or prior design decisions when inspected.
The user has React experience, no Swift or Objective-C experience, a MacBook Pro M4 Pro, and an
iPhone 12 Pro. This is a personal learning project, not a commercial or public-distribution app.
Learning iOS builds and mobile-first design is the main goal. Apple Developer membership and the
user's food market remain unknown.

## Recommendation

For a custom iOS app, React Native with Expo is the leading candidate for a small device trial.
The alternative is SwiftUI if direct Apple integration matters more than reusing React knowledge.
A home-screen web app deserves consideration if avoiding all recurring developer fees is a hard
requirement. An existing free food logger may solve the money problem without another app to
maintain.

The proposed product is local-first: a reliable food diary, reusable foods and recipes, weight
history, user-set targets, and recoverable exports. Adaptive coaching comes after reliable logging.
It is an independent nutrition tracker inspired by MacroFactor's usability, not a branded clone.

The user subsequently chose React Native scaffolding. The implementation plan and ADR record the
current decisions; alternative stacks below remain research, not competing implementation tasks.

## The cost constraint can change the answer

The press kit currently lists MacroFactor Nutrition at USD 11.99 monthly, USD 47.99 per six months,
or USD 71.99 yearly. The separate two-app bundle is not needed for this comparison.
[Source][mf-press]

Apple's [Developer Program][apple-membership] costs USD 99 per membership year, with regional
pricing differences. That is USD 27.01 more than MacroFactor's annual nutrition subscription,
before any hardware or optional services. If the user already pays for Apple membership for other
apps, this is not an additional membership per app. Otherwise, building one personal native app
does not automatically save cash.

There are several distinct installation paths:

- Free local Xcode signing: Apple's Personal Team provisioning expires after seven days. This
  requires rebuilding or reinstalling and access to the Mac-based toolchain. It is useful for
  development, not an install-and-forget personal app. [Source][apple-free]
- Paid internal distribution: an Expo ad hoc build can target a registered iPhone without a public
  App Store listing. It still requires membership and valid signing. [Source][expo-internal]
- TestFlight: useful for beta testing, but each build expires after 90 days. It is not a permanent
  installation shortcut. [Source][testflight]
- App Store: the ordinary durable public-distribution route, subject to membership, signing, and
  review. Neither SwiftUI nor React Native bypasses those requirements. [Source][apple-membership]
- Home-screen website: avoids native distribution and its Apple membership fee, but loses direct
  native HealthKit integration and needs a separate storage and backup design.

Expo's [current pricing][expo-pricing] lists a free tier with 15 iOS builds and 15 Android builds
per month, low-priority queues, and a 45-minute build timeout. The optional Starter plan is
USD 19 per month plus usage, including USD 45 in build credit. A monthly Expo subscription is not
required for this project. [Billing documentation][expo-billing] says free accounts do not incur
overage charges; they must wait for the quota reset, upgrade, or build locally.

EAS cloud can build iOS from a Linux or Windows development workflow, but physical-iPhone builds
through EAS require paid Apple membership. Local iOS compilation and the iOS Simulator require
macOS tools. A simulator build is not installable on an iPhone. [Source][expo-builds]

This orb is Linux, not the user's Mac. A cloud build can remove the need to own a build Mac for
the Expo route, but camera, HealthKit, and final iOS behavior still need testing on an iPhone.

## React Native fits the user's experience; SwiftUI fits direct Apple integration

### React Native with Expo: recommended candidate for a device trial

[React Native recommends a framework][rn-setup] such as Expo for new applications. Existing React
knowledge transfers to components and state, although native views and text replace browser HTML.
Expo supplies [SQLite][expo-sqlite] and [camera barcode scanning][expo-camera], both available in
Expo Go. Barcode scanning only returns a code; the nutrition lookup is separate.

The proposed app would use TypeScript, Expo, and a local SQLite database. Keep food calculations
independent of screen components, but do not invent a generic backend or sync framework. No
package versions or chart library have been selected, installed, or compatibility-tested.

Expo Go is a prototype host with a fixed set of native libraries, not the finished app. HealthKit
requires a custom development build. The upstream [React Native HealthKit package][rn-health]
documents an Expo config plugin and explicitly excludes Expo Go. It also introduces native
dependencies that must be tested against the chosen Expo and React Native versions.

For daily use, bundle the JavaScript into a standalone app instead of depending on a running
development server. Native module or configuration changes require rebuilding the native app.
See [development-build limitations][expo-faq] and [build setup][expo-builds].

The tradeoff is ownership of third-party native integration compatibility. Expo removes much
build configuration work; it does not remove signing, permissions, or platform-specific debugging.

### SwiftUI: viable if Apple-only integration is the priority

[SwiftUI][swiftui] uses Swift. Objective-C is not a prerequisite. The usual workflow uses
[Xcode on macOS][xcode]. [SwiftData][swiftdata] supplies native persistence, and HealthKit and
Vision can be called through Apple's own APIs without a React Native wrapper.

For an iPhone-only product with deep HealthKit integration, widgets, and other Apple-specific
features, this avoids a class of third-party bridge dependencies. The tradeoff is learning Swift
and Apple's app lifecycle rather than reusing the user's existing React knowledge. SwiftUI does
not make food databases or adaptive coaching easier, and it does not lower distribution fees.

### A React PWA: the custom-build option with no Apple membership

A progressive web app can provide a home-screen diary, saved foods, manual weights, charts, and
exports without App Store distribution. Browser storage and offline behavior would need a
deliberate implementation and real iPhone testing; they are not interchangeable with native SQLite.

Do not plan on direct HealthKit access from a standalone Safari web app. Apple's documented
[HealthKit setup][healthkit] requires native entitlements and an `HKHealthStore`. This is an
architectural conclusion from that documented API, not a claim that Apple explicitly publishes a
blanket PWA prohibition. Adding a native wrapper reintroduces native signing and distribution.

Choose this route when zero recurring developer fees outweigh automatic Health imports and native
system features. Choose Expo when building and owning a real native app is worth the distribution
cost. Choose SwiftUI when direct Apple integration and learning that stack are the stronger goals.

### Health data and backups need explicit handling

HealthKit itself is listed as supported for free Apple developers in Apple's
[capability matrix][apple-capabilities]. Do not confuse that with EAS's paid-membership requirement
for physical-iPhone builds. Read and write permissions are separate, and a denied read must not be
interpreted as proof that the user has no health data. [Source][health-privacy]

Local SQLite survives application restarts, but does not make a recoverable second copy. Device
backup may include application data. Therefore, "no application backend" does not mean "data never
leaves the device." Review [Apple's backup behavior][apple-backup] before making privacy promises.

Do not casually add CloudKit sync for health records. Apple's [review guidelines][apple-review]
5.1.3 restrict personal health information in iCloud and prohibit health-data advertising uses.
App-managed cloud storage, system device backup, and user-initiated exports are different cases
that need an explicit privacy and policy review if the app becomes a distributed product.

## Food data can be free, but it is not interchangeable

### USDA FoodData Central: the simplest licensing starting point

The [USDA API guide][fdc-api] publishes the data under CC0/public-domain terms and documents a
default limit of 1,000 API requests per hour per IP address. USDA also publishes
[downloadable CSV and JSON datasets][fdc-downloads], so a selected offline catalog can avoid API
keys and a runtime data service entirely. Source archives are not measured final app sizes.

Foundation Foods and other generic-food collections serve different purposes from branded label
records. Branded data is not a claim that USDA laboratory-tested each packaged product.
See the [data documentation][fdc-types] before choosing which records to import.

A read-only research probe successfully found branded cheddar cheese by GTIN `094395000172`,
returning FDC ID `2057648` with a 28 g serving. This used search, not a dedicated barcode endpoint.
The eventual app must verify the returned GTIN instead of accepting the first fuzzy search match.
One successful example does not establish coverage of the user's shopping basket.

The API requires a key, and USDA says to keep it private. Do not put a shared secret in shipped
mobile code or browser JavaScript. An offline dataset avoids this issue. A private personal app
could accept the user's own key; a publicly distributed shared-key service would need server-side
storage and abuse controls, introducing another service to maintain.

### Open Food Facts: useful for barcodes, with licensing and API constraints

The [official API docs][off-api] provide barcode-indexed product reads without an API key, require
an identifying User-Agent, and ask developers to register their intended usage. Current documented
limits are 15 product reads per minute per IP and 10 searches per minute per IP. Cache results and
do not send a remote search request on every keystroke. These are October 2026 limits, not a promise
that older examples or future deployments use the same policy.

The database uses ODbL, individual contents use DbCL, and images use CC BY-SA 3.0. Attribution and
share-alike obligations need review before distributing a combined food catalog. It is incorrect
to summarize these licenses as either "everything is unrestricted" or "all app code and private
meal logs must be public." Private use, application code, derivative databases, and collections of
independent databases are different cases. See the [license guidance][off-license].

The API has also changed. Current documentation recommends v3.6; a v3.5 schema change moved
nutrition into a new structure. A staging probe confirmed `product.nutrition` rather than the
legacy `nutriments` field. Staging data was not treated as production nutrition evidence.
Search is separately documented, with structured search still in v2 and no search endpoint in v3.
An implementation must select and test its endpoints deliberately rather than copy an old example.
See the [schema change log][off-schema] and [API overview][off-api].

Open Food Facts explicitly does not guarantee completeness or accuracy. A barcode hit can lack
usable nutrition. Images and ingredient lists do not establish micronutrient amounts.

### Proposed data strategy

Start with custom foods and a small USDA-derived generic catalog. Cache personally used foods,
then add barcode lookup where the user's actual products justify it. Avoid downloading entire
global branded databases into a phone app. Preserve provider attribution and do not silently merge
catalogs before resolving their licensing.

Both providers need unit-aware parsing. USDA branded records may use a per-100-ml basis rather
than per-100-g. A gram is not a milliliter without a density assumption. The [USDA branded-data
documentation][fdc-branded] also states that absent nutrient values mean the provider did not
supply them. A missing micronutrient is not a zero or proof of a dietary deficiency.

Measured finished recipe weight handles cooking yield, but not every nutrient loss from drained
liquids, discarded fat, or heating. [USDA retention factors][retention] illustrate why recipe
micronutrients may need to be labeled estimates even when portion arithmetic is correct.

## Existing iOS apps may already solve the payment problem

These were verified against live US storefront listings, not installed and tested. The user's
storefront is unknown. None was established as a free replacement for all MacroFactor coaching.

### OpenNutriTracker: test this first if the budget is the deciding factor

The [iOS listing][ont-store] is free and explicitly advertises no subscriptions, in-app purchases,
or ads. It includes food logging, barcode scanning, and custom meals. Its [source license][ont-code]
is GPLv3. Installing the existing App Store app does not require buying developer membership.

Open source does not itself prove calculation accuracy or absence of telemetry. The listing's
privacy label mentions location and diagnostics not linked to identity. Test the actual foods and
workflows before deciding that a new app is necessary. Forking and redistributing it would also
bring GPL obligations; it would not bypass Apple's native distribution requirements.

### Foodnoms: a free core logger, not free adaptive coaching

The [iOS listing][foodnoms] includes free unlimited logging, barcodes, calorie and macro goals,
recipes, meals, Apple Health export, and CSV export. Micronutrients, AI logging, and Calibrated
Energy are paid features. The vendor [does not plan a lifetime purchase][foodnoms-lifetime].
This is an option for avoiding payment for basic logging, not an open-source base for this project.

### Calory: a listed one-time purchase worth checking

The [US iOS listing][calory] includes a USD 34.99 lifetime SKU. The [publisher site][calory-site]
mentions a lifetime option. The live description also emphasizes subscriptions and includes newer
Premium Plus offerings. The in-app purchase screen and the lifetime entitlement's exact feature
coverage could not be verified. The detailed support page returned HTTP 403.

Treat the lifetime price as a listed option to investigate, not a guaranteed checkout offer or
a promise that every future AI feature is included. Do not buy based on this report alone.

## What MacroFactor Nutrition actually includes

The current [nutrition product page][mf-product] and [press kit][mf-press] describe these groups:

- Food logging: verified search, barcode scanning, label scanning, quick-add calories and macros,
  custom foods, recipes, copying meals or days, history, speech input, and AI photo input.
- Recipe creation: manual ingredients, recipe URLs, and photos of written recipes.
- Nutrition tracking: calories, protein, fat, carbohydrate, and micronutrients with custom targets.
- Progress: scale weight, smoothed weight trend, body measurements, photos, habits, and period data.
- Coaching: weight-loss, maintenance, and gain goals; target rates; weekly adjustments; and coached,
  collaborative, or manual programs with different targets on different days.
- Integrations: Apple Health, widgets, and step tracking.
- Ownership: data export, no ads, and a stated policy against selling user data.

The feature list is much larger than a macro calculator. MacroFactor advertises more than
1.36 million verified food entries. That is a vendor claim, not a database independently audited
in this research. A free public database is not automatically an equivalent replacement.

The [2026 annual report][mf-annual] confirms recent nutrition additions such as improved AI food
logging, recipe-photo import, label scanning, and expenditure modifiers. Its future roadmap is
not counted here as shipped functionality. Workout programs and workout Apple Watch features
are excluded.

### The visual style is achievable without copying the product

Four nutrition screenshots linked from the press kit were inspected:

- [Dashboard][mf-dashboard]: white background, black headings, pale-gray sections, rounded cards,
  compact weekly bars, and separate expenditure and weight-trend cards.
- [Strategy][mf-strategy]: charcoal dark mode, a prominent check-in action, compact program data,
  and strong light-on-dark contrast.
- [Expenditure][mf-expenditure-image]: a large line chart, a shaded range, explicit numeric axes,
  selectable time ranges, and an insights section beneath the chart.
- [Food search][mf-foodlog]: dense but readable food rows, portions and macros beside each result,
  history before common and branded foods, and a bottom search field and logging action.

Across the screenshots, food entry remains prominent near the bottom of the screen. Large numbers,
consistent nutrient colors, and quiet backgrounds do more work than decoration.

A proposed independent design would preserve those principles, with original naming, icons,
layouts, and visual assets. It would also support scalable text, VoiceOver labels, adequate touch
targets, and text alternatives to color. These are design requirements, not verified properties
of MacroFactor's screenshots.

The supplied Mobbin URL was opened in a browser. It showed generic Mobbin marketing and login
links rather than MacroFactor flows in this session. No logged-in flows were inspected, and no
access restriction was bypassed. The browser recording failed during encoding; the inspected
screenshot and public press-kit images provide the visual evidence instead.

Press-kit availability is not a license to reuse another app's branding or assets in a new app.
Apple's [review guidelines][apple-review], especially 4.1 and 5.2, also restrict copycat apps and
unlicensed third-party material. This is a product constraint, not legal advice.

## Adaptive coaching is the main scientific uncertainty

MacroFactor's [expenditure explanation][mf-expenditure] describes an energy-balance calculation:
estimated expenditure is logged energy intake minus estimated change in stored body energy.
Its [weight-trend article][mf-trend] describes a moving average that emphasizes recent weights,
with interpolation for gaps between weigh-ins.

Those explanations establish the concept, not a complete reproduction specification. They do not
provide everything needed to reproduce the current product's smoothing, missing-data treatment,
body-composition assumptions, confidence behavior, and coaching decisions.

Important details from the first-party documentation:

- Coaching uses actual logged food, not whether the user obeyed the target. Going over a target
  is different from providing incomplete input data.
- Partial food logging can make expenditure look too low. Missing dinner is not the same as
  eating nothing for dinner.
- MacroFactor currently recommends daily nutrition logging and requires at least four logged
  days in each seven-day period for continuous expenditure updates. This is its rule, not a
  validated threshold for an independently implemented estimator.
- Weight logging is ideally daily, but the documentation says weekly can suffice. It describes
  expenditure holding until a new weight permits updates.
- Newer optional modifiers use step trends and goal changes to respond sooner. The older product
  FAQ's broad statement that activity is not used should not be treated as the whole current story.

Sources: [expenditure][mf-expenditure], [nutrition frequency][mf-nutrition-frequency],
[weight frequency][mf-weight-frequency], and [modifiers][mf-modifiers]. Vendor accuracy claims
were not independently validated and are not performance targets for the proposed app.

### Proposed approach to coaching

Begin with manual calorie and macro targets, food logging, and a clearly labeled weight trend.
This is useful without pretending that an unvalidated estimator is a nutrition coach.

Later, evaluate an independent estimator against known input histories. Distinguish unlogged,
incomplete, complete, and explicitly fasting days. Never replace an absent day with zero intake.
Avoid treating a single weight jump as body-fat change. Hold recommendations when data is weak,
explain why, and let the user review a proposed change before accepting it.

Do not turn a fixed calories-per-pound rule into a claim of MacroFactor-equivalent coaching.
The vendor explicitly discusses different energy densities of fat and lean tissue. The exact
model, calibration, safety limits, and validation data remain a separate research decision.

Automated diet advice also needs a defined intended population. For comparison, the
[NIDDK Body Weight Planner][niddk] excludes children and pregnant or breastfeeding people, and
states that it is not medical advice. A disclaimer alone would not validate our algorithm.

## A proposed first useful release

The aim is to replace the user's daily logging workflow, not every feature in the competitor.

1. A diary with calories and macros, editable quantities, previous dates, and user-set targets.
2. Custom foods, recently used foods, favorites, quick-add, and copy-meal actions.
3. Recipes with ingredient amounts and measured finished weight or explicit serving counts.
4. Weight entries and a trend chart that clearly distinguishes measurements from estimates.
5. Local storage, full-fidelity backup and restore, and a readable CSV export.
6. Food lookup and barcode scanning, with a useful manual fallback for unknown products.

Apple Health can follow, or move into the first release if automatic scale-weight import is
essential. That choice changes the device trial: native entitlements and permissions must work,
not just the interface in a browser.

Defer AI meal estimation, cloud accounts, automatic multi-device sync, social features, workout
tracking, a watch companion, and a subscription system. Add each only for an observed need.
Nutrition-label OCR is a better later experiment than inferring serving quantities from meal photos:
Apple [Vision][apple-vision] can recognize text on-device. Mapping that text into correct nutrients,
units, and portions still requires parsing and user confirmation.

### Keep the data trustworthy

These are proposed implementation rules, not features already built:

- Keep the serving's gram weight and source provenance. A cup cannot become grams without
  food-specific information.
- Preserve missing nutrient values as unknown, not zero. Keep the published energy value rather
  than assuming every food's calories exactly equal a simple macro calculation.
- Snapshot nutrition values into diary entries so an upstream food edit does not silently rewrite
  historical intake. Calculate daily totals from those entries.
- Use recipe yield to account for cooking-related weight changes. Do not assume raw and cooked
  weights are interchangeable.
- Make the diary's calendar day explicit. Time-zone travel and daylight-saving changes must not
  move an old meal into another day.
- Keep provider food records distinct from personal diary and health records. Food searches do
  not need to send the user's weight history or goals to a food-data service.
- Treat local-only as an ownership choice, not a backup strategy. Verify export and restore on
  another installation before relying on the app for months of data.

### What would prove the first version is useful

Before promising replacement value, test the user's real routine on an iPhone:

- Look up a representative basket of foods they actually buy, including barcodes and basic foods.
  Check portions and nutrition against labels, not merely whether a search returns something.
- Log, copy, edit, and delete a meal. Verify totals independently with asymmetric quantities.
- Create a recipe, set its finished weight, and log only part of it.
- Use saved foods and the diary in airplane mode, close the app, and reopen it.
- Export, restore into a clean installation, and compare diary entries, recipes, weights, and goals.
- If HealthKit is included, test permission refusal, repeated imports, and source deduplication.
- Check light and dark themes, large text, keyboard behavior, VoiceOver, and one-handed entry.

No application, database, or native build was created or tested during this research.

## Sources

[mf-product]: https://macrofactor.com/macrofactor/
[mf-press]: https://macrofactor.com/press-kit/
[mf-annual]: https://macrofactor.com/annual-report-2026/
[mf-dashboard]: https://macrofactor.com/wp-content/uploads/2026/01/Frame-34.png
[mf-strategy]: https://macrofactor.com/wp-content/uploads/2026/01/Frame.png
[mf-expenditure-image]: https://macrofactor.com/wp-content/uploads/2026/01/Frame-35.png
[mf-foodlog]: https://macrofactor.com/wp-content/uploads/2026/01/foodlog-3-scaled.png
[mf-expenditure]: https://help.macrofactorapp.com/en/articles/20-expenditure
[mf-trend]: https://help.macrofactorapp.com/en/articles/21-weight-trend
[mf-modifiers]: https://help.macrofactorapp.com/en/articles/274-expenditure-modifiers
[mf-nutrition-frequency]: https://help.macrofactorapp.com/en/articles/110
[mf-weight-frequency]: https://help.macrofactorapp.com/en/articles/109
[apple-review]: https://developer.apple.com/app-store/review/guidelines/
[apple-vision]: https://developer.apple.com/documentation/vision/recognizing-text-in-images
[niddk]: https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner
[apple-membership]: https://developer.apple.com/programs/enroll/
[apple-free]: https://developer.apple.com/help/account/basics/about-your-developer-account
[testflight]:
  https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
[expo-internal]: https://docs.expo.dev/build/internal-distribution/
[expo-pricing]: https://expo.dev/pricing
[expo-billing]: https://docs.expo.dev/billing/faq/
[expo-builds]: https://docs.expo.dev/develop/development-builds/introduction/
[expo-faq]: https://docs.expo.dev/develop/development-builds/faq/
[expo-sqlite]: https://docs.expo.dev/versions/latest/sdk/sqlite/
[expo-camera]: https://docs.expo.dev/versions/latest/sdk/camera/
[rn-setup]: https://reactnative.dev/docs/environment-setup
[rn-health]: https://github.com/kingstinct/react-native-healthkit
[swiftui]: https://developer.apple.com/swiftui/
[swiftdata]: https://developer.apple.com/documentation/swiftdata
[xcode]: https://developer.apple.com/support/xcode/
[healthkit]: https://developer.apple.com/documentation/healthkit/setting-up-healthkit
[health-privacy]: https://developer.apple.com/documentation/healthkit/protecting-user-privacy
[apple-capabilities]: https://developer.apple.com/help/account/reference/supported-capabilities-ios
[apple-backup]:
  https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup
[fdc-api]: https://fdc.nal.usda.gov/api-guide
[fdc-downloads]: https://fdc.nal.usda.gov/download-datasets
[fdc-types]: https://fdc.nal.usda.gov/data-documentation
[fdc-branded]: https://fdc.nal.usda.gov/GBFPD_Documentation
[off-api]: https://openfoodfacts.github.io/openfoodfacts-server/api/
[off-license]: https://wiki.openfoodfacts.org/ODBL_License
[off-schema]:
  https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/
[retention]: https://www.ars.usda.gov/ARSUserFiles/80400525/Data/retn/retn06.pdf
[ont-store]: https://apps.apple.com/us/app/opennutritracker/id6451490901
[ont-code]: https://github.com/simonoppowa/OpenNutriTracker/blob/main/LICENSE
[foodnoms]: https://apps.apple.com/us/app/foodnoms-nutrition-tracker/id1479461686
[foodnoms-lifetime]: https://foodnoms.com/help/lifetime-purchase
[calory]: https://apps.apple.com/us/app/calorie-counter-calory-ai/id1441252752
[calory-site]: https://calory.app/
