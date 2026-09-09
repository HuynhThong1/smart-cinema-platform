# Customer cinema landing

The exact root route `/` opens the public cinema diorama. The logo on the feedback page links to `/`. `/f/:qrToken` keeps its existing resolver and feedback flow; other unknown paths retain the generic QR failure page.

The eight stages cover arrival, tickets/seats, concessions, ticket check, screening, assistance, feedback and turnaround. Seat selection, snacks, assistance resolution, sample ratings and cleanup are local demonstration state. They do not create orders, charge payments or submit feedback to the API.

## Visual and implementation

- Galaxy orange/blue and Source Serif 4, with a dark presentation stage around the diorama.
- Procedural Three.js scenery: tiered auditorium, upholstered seats, animated screen, projection beam, ticket terminals, popcorn warmer, drink dispenser, lobby posters, plants, staff, moving guest, help desk and operations cart.
- Orbit, zoom and reset controls; clickable stage markers have equivalent keyboard-accessible navigation below the scene.
- The renderer is dynamically imported after browser rendering. The server renders a usable CSS 3D scene first, which also remains available when WebGL initialization fails or its context is lost.
- Static scenery is batched by material. The renderer caps device pixel ratio, stops outside the viewport or in a hidden tab, respects reduced motion, and disposes GPU resources and listeners on navigation.
- Runtime labels follow the existing VI/EN language selection, including labels rendered onto the 3D scene.

Visual reference: [Galaxy Cinema](https://www.galaxycine.vn/). The landing-only `galaxy-cinema-brand.png` was downloaded from the site's public [logo asset](https://www.galaxycine.vn/_next/static/media/galaxy-logo-mobile.074abeac.png). Other scene artwork is generated locally from geometry and canvas drawing; it has no remote model or texture dependencies.

## Verification — 2026-09-09

- `pnpm --dir frontend typecheck`: passed for both applications.
- `pnpm --dir frontend check:ui`: passed, 810 bilingual entries and shared controls verified.
- `pnpm --dir frontend exec nx build smart-customer`: production browser/server build passed. Existing jsQR CommonJS optimization warning remains.
- Browser captures inspected at desktop 1366px, customer 390px and 320px; no horizontal page overflow. Captures are recorded in the implementation task.
- Verified selected C5 updates the demo ticket; snack choices, assistance request/resolution, five-star demo rating and completed cleanup state work.
- Verified automatic progression and pause, English switch, camera zoom via Enter, and reset camera control.
- `/f/demo-invalid` shows the generic QR error. Clicking its logo opens the landing and initializes one WebGL canvas. Fresh browser session reports no console warnings/errors.
- The renderer adds approximately 123 kB estimated compressed transfer, lazy-loaded only from the landing.

Physical-device GPU testing, forced WebGL context-loss testing and a real QR feedback submission are not covered by these browser checks. Backend contracts and feedback submission logic were not changed.
