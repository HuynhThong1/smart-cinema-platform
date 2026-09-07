# Handoff: Smart Cinema Platform — Phase 1 · Transaction Feedback QR

## Overview

Phase 1 of the Smart Cinema Platform: **Transaction Feedback QR**. Each staff member has one fixed QR code placed at their POS station. A customer scans it, lands on a public SSR page (`/f/:qrToken`), rates the service, and submits. The feedback record is bound to the correct staff member without ever exposing staff identity to the customer. Managers then use the admin app to read the data, rank staff, and open coaching cases.

Two applications:

| App | Audience | Layout | Auth |
|---|---|---|---|
| Customer Website | end customers, from a QR scan | mobile-first, 320px+ | none |
| Admin Website | Cinema Manager / Head Office / System Admin | desktop-first, 1366px+ | Keycloak (OIDC + PKCE) |

## About the Design Files

The files in `design/` are **design references authored in HTML** — a working prototype showing intended look, copy, and behavior. They are **not production code to copy**.

The task is to **recreate these designs in the target codebase's environment**: per `reference/PLAN.md` that is **Angular 21 + PrimeNG + TailwindCSS** (Nx workspace, Angular Signals, RxJS; SSR for the customer app, CSR for admin), with a **Go + MongoDB** API behind it. Use the codebase's own component patterns and PrimeNG primitives — do not port the prototype's inline styles or its `.dc.html` runtime.

`design/Smart Cinema Platform.dc.html` opens in any browser. It carries every screen behind an in-design switcher:
- top bar: **Khách hàng / Customer** ↔ **Quản trị / Admin**
- customer sidebar: the 6 customer screen states
- admin sidebar: role switch (Cinema Manager / Head Office / System Admin), the full role-filtered menu, and a **Trạng thái dữ liệu** switch (normal / loading / empty / API error / 403)

## Fidelity

**High-fidelity** for layout, copy, color, type scale, and interaction logic — colors and text are final and should be matched. Two deliberate exceptions:

- The QR graphic is a **procedurally generated stand-in**, not a real encoded QR. Generate real codes server-side.
- The rating "face" icons are simple inline SVGs. Replace with the project's icon set (Phosphor duotone is the design-system default) keeping the same 5-step semantic.

---

## Design Tokens

Galaxy Cinema brand (from `reference/galaxy-cinema-brand-guide.md`):

```css
--color-primary:        #F26B38; /* Galaxy Orange — primary CTA, rating selection, chip selection */
--color-primary-hover:  #E95D29;
--color-primary-active: #D94F20;

--color-accent:         #034EA2; /* Galaxy Blue — nav, links, admin chrome, positive data */
--color-accent-hover:   #02458F;
--color-accent-active:  #013D80;

--color-error:          #DC2626; /* negative feedback, destructive actions, validation */
--color-success:        #16A34A;
--color-warning:        #F59E0B;

--color-bg:             #FFFFFF;
--color-surface:        #F5F5F5;
--color-text:           #1F2937;
--color-text-muted:     #6B7280;
--color-border:         #E5E7EB;
```

Ramps used for tinted fills / tag backgrounds:

```
blue   100 #eaf1fa · 200 #cbdcf1 · 300 #9dbde4 · 700 #013D80 · 800 #002f64
red    100 #fef2f2 · 200 #fee2e2 · 700 #b91c1c · 800 #991b1b
neutral 100 #F5F5F5 · 200 #E5E7EB · 300 #D1D5DB · 400 #9CA3AF · 500 #6B7280 · 800 #1F2937
orange tint for selected rating row: #FEF3ED
```

**Typography** — Source Serif 4 (400 / 600, plus true italic) for both headings and body; the serif *is* the UI chrome (no sans-serif). Base 15px / line-height 1.55.

```
h1 42px  h2 32px  h3 25px  h4 20px  h5 16px
h6 / label 13px, uppercase, letter-spacing .08em
kicker/label small 10–11px, uppercase, letter-spacing .10em
body 15px · table + input 14px · meta 12px · fine print 11px
English secondary line: 11px italic, --color-text-muted
Headings: line-height 1.12, letter-spacing -0.015em
```

**Spacing scale** (1.25× density): 5 / 10 / 15 / 20 / 30 / 40 px. Section rhythm in the admin app is 34–44px between blocks.

**Radius**: 1 / 2 / 4 px — effectively square. Buttons, inputs, tags: **2px**.

