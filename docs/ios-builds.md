# Build and install on your iPhone

Target hardware: MacBook Pro M4 Pro and iPhone 12 Pro. These steps require the Mac, not the Linux
orb. They are a runbook, not a record of a completed native build.

The owner chose free Personal Team signing and accepted its seven-day renewal requirement on
October 31, 2026. Use the local build path below, not EAS or the Expo Go TestFlight path. No paid
Expo plan or Apple Developer Program membership is required for this local development workflow.

## Prepare the Mac

Install Xcode from the Mac App Store, launch it, accept its license, and install its iOS components.
In Xcode Settings, add your Apple Account. Connect and trust the iPhone, and enable Developer Mode
on the phone when prompted. Use an Xcode version compatible with the phone's installed iOS version.

From this repository on the Mac, run `npm ci`, then `npx expo prebuild --platform ios`. Expo
generates `ios/` from app configuration and dependencies. Do not use `--clean` to troubleshoot
without understanding that it regenerates the native project and can discard native edits.

## Simulator and debug builds

`npx expo run:ios` compiles a native debug app for the simulator. It requires Xcode and may install
native dependency tooling. `npx expo run:ios --device` selects a connected physical device. Expo's
`npm run ios` command only starts the development workflow; it is not a standalone build.

If signing needs setup, open the generated `.xcworkspace` in Xcode. In the application target's
Signing & Capabilities tab, select your Personal Team and automatic signing. The initial bundle
identifier is `com.mite404.nutritiondiary`; change it if your account requires another unique ID.
Select the iPhone as the destination and run the app. Trust the developer profile if iOS asks.

## Use away from Metro

After signing is configured, `npx expo run:ios --device --configuration Release` builds with bundled
JavaScript. Stop Metro and confirm the app still launches. After local data exists, test airplane
mode and restart before relying on the app away from the Mac.

Free Personal Team provisioning expires after seven days. Rebuild/re-sign as required; do not
uninstall as a renewal shortcut because that can remove app data. Back up before signing or install
changes. A paid developer membership is optional for this local workflow, not required by React
Native.

Keep the same bundle identifier and Personal Team when renewing. Install over the existing app,
then confirm the diary data survived. Backup and restore exist (Settings → Backup), but they have
not passed on a device yet. Until they do, keep only disposable test data in this build.

## Evidence to record

For each native test, record Xcode version, iOS version, device, build configuration, action, and
observed result. Capture camera permission denial, actual scanning, database persistence after
restart, large text and VoiceOver, keyboard layout, and Files export/restore as those features
arrive. Native checks remain pending until someone runs them on Apple tooling or the physical
device.

For backups, check on the iPhone: export and choose Save to Files, then dismiss the share sheet
without saving; choose a file in Files, then cancel the picker; cancel and confirm a replacement;
restore a backup after deleting and reinstalling the app. Compare the diary and saved foods with
the source each time. See [the backup format](backup-format.md).

Sources: [Expo local builds](https://docs.expo.dev/guides/local-app-development/) and
[Apple account capabilities][apple-account].

[apple-account]: https://developer.apple.com/help/account/basics/about-your-developer-account
