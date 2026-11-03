# 10: Record weight and show a descriptive trend

Depends on: 03. Covers R8, R10. Review boundary: inspect personal weight history without coaching.

## Outcome

Add, correct, or remove a daily weigh-in and see measurements with a labeled seven-day average.

## Implementation

Add `src/features/weight/`, persistence, and a history screen. Store mass canonically in kilograms;
support explicit kg/lb entry and display. One measurement per calendar day; replacement is explicit.
For a given day, average available measurements in that day and the preceding six calendar days.
Show the sample count. Missing days are absent, not zero; do not interpolate measurements or extend
the trend beyond the latest observation. Label this descriptive smoothing, not adaptive coaching.
Use a simple accessible plot and a text history; choose a chart dependency only if existing/native
primitives cannot provide readable output. Extend backup/restore for weights and unit preference.

## Acceptance checks

- Weights of 80 kg on day 1 and 82 kg on day 7 produce 81 kg on day 7, with two samples.
- On day 8, day 1 falls outside the window. With 84 kg on day 8, the average is 83 kg.
- No measurements means no trend; one measurement is labeled with one sample, not confidence.
- Converting 100 lb uses 0.45359237 kg/lb without rounding the stored value prematurely.
- Edit/delete and backup/restore update the displayed history consistently; timezone travel does not
  move a weigh-in to a different calendar day.

## Mobile lesson and limits

Charts need accessible text equivalents and usable labels at larger font sizes. A smooth line is not
evidence of physiological accuracy. No HealthKit permissions or calorie recommendations. Run shared
verification and inspect empty, sparse, and longer histories on an iPhone-width screen.
