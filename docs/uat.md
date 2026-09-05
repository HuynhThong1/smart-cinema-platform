# Phase 1 UAT and pilot

Use synthetic data locally. Record browser/device, account role, cinema, test time, observed result and screenshots for each scenario.

## Customer

- Scan an active QR; verify the form exists in the initial HTML and `noindex,nofollow` is present.
- Check widths 320px and 390px: no horizontal scrolling; rating and submission targets are easy to tap.
- Submit blank/invalid name, invalid phone, no rating and no consent; expect inline validation and no write.
- Select a positive reason, then change to a negative rating; previous reasons disappear and selection clears. Required configured reasons are enforced.
- Visit privacy and return; inputs remain. Simulate API failure; answers remain available for retry.
- Submit valid feedback; one record is created with current UTC time, normalized phone and consent version. Repeated submissions create distinct records and may be flagged.
- Disable/regenerate QR, disable staff and disable cinema; all produce the same public unavailable message with no staff identity.

## Manager and Head Office

- Sign in with each role, check permitted navigation and direct URL/API access.
- Attempt another cinema's list, detail and write requests as a manager; expect denial.
- Create/edit/deactivate staff; duplicate codes are rejected.
- Preview CSV and XLSX with duplicates, missing values and wrong cinema; verify no writes until confirmation. Download and inspect errors.
- Generate a QR and a missing-only batch; verify existing codes remain unchanged. Download PNG/SVG/PDF and ZIP.
- Print at actual A6/A5/sticker dimensions. Scan physical printouts on iOS/Android under cinema lighting; verify quiet zones and correct URL.
- Filter feedback by date, customer, staff, rating, reason and suspicious status. Verify pagination and masked CSV export.
- Check dashboard aggregates against raw records, including midnight boundaries in Asia/Ho_Chi_Minh and suspicious default exclusion.
- Check minimum ranking eligibility, create coaching, mark in progress/completed, and inspect follow-up and staff history.
- Edit rating/reasons; verify customer configuration updates without frontend deployment.
- As System Admin, create/edit/lock a test Keycloak account and assign a cinema/role; verify fresh login and audit results.

## Operational acceptance

- Verify TLS, allowed origins, trusted reverse proxies, token expiration, session refresh, rate limits and request IDs.
- Review privacy text, retention/deletion workflow, backup/restore and credential rotation with the deployment owner.
- Run browser QA on Chrome/Safari/Firefox and real mobile devices. Emulation alone does not prove physical scan reliability.
- Pilot one cinema only after operational sign-off. Record completion rate, scan failures, manager feedback and analytics discrepancies, then resolve findings before expansion.

Local automated checks and browser evidence are recorded in `implementation-status.md`. Physical print/scan tests, production security review and live pilot require cinema participation.