**Shadows**: `sm 0 1px 2px rgba(45,43,43,.14)` · `md 0 3px 10px rgba(45,43,43,.16)` · `lg 0 12px 32px rgba(45,43,43,.22)`. Elevation only for the QR card, print template, drawer, and dialog.

**Structural rule from the design system**: sections are separated by **whitespace**, not boxes, cards, or rules. The only borders that print are: the masthead thick(3px)/thin(1px) pair, table row rules (1px `--color-border`), input borders, and the dashed import dropzone. Do not wrap dashboard blocks in cards.

**Interaction states**: every interactive element gets a hover tint and a pressed state one ramp step past base; keyboard focus is `outline: 2px solid var(--color-accent); outline-offset: 2px` — never the browser default ring.

---

## Language

The UI is **bilingual by composition, not by toggle**: Vietnamese is the primary string; English sits beneath or beside it in 11px italic muted type. Keep this pattern — it doubles as the i18n key inventory. Copy in the prototype is final; lift it verbatim.

---

## Screens — Customer Website (mobile-first)

Frame: 390px wide, content padding 22px, scroll region ~720px. Every tap target ≥ 44px. No horizontal scroll at 320px.

### C1. Feedback Form — `/f/:qrToken`

Layout, top to bottom:

1. **Header row** — Galaxy logo (112×34, `object-fit: contain`), `VI / EN` marker right-aligned, 11px uppercase muted. Padding 6px top / 18px bottom.
2. **Title** — `Đánh giá trải nghiệm` (h1, 31px) + `Rate your experience` (11px italic muted).
3. **Dateline** — `05/09/2026 • 21:59`, 13px, muted. Rendered from **server time**, not client time; display in `Asia/Ho_Chi_Minh`.
4. **Question** — `Trải nghiệm của bạn hôm nay thế nào?` 17px, with `How was your visit today?` beneath in italic muted.
5. **Rating — icon + text rows** (this replaced an emoji-only row):
   - 5 full-width buttons, `flex-direction: column`, gap 8px, each `min-height: 52px`, padding 8px 12px, radius 2px, `background: #FFFFFF`, `border: 1px solid #E5E7EB`.
   - Row content, left → right: **value numeral** (26px wide, centered, serif 600 15px, muted → `#F26B38` when selected) · **label block** (VI 15px on line 1, EN 11px italic muted on line 2) · **face icon** (22×22, stroke 1.6, `#9CA3AF` → `#F26B38` when selected).
   - Selected: `border: 1px solid #F26B38`, `box-shadow: inset 0 0 0 1px #F26B38`, `background: #FEF3ED`.
   - Scale: 1 `Rất không hài lòng / Very unhappy` · 2 `Không hài lòng / Unhappy` · 3 `Bình thường / Neutral` · 4 `Hài lòng / Happy` · 5 `Rất hài lòng / Delighted`. Short forms used in admin tables: `Rất kém · Chưa tốt · Bình thường · Hài lòng · Rất tốt`.
   - Selecting a rating **clears any selected reasons** (the reason set changes).
6. **Reasons** — appears only once a rating exists. Prompt is rating-dependent: `Điều gì làm bạn hài lòng?` for 4–5, `Bạn muốn chia sẻ điều gì?` for 1–3; sub-line `Select all that apply — optional`. Wrapping row of chips, gap 8px, `min-height: 40px`, 13px, radius 2px. Selected chip: solid `#F26B38`, white text. Multi-select, optional.
   - Positive (4–5): Thân thiện · Tư vấn rõ ràng · Phục vụ nhanh · Chủ động hỗ trợ · Thanh toán thuận tiện · Sản phẩm tốt · Khác
   - Negative (1–3): Thái độ phục vụ · Tư vấn chưa rõ · Thời gian chờ lâu · Đơn hàng chưa chính xác · Thanh toán · Chất lượng sản phẩm · Khác
   - Both lists are **server-driven config**, not hard-coded.
7. **Fields** — gap 16px, inputs `min-height: 46px`, `font-size: 16px` (prevents iOS zoom):
   - `Họ và tên * / Full name`, placeholder `Nguyễn Văn A`
   - `Số điện thoại * / Phone number`, `inputmode="tel"`, placeholder `0912 345 678`
   - `Chia sẻ thêm / Anything else` — textarea, min-height 84px, placeholder `Không bắt buộc / Optional`
