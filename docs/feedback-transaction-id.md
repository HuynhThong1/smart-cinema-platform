# Optional ticket transaction ID

The customer form supports manual entry, scanning the entry QR immediately below
the printed **Trans No**, and a feedback link with `?tx=<encoded Trans No>`.
The entry QR is different from the feedback QR at the bottom of a ticket.

Supported scan payloads:

- Galaxy entry format: `T` + four terminal digits + eight transaction digits +
  a space + four suffix digits. For example, synthetic
  `T999900000001 0001` becomes `00000001/0001`.
- A plain Trans No matching `^[0-9]{6,10}/[0-9]{3,5}$`.
- An HTTP(S) feedback URL with path `/f/:token` and exactly one valid `tx`.
  Scanning extracts the ID only: it never navigates or changes the staff QR.

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

## Verification

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
