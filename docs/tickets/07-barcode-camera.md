# 07: Scan barcodes with the camera

Depends on: 06. Covers R5, R10. Review boundary: replace barcode typing with scanning.

## Outcome

Open a scanner, scan a package, and inspect the same result offered by manual barcode lookup.

## Implementation

Install Expo-compatible camera support and configure a truthful iOS camera permission description.
Request permission when the user opens scanning, not at app startup. Support the relevant UPC/EAN
formats and pass scan data into the existing resolver. Accept one scan per active lookup and allow
an explicit rescan; repeated camera callbacks must not create duplicate logs or requests. Stop
camera use when leaving the screen or backgrounding. Keep typed entry available on denial,
unsupported environments, and unreadable labels. No photo storage, uploading, or OCR.

## Acceptance checks

- Scan a known package once and see one lookup, even when the camera emits repeated detections.
- Deny permission: explain how to enable it and allow typed entry without a crash.
- Navigate away, background, and reopen: the camera resumes only when the scanner is active.
- Scan an unknown product: the existing not-found and manual-entry flow remains usable.
- Verify on the physical iPhone 12 Pro. A browser or simulator image is not a camera acceptance
  test.

## Mobile lesson and limits

Permissions and foreground/background lifecycle are native concerns. Adding this native module
requires a new native build, not just a JavaScript refresh. Run shared verification and record a
real scanner interaction when hardware is available; otherwise label that gate pending.