8. **Consent** — 22×22 checkbox + `Tôi đồng ý cho rạp sử dụng thông tin trên để ghi nhận và cải thiện chất lượng dịch vụ.` with `Chính sách bảo mật` link (opens C6). Required.
9. **Submit** — full-width primary, `min-height: 50px`, 16px, label `GỬI ĐÁNH GIÁ` → `Đang gửi…` while in flight (button disabled). Footnote: `Chỉ mất 15–30 giây · Takes 15–30 seconds`.

**Validation** (inline, 12px, `#DC2626`, shown only after a submit attempt):

| Field | Rule | Message |
|---|---|---|
| Rating | required | `Vui lòng chọn mức đánh giá / Rating is required` |
| Full name | required, trim, 2–100 chars | `Vui lòng nhập họ tên / Name is required` · `Tối thiểu 2 ký tự` |
| Phone | required, matches `^(0\d{9}\|\+?84\d{9})$` after stripping non `[0-9+]` | `Vui lòng nhập số điện thoại / Phone is required` · `Số điện thoại không đúng định dạng Việt Nam` |
| Consent | must be checked | `Cần đồng ý để gửi đánh giá / Consent required` |

Normalize the phone to a single stored format (`84912345678`) before persisting.

### C2. Thank you
Left-aligned, 80px top padding. `✓` 40px · `Cảm ơn bạn!` h1 31px · `Thank you — your feedback was recorded` · body confirming the recorded timestamp · secondary button `Gửi đánh giá khác / Send another` which resets the whole form.

### C3. Invalid / disabled / revoked QR
One generic screen for **all** failure causes (token not found, QR disabled or revoked, staff inactive, cinema inactive). Kicker `QR không hợp lệ / Invalid QR` in `#DC2626`, h1 `Mã QR hiện không khả dụng`, body `Vui lòng liên hệ nhân viên tại rạp để được hỗ trợ.`, secondary `Thử lại / Retry`. **Never** surface technical detail.

### C4. Submit / API error
Kicker `Lỗi hệ thống / System error`, h1 `Không gửi được đánh giá`, body promising the entered answers are preserved, full-width primary `Gửi lại / Try again`. Do not clear the form.

### C5. Loading skeleton
SSR-first, so this is short-lived: 7 stacked `#F5F5F5` blocks matching the form's rhythm (34px title, 14px dateline, 64px rating, 44 / 44 / 90 / 44) plus `Đang tải biểu mẫu… / Loading`.

### C6. Privacy policy
Back link, h1 `Chính sách bảo mật`, `Privacy policy · consent version v1`, three 14px paragraphs: purpose of collection, no marketing use, how to request deletion. Store `consent.version` + acceptance time with each record.

**Customer app must also**: send `<meta name="robots" content="noindex,nofollow">` on `/f/:qrToken`; never render staff code, staff name, internal ids, or the raw token as text.

---

## Screens — Admin Website (desktop-first)

**Masthead** (revised — replaces the earlier boxed-button top bar): 3px rule, then one baseline row, then a 1px rule. Left: `SMART CINEMA PLATFORM` serif 600 26px `#034EA2`, kicker `GALAXY CINEMA · TRANSACTION FEEDBACK QR` beneath. Right: a **utility rail** — one row of 13px serif items on a shared baseline, separated by 1px full-height hairlines (`--color-border`), **no boxed buttons, no button borders, no filled backgrounds**:

