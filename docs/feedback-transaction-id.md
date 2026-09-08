# Optional ticket transaction ID

The customer form supports manual entry, scanning the entry QR immediately below
the printed **Trans No**, and a feedback link with `?tx=<encoded Trans No>`.
The entry QR is different from the feedback QR at the bottom of a ticket.

Supported scan payloads:

- Galaxy entry format: `T` + four terminal digits + eight transaction digits +
  a space + four suffix digits. For example, synthetic
  `T999900000001 0001` becomes `00000001/0001`.
- A plain Trans No matching `^[0-9]{6,10}/[0-9]{3,5}$`.
- Feedback URLs are rejected by the in-page scanner, including URLs with a valid `tx`.
  Opening the feedback page with `?tx=` still prefills the optional ID.
  Scanning never navigates or changes the staff QR.

The observed entry QR supplied for this change was decoded locally and compared
with the printed Trans No. Other opaque ticket formats are not guessed. Leading
zeroes are preserved.

## Customer behavior

Scan uses a rear-facing camera when available, with a lazily loaded jsQR decoder
at a maximum frame width of 640px. Camera denial/failure offers manual entry.
Switching away from scanning, hiding the document, leaving the page, and destroying
the component stop camera tracks. Pending camera acquisition cannot restart a
cancelled scan. Camera use requires HTTPS or localhost.

The transaction is optional. Manual input validates immediately; malformed IDs
are visibly identified and omitted from submission without blocking feedback.
Valid but unresolved IDs are retained. Changing a ticket clears the ID and source.
The input uses a text keyboard because the printed ID contains a slash.

## API and persistence

`GET /api/v1/public/transaction/:transactionId` accepts the encoded slash and
shares the feedback POST IP quota (20 requests/minute). Lookup currently returns
only `{transactionId, verified:false}`. **There is no POS integration or trusted
ticket data source in this repository**, so film/showtime/screen/seat summaries
and verified tickets are not fabricated. This is an explicit limitation relative
to the resolved-ticket design state in handoff version 4.

Feedback persists `transactionId`, client-reported `transactionSource`
(`QR_TICKET | QR_SCAN | MANUAL | NONE`), and server-owned
`transactionVerified=false`. Acquiring an ID through QR does not authenticate it.
Malformed optional input is discarded server-side as well.

A repeated transaction within ten minutes in the same cinema adds the existing
suspicious flag, including when different staff QR tokens or customer phones are
used. Cinema document writes serialize concurrent transaction checks; normal
staff/phone dedupe is preserved. A transaction ID/createdAt index supports lookup.

Admin list/detail and CSV expose the ID, with source and verification in detail
and CSV. Search includes transaction IDs. `hasTransaction=true|false` works with
existing cinema scope and pagination; missing IDs in legacy feedback count as
without a transaction. Existing phone masking remains in effect.

## Initial transaction feature verification

- Both Angular production builds and TypeScript checks passed.
- Frontend formatting and five unit tests passed (including entry QR parsing,
  leading zeroes, URL parsing, unsupported/ambiguous payload rejection).
- All Go tests passed with a local Mongo replica set and disposable
  `smart_cinema_test_*` databases; `go vet ./...` passed.
- Focused integration coverage: persistence, unverified source, cross-staff
  transaction dedupe, malformed optional input, encoded slashes, admin filtering,
  shared lookup/POST quota.
- Three existing Playwright customer regressions passed at 320/390px, including
  language changes, retry with preserved answers, reset and SSR hydration.
- Browser checks: manual validation, retained ID across VI/EN, URL prefill,
  change ticket and no horizontal overflow at 320px.
- The real supplied QR image decoded successfully using jsQR at 640px.
- Screenshots: [320px](../output/playwright/customer-form-en-320.png),
  [390px](../output/playwright/customer-form-en-390.png).
- Admin authenticated browser QA was blocked by automatic approval review at
  local admin sign-in; backend scope/filter checks passed. Physical camera scans
  and camera permission behavior on iOS/Android still require UAT.

## Handoff 5: scan guidance

The question-mark button opens a bottom sheet with a synthetic ticket diagram,
numbering the entry QR as 1 and the feedback-link QR as 2. Copy follows the active
VI/EN language. The sheet supports close button, backdrop, Escape, acknowledgement,
and dragging its handle down by more than 40% of the sheet height. PrimeNG traps
focus and locks page scrolling; closing returns focus to the help button. Opening
help stops an active scanner to prevent it from capturing behind the sheet.

Scanner validation accepts only a plain valid Trans No or the observed Galaxy
entry payload format. URLs, extra suffixes, malformed digit groups, control
characters and oversized payloads are rejected. An invalid scan retains the
current value and keeps scanning with an inline explanation. This is format
validation, not POS ticket authenticity verification.


### Handoff 5 verification

- Both production builds, TypeScript, formatting and all six frontend unit tests passed.
- Go domain/server tests passed; database integration tests were skipped in this run
  because `TEST_MONGODB_URI` was not configured.
- Chromium checks passed at 320, 390 and 1366px: VI/EN guidance, focus trap and
  return, Escape, acknowledgement, backdrop dismissal, manual validation, no
  horizontal overflow and no page errors. Downward handle drag also passed.
- Screenshots: [Vietnamese 320px](../output/playwright/transaction-help-vi-320.png),
  [Vietnamese 390px](../output/playwright/transaction-help-vi-390.png),
  [English 390px](../output/playwright/transaction-help-en-390.png).
- Physical phone camera scans still require UAT; QR format validation does not
  prove that the transaction exists or belongs to the staff/cinema being rated.

## Animated QR scanner

The camera preview has a moving scan line and a square target. It opens at 1x
and stays there indefinitely until a supported transaction QR has been decoded.
There is no timer-driven zoom or search cycle. The QR's four corners determine
its bounding box: below 25% of the frame it zooms in towards 45% coverage,
25–60% holds the current view, and above 60% widens if the source allows it.
The hold band avoids jitter and digital zoom is capped at 2.5x.
Both preview and decoder use the same crop from the original camera frame, before
resizing to at most 640px. This retains more detail for small central QR codes;
it does not control optical zoom or invent additional camera resolution.

When zoom is needed, the preview centres on the detected
corners over 320ms, highlights the target in green, and shows the captured ID after
420ms. Invalid QR codes keep scanning. Leaving the scanner, opening help, hiding
the page or destroying the component cancels the animation/capture and stops tracks.
Reduced-motion users get a static target and immediate capture without zoom motion.

Verification: nine unit tests, UI/i18n checks, formatting, TypeScript and both
production builds passed. Chromium camera simulation at 320/390px decoded actual
synthetic Galaxy QR images using jsQR, rejected feedback URLs, and verified track
cleanup and cancellation during the capture animation. Physical phone camera
performance and autofocus still require device UAT.

The current jsQR decoder provides corners only after successfully decoding a QR;
this is detection-triggered capture zoom, not localization of unreadable QR codes.
Blank frames and unsupported QR payloads leave the preview at 1x.
The regression check records the actual preview crop for eight seconds of blank
camera frames at 320/390px and verifies it never changes from 1x, then inserts a
synthetic QR and verifies zoom starts only after detection and captures its ID.