1. scope text `Toàn hệ thống · 6 rạp` (or the manager's cinema) at 58% ink — context, not a control;
2. `Thông báo` ghost link with the unread count as an 11px 600 **superscript numeral in red**, not a pill — hidden at zero; click → notification inbox;
3. account button `manager.gnd` (600) + role in 11px italic muted + a 10px `▾` caret. It opens a small `--shadow-md` menu (min-width 206px, no border, 8px below the baseline) with `Tài khoản của tôi` · `Đổi mật khẩu` · `Đăng xuất` (last item separated by a 1px rule and set in red-800).

The old layout put two boxed buttons and two loose text links side by side, which read as four unrelated objects and contradicted the system's no-box rule — everything on the right is now one typographic rail, and `Tài khoản` / `Đăng xuất` live inside the account menu instead of the rail.

The masthead sits over a two-column grid — sidebar `minmax(200px, 232px)`, main `minmax(0, 1fr)`, gap 34px, page padding 24px 30px 60px. Sidebar is `position: sticky; top: 16px`.

**Sidebar**: role switcher, then nav groups (h6 label + 13px items, active item = solid `#034EA2` with white text, radius 2px), then the data-state switcher (prototype-only affordance — do not ship).

**Role-filtered menu** (backend must enforce, not just route guards):

| Group | Items | Cinema Manager | Head Office / System Admin |
|---|---|---|---|
| Tổng quan | Menu chức năng (module launcher), Dashboard | own cinema | all cinemas |
| Feedback | Tất cả feedback, Phân tích | own cinema | all |
| Nhân viên | Danh sách, Import, Quản lý QR | own cinema | all |
| Hiệu suất | Ranking nhân viên (+ Ranking rạp) | staff only | staff + cinema |
| Coaching | Coaching cases | ✅ | ✅ |
| Cấu hình | Rating, Lý do feedback | ❌ | ✅ |
| Thông báo | Hộp thư thông báo, Quy tắc & kênh gửi | inbox + rules read-only | inbox + rules editable |
| Hệ thống | Rạp, Người dùng, Audit log | audit (own cinema) only | ✅ |

### A0. Module launcher — post-login menu

Landing screen **after login** (the login button routes here, not to the dashboard). Phase 1 ships one live module, but the launcher exists from day one so navigation and permissions don't get rebuilt when phase 2 lands.

- Kicker `Sau đăng nhập`, h2 `Chọn chức năng`, English sub-line `Module launcher — Smart Cinema Platform`, then an identity line: `manager.gnd · Cinema Manager · Galaxy Nguyễn Du — chỉ hiện các module bạn có quyền truy cập.`
- Grid `repeat(auto-fill, minmax(280px, 1fr))`, gap 20px, max-width 1000px. Each tile is the design system's `.card` (the one boxed component — legitimate here, these are discrete listings), min-height 184px.
- Tile content: module code kicker (`FBQ`, letter-spacing .08em) + phase tag · title VI · English sub-line italic · one-line description · footer row with meta left and action right.
- **Live module**: phase tag tinted blue (`Phase 1 · Đang chạy`), meta `187 feedback hôm nay`, action `Vào chức năng →` in blue-700 600; whole card clickable → Dashboard.
- **Placeholder modules**: card at 55% opacity, neutral phase tag, action `Chưa mở` at 50% with `pointer-events: none`; clicking the card raises the toast `Chức năng thuộc Phase 2 — chưa mở trong bản này`.
- Seed modules: `FBQ` Transaction Feedback QR (Phase 1, live) · `BOX` Bán vé & Suất chiếu · `FNB` F&B & Combo (Phase 2, Q4/2026) · `CRM` Khách hàng thân thiết · `WFM` Ca làm & Chấm công · `OPS` Vận hành rạp (Phase 3, đang khảo sát).
- Module visibility comes from the **Keycloak role / entitlement list**, not a hard-coded array; an unentitled module is hidden, a not-yet-built one is shown disabled.

### A1. Dashboard (Cinema Manager / Head Office)
- Kicker + h2 change per role: `Cinema Manager · Galaxy Nguyễn Du` / `Dashboard rạp Nguyễn Du` vs `Head Office · toàn hệ thống` / `Dashboard toàn hệ thống`.
- **Filter bar**: segmented date range (Hôm nay / Hôm qua / 7 ngày / 30 ngày / Tuỳ chọn), cinema `<select>` (Head Office only), `Bao gồm feedback nghi vấn` checkbox (**default off**), `Xuất CSV`.
- **KPI row**: `repeat(auto-fit, minmax(140px, 1fr))`, gap 26px. Each = 10px uppercase label + serif 600 number + 11px italic English. Total feedback (40px, `#034EA2`) · Average rating (40px, `#F26B38`) · Positive 85% (34px, blue-700) · Neutral 8% · Negative 7% (`#B91C1C`) · Eligible staff for ranking.
- **Charts** (two columns, `minmax(300px, 1fr)`, gap 40px):
  - *Feedback volume trend* — 14-point SVG polyline, blue 2px, plus a dashed magenta-free red 1.5px average-rating line on its own scale, baseline rule, 11px legend.
  - *Rating distribution* — 5 rows `104px | 1fr | 62px`: `5 · Rất tốt` label, 12px track (`#F5F5F5`) with fill (blue for 4–5, `#9CA3AF` for 3, `#DC2626` for 1–2), then `count · pct`.
- **Reason bars** — two columns, positive (blue) and negative (red): label 13px over an 8px track, count right-aligned.
- **Cinema comparison** (Head Office only) — table: Rạp / Feedback / Điểm TB / Phân bố (inline bar) / Tiêu cực. Row click → drill down.
- **Staff table** — Nhân viên (code bold + name) / Rạp / Feedback / Điểm / Tích cực / Tiêu cực / `Chi tiết →`. Row click → A9.

### A2. Feedback list
Filter bar: search (name or phone), date range, rating select (Tất cả / 1–2 / 3 / 4–5), staff select, reason select, `Chỉ nghi vấn` checkbox, `Xuất CSV`. Table (min-width 900px, horizontal scroll): Thời gian / Điểm (tag `2 · Chưa tốt`, tinted by band) / Khách hàng / Điện thoại (**masked** `09••••5678` unless the role needs full) / Nhân viên (code) / Rạp / Lý do (`·`-joined) / Cờ (`⚑` when suspicious). Footer: `1–8 trong 953` + prev/next. Row click → A3.

### A3. Feedback detail — right side drawer
`min(460px, 100%)`, full height, `--shadow-lg`, padding 26px 28px, scrim `rgba(17,24,39,.45)`; closes on scrim click or ✕. Content: kicker `Feedback detail` + h3 timestamp · face icon 34px + `2 / 5` + label + suspicious tag · label/value blocks for Khách hàng, Nhân viên, Rạp, Lý do (tag chips), Bình luận (italic, quoted) · metadata block (QR token, ipHash, consent version, `createdAt` UTC server time) · actions `Xem hiệu suất nhân viên`, `Tạo coaching`.

### A4. Feedback analytics
Sentiment donut (SVG stroke-dasharray: 85 / 8 / 7 in blue / neutral-400 / red, 130px) with legend, and a *by hour of day* column chart (10h→23h, blue-300 columns, 130px tall).

### A5. Staff list
Search + status filter; right-aligned `Import Excel/CSV` and primary `+ Thêm nhân viên`. Table: Mã / Họ tên / Rạp / Trạng thái tag / QR tag (Active · Disabled · Revoked · Chưa tạo) / Cập nhật / row actions `Hiệu suất`, `QR`. Create dialog fields: `Staff Code *`, `Họ tên *`, `Rạp *` (auto-assigned and locked for Cinema Manager).

### A6. Import staff (3 steps)
Step indicator: three blocks with a 3px left border (`#034EA2` active, `#E5E7EB` + 50% opacity otherwise).
1. **Upload** — dashed dropzone (1px dashed `#9CA3AF`, radius 4px, padding 44px 30px, `#F5F5F5`), `Kéo tệp .xlsx / .csv vào đây`, primary `Chọn tệp`, plus `↓ Tải template mẫu` and the column list `Staff Code · Full Name · Cinema Code`.
2. **Validate & preview** — counters Tổng 100 / Hợp lệ 95 (blue-700) / Lỗi 5 (red-700); table Dòng / Staff Code / Họ tên / Cinema Code / Kết quả tag. Error messages: `Staff code đã tồn tại`, `Thiếu staff code`, `Cinema code không tồn tại`. Actions: `Xác nhận import 95 dòng`, `↓ Tải file lỗi`, `Huỷ`. **Nothing is written before confirm.**
3. **Result** — `Đã import 95 nhân viên`, `5 dòng bị bỏ qua · ghi audit log IMPORT_STAFF`, actions `Generate QR cho nhân viên mới`, `↓ Tải file lỗi`, `Import tệp khác`.

### A7. QR management
Filter row + primary `Generate QR cho tất cả`. Two columns — `minmax(0,1.35fr)` table, `minmax(280px,.65fr)` sticky preview panel.
- Table: Mã / Họ tên / QR tag / Cập nhật / action (`Xem` or `Generate`). Selected row tinted `rgba(3,78,162,.09)`.
- Preview panel: h4 `QR — GS025` + `name · cinema`. If not generated: `#F5F5F5` panel, `Chưa có QR`, primary `Generate QR`. If generated: white card with `--shadow-sm`, 25×25 module grid (4px modules, 1px gap; 6px in the print template), the public URL `smart.cinema.vn/f/**TOKEN**`, buttons `Copy URL` · `PNG` · `SVG` · `Mẫu in` (primary), then ghost `Regenerate` and destructive-ghost `Disable`. Note: QR is fixed per staff; changing POS station does not change the QR; regenerate revokes the old token immediately.
- **Print template** (opens below): A6 card 298px wide on white, `--shadow-md`, centered: logo · QR in a 1px `#E5E7EB` box with 12px safe-zone padding · `QUÉT MÃ ĐỂ ĐÁNH GIÁ / TRẢI NGHIỆM CỦA BẠN` serif 600 19px · `Scan to rate your experience` 12px italic · `Chỉ mất 15–30 giây` 13px blue-700 · dotted footer with staff code + token at 9px, letterspaced (manager metadata only — **never the staff name**). Beside it: print requirements (QR ≥ 35mm, high contrast, plain white ground, safe zone ≥ 4 modules, no image backgrounds) and format tags (A6 card, A5 poster, 80×80 sticker, tent card). Actions `↓ PDF`, `In`, `Đóng`.

### A8. Ranking (staff / cinema)
Eligibility note in a `#F5F5F5` inline block: `Cần tối thiểu 20 feedback để vào ranking · minimumFeedbackForRanking = 20`. Two tables side by side — `Top` and `Cần cải thiện` (bottom scores in red-700) — columns #, unit, Điểm, Feedback. Below: `Chưa đủ điều kiện` table with `Not eligible` neutral tags (e.g. GS041 · 5.00 · 1 feedback).

### A9. Staff performance detail
Back link → Dashboard. Header: kicker `Staff performance detail`, h2 name, meta `GS018 · Galaxy Nguyễn Du · Active` tag, right-aligned primary `Tạo coaching`. KPI row: Feedback / Điểm TB / Tích cực / Tiêu cực / Xếp hạng (`#3 / 7`). Charts: *rating trend* with a dashed red coaching marker at the coaching date (`Coaching 29/08`, 9px label) so before/after is legible, and *reason distribution* bars in red. Two tables: `Feedback tiêu cực gần nhất` (rows open A3) and `Lịch sử coaching`.

### A10. Coaching cases
Segmented status filter (Tất cả / Open / In progress / Completed) + primary `+ Tạo coaching`. Table: Nhân viên / Chủ đề / Hành động / Follow-up / Trạng thái tag / Người tạo. Lifecycle strip: `OPEN → IN_PROGRESS → COMPLETED · CANCELLED`. Create dialog: Chủ đề, Hành động, Ngày follow-up; new cases start OPEN.

### A11. Rating configuration
Two columns — editor `minmax(0,1fr)` and sticky live preview `minmax(260px,340px)`.
- `Kiểu hiển thị / ratingType` segmented: **ICON+TEXT** (current production choice), STAR, BUTTON, TEXT.
- Table: Giá trị / Icon (22px face) / Nhãn hiển thị (editable input) / Bật (checkbox) / reorder `↑ ↓`.
- Live preview renders the actual customer control for the chosen type.
- `Lưu cấu hình` writes config and an audit entry; changing rating type must **not** require a frontend deploy.

### A12. Feedback reason configuration
Table: Mã (`<code>`) / Nhãn (VI + EN italic) / Loại tag (POSITIVE blue · NEGATIVE red · BOTH neutral) / Áp dụng cho rating (five 20px squares, filled `#034EA2` when in range) / Bắt buộc / Trạng thái (ACTIVE · DISABLED) / reorder. Seed set: FRIENDLY, FAST, CLEAR (4–5) · WAIT, CONSULTING (1–3) · ATTITUDE (1–2, required) · PAYMENT (disabled) · OTHER (1–5).

### A13–A15. Cinemas · Users · Audit log
- **Cinemas**: Code / Tên rạp / Nhân viên / Trạng thái / Sửa.
- **Users**: Username (`<code>`) / Họ tên / Role tag / Phạm vi rạp / Trạng thái (Active · Locked) / Sửa — mapped to Keycloak accounts.
- **Audit log**: three-column rows `130px | 160px | 1fr` — time, actor, `ACTION` in blue-700 + target. Must log GENERATE_QR, REGENERATE_QR, DISABLE_QR, CREATE/UPDATE/DISABLE_STAFF, IMPORT_STAFF, UPDATE_FEEDBACK_CONFIG, coaching create/update/complete, cinema and permission changes.

### A17. Notification inbox — `Thông báo`

Reachable from the nav group **Thông báo** and from the sidebar bell button above the menu (`Thông báo` + unread count in a magenta tag; hidden when zero).

- Filter pills with counts: `Tất cả (7)` · `Chưa đọc (4)` · `Cảnh báo (2)` · `Hệ thống (3)` · `Báo cáo (1)`. Right side: ghost `Đặt lại chưa đọc` (prototype affordance) + secondary `Đánh dấu tất cả đã đọc`.
- List rows, `8px | 1fr | auto` grid, 16px vertical padding, separated by 1px row rules (this is a list, so rules are correct — do not wrap rows in cards). Read rows drop to 62% opacity and their title to weight 400.
- Column 1 is the unread dot (8px): magenta for `ALERT`, blue otherwise, transparent when read.
- Column 2: kind tag + `05/09 21:59 · 2 phút trước`, then a 16px title and a 14px body at 70% ink.
- Column 3: secondary CTA that deep-links to the relevant screen (`Xem feedback`, `Mở Import`, `Mở case`, `Quản lý QR`, `Mở phân tích`) — opening it marks the item read — plus a ghost `Đánh dấu đã đọc` toggle.
- Kinds: `ALERT` (red tag — needs action this shift) · `SYSTEM` (neutral — import, QR, suspicious detection) · `DIGEST` (neutral — scheduled report) · `TASK` (blue — coaching follow-up due).
- Empty state: `Không có thông báo` + `Bạn đã đọc hết thông báo.` (unread filter) or `Chưa có thông báo nào trong bộ lọc này.`
- Retention: notifications kept 90 days, then archived. Read state is per user, not per cinema.

Seed items in the prototype: NEG_BURST alert for GS018 · new 1★ feedback · suspicious duplicate phone · import finished 95/5 · coaching due for GS031 · daily digest for 04/09 · QR revoked for GS040.

### A18. Notification rules & channels — `Quy tắc & kênh gửi`

Head Office edits; Cinema Manager sees a read-only view with the note `Vai trò Cinema Manager chỉ xem được quy tắc áp dụng cho rạp mình. Chỉnh sửa thuộc Head Office.`

**Rules table** (min-width 900px): Mã (`<code>`) / Sự kiện / Điều kiện / Người nhận / Kênh / Trạng thái tag / `Sửa`.

| Mã | Điều kiện | Người nhận | Kênh | Mặc định |
|---|---|---|---|---|
| `NEG_INSTANT` | rating ≤ 2 | Cinema Manager | In-app, Email | Bật |
| `NEG_BURST` | ≥ 3 feedback ≤ 2★ / 60 phút cùng nhân viên | CM + Head Office | In-app, Email, Zalo OA | Bật |
| `SUSPICIOUS` | trùng SĐT trong 10 phút | Cinema Manager | In-app | Bật |
| `DAILY_DIGEST` | 08:00 hằng ngày | CM + Head Office | Email | Bật |
| `WEEKLY_RANK` | Thứ 2, 09:00 | Head Office | Email | Bật |
| `COACH_DUE` | trước hạn 2 ngày | người tạo case | In-app, Email | Bật |
| `QR_EVENT` | mọi thay đổi QR | System Admin | In-app | Tắt |

**Channels panel**: In-app (always on, cannot be disabled) · Email (Head Office SMTP) · Zalo OA (NEG_BURST only) · SMS (off — phase 2).

**Throttling rules** (implement server-side, not in the UI): quiet hours 23:00–07:00 suppress Email/Zalo and roll into the next morning digest; max one alert of the same kind per staff member per 30 minutes.

**Delivery log**: last 24h — Thời gian / Quy tắc / Người nhận / Kênh / Kết quả tag (`Đã gửi` blue · `Đã đọc` neutral · `Thất bại` red). Failures must be retryable and visible; do not swallow them.

### A16. Login
400px column: kicker `Keycloak · OIDC + PKCE`, h2 `Đăng nhập quản trị`, username + password (42px inputs), inline error `Sai tên đăng nhập hoặc mật khẩu.`, full-width primary → **A0 module launcher**, `Quên mật khẩu?` link.

### Admin cross-cutting states
- **Loading** — skeleton blocks in `#F5F5F5` mirroring the dashboard rhythm (label, title, 4 KPI blocks, chart, 4 fading table rows).
- **Empty** — `Chưa có feedback nào` + explanation + actions `Đến QR Management`, `Mở rộng khoảng ngày`.
- **API error** — kicker `API error · request-id 8f2c…` in red, `Không tải được dữ liệu`, retry. Always surface a request id.
- **403** — `403 · Permission denied`, `Bạn không có quyền xem nội dung này`, note that scope is enforced server-side, action back to own dashboard.
- **Confirm dialogs** — `min(440px,100%)`, `#F5F5F5`, radius 4px, `--shadow-lg`, gap 15px, actions right-aligned. Destructive confirms (Regenerate, Disable) use a **red** primary; batch/create use orange. Copy:
  - *Batch*: `Generate QR cho tất cả nhân viên?` — only missing QRs are created; existing ones untouched; ZIP/PDF package after.
  - *Regenerate*: old token invalid immediately, printed cards must be reprinted.
  - *Disable*: QR stops accepting feedback, customer sees the generic message, action is audited.
- **Toast** — centered bottom, `#111827` on white text, radius 2px, 14px, auto-dismiss 2.2s. Used for copy URL, PNG/SVG/PDF download, print, save, and post-confirm results.

---

## Interactions & Behavior

| Trigger | Result |
|---|---|
| Pick rating | reasons list swaps (positive ↔ negative), selected reasons cleared |
| Submit with invalid form | no request; inline errors appear (only after first attempt) |
| Submit valid | button disabled, label `Đang gửi…`, ~900ms, → thank-you |
| Thank-you `Send another` | full form reset |
| Consent link | → privacy screen; back link returns to the form with values intact |
| Admin row click (feedback) | opens right drawer |
| Drawer scrim / ✕ | closes; inner clicks must `stopPropagation` |
| Staff row / dashboard staff row | → staff performance detail |
| QR row | selects row, updates sticky preview, closes print template |
| `Mẫu in` | reveals the print template block below the table |
| Batch / regenerate / disable | confirm dialog → toast, plus audit entry |
| Role switch | menu re-filters and dashboard scope changes; **the server must re-authorize** |

No decorative animation. Transitions, where present, are ≤ 150ms opacity/background only.

## State Management

Customer: `rating`, `reasons[]`, `name`, `phone`, `comment`, `consent`, `submitAttempted`, `submitting`, `screen` (form / thanks / invalid / error / privacy / loading). Config (`ratingType`, rating levels, reason list) arrives from `GET /api/v1/public/feedback-config` and the token validation from `GET /api/v1/public/feedback/:qrToken` during SSR.

Admin: `role` + `cinemaScope` (from the token, never client-selectable in production), `activeScreen`, `dateRange`, `cinemaFilter`, `includeSuspicious` (default false), table `filters` + `page`, `selectedFeedbackId` (drawer), `selectedStaffId`, `importStep` + parsed rows, `dialog`, `toast`.

Data: `POST /api/v1/public/feedback` on submit; admin endpoints per `reference/PLAN.md` §30. `createdAt` is **server time, stored UTC**, displayed `Asia/Ho_Chi_Minh`. Rate-limit public endpoints by IP and by QR token; flag rather than delete suspicious records; exclude them from KPIs by default.

## Assets

- **Galaxy logo** — `https://www.galaxycine.vn/_next/static/media/logo-glx-header.8bbdac6e.png` (header PNG) and `https://www.galaxycine.vn/media/2024/11/11/glx-footer.svg` (SVG, preferred for print). Prototype mounts them through `image-slot.js`, which is a prototyping affordance only — use a plain `<img>`/inline SVG in the app.
- **Rating face icons** — inline SVG in the prototype; swap for the project icon set (Phosphor duotone).
- **QR modules** — placeholder pattern; generate real codes server-side (PNG + SVG + print PDF).
- **Fonts** — Source Serif 4 (Google Fonts: `ital,wght@0,400;0,600;1,400`).

## Files

```
design/Smart Cinema Platform.dc.html   the full prototype — open in a browser
design/image-slot.js                   image placeholder helper (prototype only)
design/broadsheet-styles.css           base design-system tokens + component CSS
design/support.js                      prototype runtime (required for the .dc.html to open offline)
design/_ds_bundle.js                   design-system runtime the prototype loads
reference/PLAN.md                      the original product & technical plan (source of truth for scope, API, data model, sprints)
reference/galaxy-cinema-brand-guide.md brand colors, tokens, logo URLs
```

Read `reference/PLAN.md` alongside this README: it carries the MongoDB collections and indexes, the API surface, the permission matrix, the Go service structure, security/privacy requirements, and the sprint plan. This README carries the visual and behavioral specification.
