# SMART CINEMA PLATFORM — PLAN.md

> Product & Design Plan  
> Phase 1 ưu tiên: **Transaction Feedback QR**  
> Mục đích tài liệu: dùng làm đầu vào cho Claude/AI Design để thiết kế UI/UX và làm cơ sở triển khai hệ thống.

---

## 1. Tổng quan dự án

Xây dựng một **Smart Cinema Platform** dùng chung cho 4 bài toán vận hành:

1. **Transaction Feedback QR** — thu thập đánh giá khách hàng gắn với đúng nhân viên.
2. **Service Recovery Code** — số hóa quy trình cấp và xác thực mã bồi hoàn/tri ân.
3. **Smart Cinema QR** — báo sự cố vận hành theo khu vực/thiết bị.
4. **Smart Seat QR** — khách báo sự cố/yêu cầu hỗ trợ trực tiếp tại ghế.

Không xây 4 hệ thống độc lập. Các module sẽ dùng chung:

- Authentication / Authorization
- Cinema Management
- Staff Management
- QR Management
- Dashboard / Analytics
- Audit Log
- Configuration
- Shared UI / Design System

**Module triển khai đầu tiên:** Transaction Feedback QR.

---

# 2. Mục tiêu Phase 1 — Transaction Feedback QR

## 2.1. Pain point

Hiện tại feedback chưa xác định rõ được nhân viên trực tiếp phục vụ khách, gây khó khăn cho:

- Đánh giá chất lượng phục vụ theo nhân viên.
- Xác định nguyên nhân feedback thấp.
- Coaching đúng người, đúng vấn đề.
- Ranking nhân viên.
- So sánh chất lượng dịch vụ giữa các rạp.

## 2.2. Giải pháp MVP

Mỗi nhân viên có **01 QR cố định**.

QR được:

- Generate từ trang Admin.
- Gắn/đặt tại máy POS nơi nhân viên đang phục vụ.
- Không cần tích hợp với POS.
- Không hiển thị QR động trên màn hình POS.
- Không cần liên kết transaction trong Phase 1.

Khi khách scan QR:

```text
QR
↓
Customer Website
↓
Hệ thống xác định nhân viên tương ứng
↓
KHÔNG hiển thị tên/mã nhân viên cho khách
↓
Hiển thị ngày + giờ hiện tại
↓
Khách nhập thông tin + đánh giá
↓
Submit
↓
Lưu 1 feedback record
↓
Dashboard / Ranking / Coaching
```

Thông tin cốt lõi của một feedback:

```text
Staff
Cinema
Feedback Time
Customer Name
Customer Phone
Rating
Feedback Reasons
Comment
```

---

# 3. Quyết định đã chốt

## 3.1. QR

- QR là **cố định theo từng nhân viên**.
- Một nhân viên chỉ thuộc **01 rạp**.
- Nhân viên có thể đổi quầy POS nhưng QR vẫn giữ nguyên.
- QR được đặt tại máy POS.
- Admin/Manager có thể generate QR.
- Có thể generate:
  - QR riêng lẻ
  - QR hàng loạt cho tất cả nhân viên của rạp
- Có thể:
  - Preview
  - Download PNG
  - Download SVG
  - Download mẫu in hoàn chỉnh
  - Print
  - Disable
  - Regenerate

## 3.2. URL QR

Không expose trực tiếp staff code.

Không dùng:

```text
/feedback/GS025
```

Nên dùng public token:

```text
/f/X7M4Q9AKP2
```

Mapping nội bộ:

```text
X7M4Q9AKP2 → Staff GS025
```

Mục tiêu:

- Không để khách đoán mã nhân viên khác.
- Không để staff code xuất hiện trên public URL.
- QR có thể revoke/regenerate.

---

# 4. Kiến trúc hệ thống

## 4.1. Tổng quan

```text
                         INTERNET
                            │
                    Reverse Proxy / LB
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   CUSTOMER WEBSITE     ADMIN WEBSITE        API
   Angular 21 SSR       Angular 21 CSR       Go
          │                 │                 │
          └─────────────────┴────────┬────────┘
                                     │
                                   MongoDB

                          Admin Authentication
                                     │
                                  Keycloak
```

## 4.2. Domain gợi ý

```text
smart.galaxycine.vn
admin.smart.galaxycine.vn
api.smart.galaxycine.vn
auth.smart.galaxycine.vn
```

Tên domain nên đủ rộng để chứa cả 4 module trong tương lai.

---

# 5. Technology Stack

## Frontend

### Customer Website

- Angular 21
- Angular SSR
- PrimeNG
- TailwindCSS
- Angular Signals
- RxJS
- Responsive mobile-first
- SEO technical support
- Các trang feedback QR phải `noindex,nofollow`

### Admin Website

- Angular 21
- CSR
- PrimeNG
- TailwindCSS
- Angular Signals
- RxJS
- Responsive desktop-first, tablet-friendly

## Backend

- Go
- Gin hoặc Fiber
- MongoDB
- MongoDB Official Go Driver
- Repository Pattern
- OpenAPI
- Structured Logging
- Request ID
- Validation middleware

> Không bắt buộc dùng ORM. Với MongoDB, ưu tiên official driver + repository pattern để thuận tiện cho aggregation/reporting.

## Authentication

Sử dụng **Keycloak**.

Yêu cầu:

- Open source
- Username/password
- OIDC/OAuth2
- Authorization Code + PKCE
- Role-based access
- Password policy
- Session management
- Refresh token
- Account lock / disable
- Có khả năng mở rộng AD/LDAP/SSO trong tương lai

Customer Website không cần login.

---

# 6. Cấu trúc frontend

Khuyến nghị Nx Workspace.

```text
frontend/
│
├── apps/
│   ├── smart-admin/
│   └── smart-customer/
│
└── libs/
    ├── core/
    │   ├── auth/
    │   ├── api/
    │   └── config/
    │
    ├── data-access/
    │   ├── feedback/
    │   ├── staff/
    │   ├── cinema/
    │   ├── qr/
    │   └── coaching/
    │
    ├── feature/
    │   ├── dashboard/
    │   ├── feedback/
    │   ├── staff/
    │   ├── qr/
    │   ├── ranking/
    │   └── coaching/
    │
    └── ui/
```

---

# 7. Roles & Permissions

## 7.1. Roles

### SYSTEM_ADMIN

Quản lý hệ thống:

- Cinema
- User
- Role
- Global configuration
- Feedback configuration
- Audit logs
- Staff toàn hệ thống
- QR toàn hệ thống

### HEAD_OFFICE

Có thể:

- Xem tất cả rạp
- Xem feedback toàn hệ thống
- Xem ranking tất cả rạp
- Xem ranking staff toàn hệ thống
- Xem analytics so sánh rạp
- Quản lý cấu hình feedback
- Xem coaching
- Xem audit

### CINEMA_MANAGER

- Chỉ thuộc **01 rạp**
- Chỉ xem staff của rạp mình
- Chỉ xem feedback của rạp mình
- Chỉ xem dashboard của rạp mình
- Quản lý staff của rạp mình
- Import staff
- Generate QR
- Download/print QR
- Tạo coaching
- Xem ranking nội bộ rạp

## 7.2. Permission Matrix

| Feature | Cinema Manager | Head Office | System Admin |
|---|:---:|:---:|:---:|
| Dashboard của rạp | ✅ | ✅ | ✅ |
| Dashboard toàn hệ thống | ❌ | ✅ | ✅ |
| Staff của rạp | ✅ | ✅ | ✅ |
| Staff rạp khác | ❌ | ✅ | ✅ |
| Import Staff | ✅ | ✅ | ✅ |
| Generate QR | ✅ | ✅ | ✅ |
| Feedback của rạp | ✅ | ✅ | ✅ |
| Feedback rạp khác | ❌ | ✅ | ✅ |
| Ranking trong rạp | ✅ | ✅ | ✅ |
| Ranking toàn hệ thống | ❌ | ✅ | ✅ |
| Feedback Configuration | ❌ | ✅ | ✅ |
| Cinema Management | ❌ | ✅ | ✅ |
| User Management | ❌ | Optional | ✅ |
| Coaching | ✅ | ✅ | ✅ |
| Audit Logs | Rạp mình | ✅ | ✅ |

> Backend phải enforce permission. Không rely vào Angular route guard.

---

# 8. Customer Website — UX Flow

## 8.1. Route

```text
/f/:qrToken
```

Ví dụ:

```text
https://smart.galaxycine.vn/f/X7M4Q9AKP2
```

## 8.2. Flow

```text
Customer scan QR
↓
SSR request
↓
Validate QR token
↓
Validate staff active
↓
Validate cinema active
↓
Load feedback configuration
↓
Render feedback form
↓
Customer input
↓
Consent
↓
Submit
↓
Backend creates feedback
↓
Thank-you screen
```

## 8.3. Không hiển thị

Tuyệt đối không hiển thị cho khách:

- Staff Code
- Staff Name
- Internal Staff ID
- Cinema internal ID
- QR token raw dưới dạng text

## 8.4. Hiển thị

Hiển thị:

- Galaxy Cinema branding
- Tiêu đề đánh giá
- Ngày hiện tại
- Giờ hiện tại
- Rating
- Customer Name
- Customer Phone
- Reasons
- Comment
- Privacy consent
- Submit

Ví dụ:

```text
GALAXY CINEMA

ĐÁNH GIÁ TRẢI NGHIỆM

05/09/2026 • 21:59

Trải nghiệm của bạn hôm nay thế nào?

😡    🙁    😐    🙂    😍

Họ và tên *
[____________________________]

Số điện thoại *
[____________________________]

Bạn muốn chia sẻ điều gì?
[ Dynamic reasons ]

Chia sẻ thêm
[..............................]
[..............................]

☑ Tôi đồng ý cho phép Galaxy Cinema sử dụng
  thông tin trên để ghi nhận và cải thiện chất lượng dịch vụ.

[ GỬI ĐÁNH GIÁ ]
```

---

# 9. Date & Time

Customer UI có thể hiển thị thời gian hiện tại.

Nhưng backend phải là nguồn dữ liệu chính.

Không dùng thời gian client làm `createdAt`.

Backend:

```text
createdAt = server time
```

Database lưu UTC.

Frontend hiển thị theo:

```text
Asia/Ho_Chi_Minh
```

---

# 10. Customer Information

Bắt buộc:

- Full Name
- Phone Number
- Privacy Consent

## 10.1. Validation

### Full Name

- Required
- 2–100 ký tự
- Trim whitespace

### Phone

- Required
- Normalize trước khi lưu
- Hỗ trợ định dạng Việt Nam

Ví dụ:

```text
0912345678
+84912345678
```

Normalize về một format thống nhất.

### Consent

- Required checkbox
- Không checked → không submit
- Nội dung consent ngắn, dễ hiểu
- Có link tới Privacy Policy

---

# 11. Rating Configuration

Rating phải **dynamic**, không hard-code UI.

Admin có thể đổi giữa:

- Emoji
- Star
- Button
- Text-based scale

Ví dụ config:

```json
{
  "ratingType": "EMOJI",
  "ratingOptions": [
    {
      "value": 1,
      "label": "Rất không hài lòng",
      "icon": "angry"
    },
    {
      "value": 2,
      "label": "Không hài lòng",
      "icon": "sad"
    },
    {
      "value": 3,
      "label": "Bình thường",
      "icon": "neutral"
    },
    {
      "value": 4,
      "label": "Hài lòng",
      "icon": "happy"
    },
    {
      "value": 5,
      "label": "Rất hài lòng",
      "icon": "love"
    }
  ]
}
```

Admin đổi config không cần deploy frontend.

---

# 12. Feedback Reasons

Reasons phải dynamic và phụ thuộc rating.

## 12.1. Positive reasons

Áp dụng cho rating 4–5.

Gợi ý:

- Thân thiện
- Tư vấn rõ ràng
- Phục vụ nhanh
- Chủ động hỗ trợ
- Thanh toán thuận tiện
- Sản phẩm tốt
- Trải nghiệm tốt
- Khác

## 12.2. Neutral / Negative reasons

Áp dụng cho rating 1–3.

Gợi ý:

- Thái độ phục vụ
- Tư vấn chưa rõ
- Thời gian chờ lâu
- Sản phẩm/đơn hàng chưa chính xác
- Thanh toán
- Chất lượng sản phẩm
- Quy trình phục vụ
- Khác

## 12.3. Admin actions

Admin có thể:

- Create
- Edit
- Enable
- Disable
- Reorder
- Set rating range
- Set positive/negative category
- Set required/optional

Ví dụ:

```text
Reason: "Thời gian chờ lâu"

Applicable rating:
1
2
3

Status:
ACTIVE
```

---

# 13. Customer Submit Behavior

Mỗi lần submit thành công tạo **01 record mới**.

Không deduplicate.

Ví dụ:

```text
Customer A
Staff GS025
10:00
→ Feedback #1

Customer A
Staff GS025
10:05
→ Feedback #2
```

Tuy nhiên hệ thống có thể đánh dấu spam/suspicious.

Không xóa record tự động.

---

# 14. Anti-Spam

QR là public nên cần chống abuse.

Phase 1:

- Rate limit theo IP
- Rate limit theo QR token
- Detect số lượng submit bất thường
- Detect cùng phone + same staff + short time window
- Mark `suspicious = true`
- Không xóa raw feedback

Dashboard:

```text
Include suspicious feedback
[ OFF ]
```

Default: OFF.

Future:

- CAPTCHA
- Device fingerprint
- OTP
- Advanced fraud detection

Không dùng OTP trong MVP vì làm tăng friction cho khách.

---

# 15. QR Management

## 15.1. Staff QR List

Screen:

```text
Staff > QR Management
```

Table:

| Staff Code | Staff Name | Cinema | QR Status | Updated | Actions |
|---|---|---|---|---|---|
| GS025 | Nguyễn Văn A | Nguyễn Du | Active | 05/09 | View |
| GS026 | Nguyễn Văn B | Nguyễn Du | Active | 05/09 | View |
| GS027 | Nguyễn Văn C | Nguyễn Du | Not Generated | - | Generate |

## 15.2. Actions

- Generate QR
- Preview
- Download QR PNG
- Download QR SVG
- Download Print Template
- Print
- Disable
- Regenerate
- Copy public URL

## 15.3. Batch

Button:

```text
Generate QR For All Staff
```

Batch flow:

```text
Click
↓
Show confirmation
↓
Generate missing QR only
↓
Show result
↓
Download ZIP / PDF package
```

## 15.4. QR Lifecycle

Status:

```text
ACTIVE
DISABLED
REVOKED
```

Nếu staff inactive:

```text
staff.status = INACTIVE
```

QR không nhận feedback.

Customer thấy generic error:

```text
Mã QR hiện không còn hiệu lực.
Vui lòng liên hệ nhân viên tại rạp để được hỗ trợ.
```

---

# 16. QR Output Design

Cần support **2 loại download**.

## 16.1. Raw QR

- PNG
- SVG

Chỉ chứa QR.

## 16.2. Print Template

Thiết kế card/sticker hoàn chỉnh để đặt tại POS.

Nội dung gợi ý:

```text
┌────────────────────────────────┐
│         GALAXY CINEMA          │
│                                │
│            [ QR ]              │
│                                │
│      QUÉT MÃ ĐỂ ĐÁNH GIÁ       │
│      TRẢI NGHIỆM CỦA BẠN       │
│                                │
│       Chỉ mất 15–30 giây       │
└────────────────────────────────┘
```

Có thể có:

- Logo Galaxy
- QR lớn, độ tương phản cao
- CTA
- Hướng dẫn scan
- Staff code ở phần metadata dành cho manager nếu cần
- Không hiển thị tên nhân viên ở phần customer-facing

Design phải đảm bảo:

- Scan tốt trong môi trường ánh sáng rạp
- In A6/A5 hoặc sticker
- Có safe zone quanh QR
- QR không đặt trên nền phức tạp

---

# 17. Staff Management

## 17.1. Manual Create

Fields:

```text
Staff Code *
Full Name *
Cinema *
Status *
```

Cinema Manager:

- Cinema auto assigned
- Không được thay cinema

Head Office/System Admin:

- Có thể chọn cinema

## 17.2. Import

Support:

- `.xlsx`
- `.csv`

Template:

| Staff Code | Full Name | Cinema Code |
|---|---|---|
| GS025 | Nguyễn Văn A | GND |
| GS026 | Nguyễn Văn B | GND |

Flow:

```text
Upload
↓
Parse
↓
Validate
↓
Preview
↓
Show valid / invalid rows
↓
Confirm
↓
Import
```

Ví dụ:

```text
Total: 100
Valid: 95
Invalid: 5
```

Cho phép:

```text
Download Error File
```

Không import ngay trước khi user confirm.

---

# 18. Admin Information Architecture

Sidebar Phase 1:

```text
Dashboard

Feedback
├── All Feedback
└── Analytics

Staff
├── Staff List
├── Import Staff
└── QR Management

Performance
├── Staff Ranking
└── Cinema Ranking

Coaching
├── Coaching Cases
└── Follow-up

Configuration
├── Rating
└── Feedback Reasons

Administration
├── Cinemas
├── Users
└── Audit Logs
```

Menu hiển thị tùy role.

---

# 19. Admin Dashboard — Cinema Manager

Cinema Manager chỉ thấy rạp của mình.

## 19.1. KPI Cards

```text
Total Feedback
Average Rating
Positive %
Neutral %
Negative %
Eligible Staff for Ranking
```

## 19.2. Date Filters

- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Custom Range

## 19.3. Charts

- Feedback Volume Trend
- Average Rating Trend
- Rating Distribution
- Positive Reasons
- Negative Reasons
- Feedback by Time of Day

## 19.4. Staff Table

| Staff | Feedback | Rating | Positive | Neutral | Negative |
|---|---:|---:|---:|---:|---:|
| GS025 | 182 | 4.82 | 94% | 4% | 2% |
| GS026 | 161 | 4.70 | 91% | 5% | 4% |
| GS018 | 143 | 3.72 | 68% | 14% | 18% |

Click staff → Staff Performance Detail.

---

# 20. Head Office Dashboard

Có thêm filters:

- Cinema
- Date range
- Region — future-ready

KPI:

- Total Feedback
- Average System Rating
- Best Cinema
- Lowest Cinema
- Top Staff
- Common Issues

Charts:

- Cinema Comparison
- Rating Distribution by Cinema
- Feedback Volume by Cinema
- Positive/Negative Reason Comparison
- Ranking Trend
- System Feedback Trend

---

# 21. Staff Performance Detail

Screen cần hỗ trợ coaching.

Header:

```text
Staff Code
Staff Name
Cinema
Status
```

KPIs:

- Feedback Count
- Average Rating
- Positive %
- Negative %
- Ranking Position

Charts:

- Rating Trend
- Reason Distribution
- Feedback Volume

Tables:

- Latest Feedback
- Negative Feedback
- Coaching History

Action:

```text
CREATE COACHING
```

---

# 22. Ranking

Các bảng ranking:

- Top Staff
- Bottom Staff
- Most Feedback
- Best Rating
- Most Improved
- Top Cinema
- Bottom Cinema

## 22.1. Ranking Eligibility

Không cho nhân viên có quá ít feedback đứng top.

Config:

```text
minimumFeedbackForRanking = 20
```

Ví dụ:

```text
GS001
5.0
1 feedback
→ NOT ELIGIBLE
```

Ranking page phải hiển thị:

```text
Minimum 20 feedback required
```

---

# 23. Coaching

Từ feedback → xác định vấn đề → coaching.

Fields:

```text
Staff
Topic
Action
Note
Created By
Created At
Follow-up Date
Status
Completed At
```

Status:

```text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

Example:

```text
Staff: GS018

Topic:
Tư vấn promotion

Action:
Roleplay 5 phút trước ca

Follow-up:
12/09/2026

Status:
OPEN
```

Staff Performance screen phải cho phép manager xem:

```text
Before Coaching
After Coaching
```

Future-ready cho so sánh performance.

---

# 24. Feedback List

Admin page:

```text
Feedback > All Feedback
```

Columns:

- Time
- Rating
- Customer Name
- Phone
- Staff Code
- Staff Name
- Cinema
- Reasons
- Suspicious
- Action

Filters:

- Date range
- Rating
- Positive / Neutral / Negative
- Staff
- Reason
- Suspicious
- Search by customer phone/name

Click row → Feedback Detail.

---

# 25. Feedback Detail

Display:

- Created Time
- Cinema
- Staff
- Customer Name
- Customer Phone
- Rating
- Reasons
- Comment
- QR metadata
- Suspicious flag
- Audit metadata

Do not expose technical fields unnecessarily in default UI.

---

# 26. Configuration Screens

## 26.1. Rating Configuration

Admin can:

- Change type
- Configure scale
- Change label
- Change icon
- Enable/disable level
- Reorder

Preview panel phải hiển thị customer form live.

## 26.2. Feedback Reason Configuration

Admin can:

- Add reason
- Edit
- Disable
- Reorder
- Assign rating values/range
- Mark positive/neutral/negative
- Set required/optional

Live preview recommended.

---

# 27. MongoDB Collections

Phase 1:

```text
cinemas
staff
staff_qr_codes
feedbacks
feedback_reasons
feedback_configs
coaching
admin_users_mapping
audit_logs
```

---

# 28. Suggested Data Model

## 28.1. Cinema

```json
{
  "_id": "...",
  "code": "GND",
  "name": "Galaxy Nguyễn Du",
  "status": "ACTIVE",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 28.2. Staff

```json
{
  "_id": "...",
  "staffCode": "GS025",
  "name": "Nguyễn Văn A",
  "cinemaId": "...",
  "status": "ACTIVE",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 28.3. QR Code

```json
{
  "_id": "...",
  "staffId": "...",
  "publicToken": "X7M4Q9AKP2",
  "status": "ACTIVE",
  "createdBy": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 28.4. Feedback

Use snapshot to preserve historical data.

```json
{
  "_id": "...",

  "staff": {
    "id": "...",
    "code": "GS025",
    "name": "Nguyễn Văn A"
  },

  "cinema": {
    "id": "...",
    "code": "GND",
    "name": "Galaxy Nguyễn Du"
  },

  "customer": {
    "name": "Nguyễn Văn B",
    "phone": "84901234567"
  },

  "rating": {
    "value": 2,
    "label": "Không hài lòng"
  },

  "reasons": [
    {
      "code": "CONSULTING",
      "label": "Tư vấn chưa rõ",
      "type": "NEGATIVE"
    }
  ],

  "comment": "Tư vấn ưu đãi chưa rõ",

  "qr": {
    "id": "...",
    "token": "..."
  },

  "metadata": {
    "ipHash": "...",
    "userAgent": "...",
    "suspicious": false
  },

  "consent": {
    "accepted": true,
    "version": "v1"
  },

  "createdAt": "2026-09-05T14:59:00Z"
}
```

## 28.5. Coaching

```json
{
  "_id": "...",
  "staffId": "...",
  "cinemaId": "...",
  "topic": "Tư vấn promotion",
  "action": "Roleplay 5 phút trước ca",
  "note": "...",
  "status": "OPEN",
  "createdBy": "...",
  "createdAt": "...",
  "followUpDate": "...",
  "completedAt": null
}
```

---

# 29. MongoDB Indexes

## feedbacks

```javascript
{ "staff.id": 1, "createdAt": -1 }

{ "cinema.id": 1, "createdAt": -1 }

{ "customer.phone": 1, "createdAt": -1 }

{ "rating.value": 1, "createdAt": -1 }

{ "reasons.code": 1, "createdAt": -1 }
```

## staff_qr_codes

```javascript
{ "publicToken": 1 } UNIQUE

{ "staffId": 1 } UNIQUE
```

## staff

```javascript
{ "staffCode": 1 } UNIQUE

{ "cinemaId": 1, "status": 1 }
```

---

# 30. API v1

## 30.1. Public APIs

```http
GET /api/v1/public/feedback/:qrToken

GET /api/v1/public/feedback-config

POST /api/v1/public/feedback
```

Public response không trả staff name/code nếu không cần cho UI.

## 30.2. Admin — Dashboard

```http
GET /api/v1/admin/dashboard

GET /api/v1/admin/dashboard/ranking
```

## 30.3. Admin — Feedback

```http
GET /api/v1/admin/feedbacks

GET /api/v1/admin/feedbacks/:id
```

## 30.4. Admin — Staff

```http
GET /api/v1/admin/staff

POST /api/v1/admin/staff

PUT /api/v1/admin/staff/:id

POST /api/v1/admin/staff/import
```

## 30.5. Admin — QR

```http
GET /api/v1/admin/staff/:id/qr

POST /api/v1/admin/staff/:id/qr

POST /api/v1/admin/staff/:id/qr/regenerate

DELETE /api/v1/admin/staff/:id/qr

POST /api/v1/admin/staff/qr/batch
```

## 30.6. Admin — Feedback Configuration

```http
GET /api/v1/admin/feedback-config

PUT /api/v1/admin/feedback-config

GET /api/v1/admin/feedback-reasons

POST /api/v1/admin/feedback-reasons

PUT /api/v1/admin/feedback-reasons/:id
```

## 30.7. Admin — Coaching

```http
GET /api/v1/admin/coaching

POST /api/v1/admin/coaching

GET /api/v1/admin/coaching/:id

PUT /api/v1/admin/coaching/:id
```

---

# 31. Go Backend Structure

```text
backend/
│
├── cmd/
│   └── api/
│
├── internal/
│   ├── auth/
│   ├── cinema/
│   ├── staff/
│   ├── qr/
│   ├── feedback/
│   ├── dashboard/
│   ├── ranking/
│   ├── coaching/
│   ├── audit/
│   │
│   ├── middleware/
│   │   ├── auth.go
│   │   ├── permission.go
│   │   ├── rate_limit.go
│   │   └── request_id.go
│   │
│   └── infrastructure/
│       ├── mongodb/
│       ├── keycloak/
│       ├── logging/
│       └── config/
│
└── pkg/
```

Typical flow:

```text
HTTP Handler
↓
Service
↓
Repository Interface
↓
Mongo Repository
↓
MongoDB
```

---

# 32. Audit Log

Audit phải làm từ Phase 1.

Track:

- Login events — nếu phù hợp
- Staff create/update/disable
- Staff import
- QR generate
- QR regenerate
- QR disable
- Configuration change
- Coaching create/update/complete
- Cinema change
- User permission change

Example:

```text
05/09/2026 20:01
Manager A
GENERATE_QR
Staff GS025

05/09/2026 20:15
Manager A
DISABLE_STAFF
Staff GS026

05/09/2026 21:20
Head Office Admin
UPDATE_FEEDBACK_CONFIG
STAR → EMOJI
```

---

# 33. Security Requirements

Minimum:

- HTTPS only
- OIDC + PKCE
- Access token validation tại Go API
- Role enforcement server-side
- Rate limiting
- Input validation
- Mongo query sanitization
- Security headers
- CSRF consideration nếu sử dụng cookie session
- Secure token storage
- Do not log customer phone raw trong application logs
- Hash IP trước khi lưu nếu chỉ dùng anti-spam
- Mask phone trên table nếu role không cần full phone
- Audit privileged actions
- Disable expired/revoked QR
- Public token phải random, không sequential
- QR token không chứa staff ID

---

# 34. Privacy

Customer Website thu thập:

- Name
- Phone
- Feedback

Do đó cần:

- Required privacy consent checkbox
- Privacy Policy page
- Consent version
- Created time
- Clear explanation về mục đích sử dụng dữ liệu
- Không tự động marketing opt-in từ consent feedback
- Marketing consent, nếu có sau này, phải tách riêng

Customer form nên dùng wording ngắn, tự nhiên, không gây cảm giác nặng về pháp lý.

---

# 35. SEO

Customer Website sử dụng SSR để:

- First load nhanh
- UX tốt khi scan QR
- Có cấu trúc HTML server-rendered

Nhưng QR feedback page phải:

```html
<meta name="robots" content="noindex,nofollow">
```

SEO public chỉ dành cho:

```text
/
/help
/privacy
/terms
```

nếu các trang này được triển khai.

Admin Website không cần SEO.

---

# 36. Responsive Requirements

## Customer Website

Mobile-first.

Target:

- iPhone
- Android
- Width 320px trở lên

Form phải:

- Không horizontal scroll
- Touch target >= 44px
- Rating dễ tap
- Submit button rõ
- Không quá nhiều content trên 1 screen
- Có loading / submitting state
- Error message inline

## Admin Website

Desktop-first.

Target:

- 1366x768
- 1440x900
- 1920x1080
- Tablet minimum 1024px usable

Table phải có:

- Sticky header nếu cần
- Filters
- Pagination
- Empty state
- Loading skeleton
- Error state

---

# 37. Design Direction for Claude

## 37.1. Brand Feeling

Customer:

- Modern
- Friendly
- Fast
- Cinema-oriented
- Trustworthy
- Minimal friction

Admin:

- Professional
- Data-driven
- Operational
- Clean
- Dense enough for management usage
- Không quá decorative

## 37.2. Customer Design Priority

1. QR scan → form xuất hiện nhanh
2. Rating nhìn thấy ngay
3. Ít thao tác
4. Clear CTA
5. Mobile-first
6. Customer không cần hiểu hệ thống phía sau
7. Không expose staff identity
8. Privacy consent rõ nhưng không làm form nặng

## 37.3. Admin Design Priority

1. Dashboard scan nhanh trong 5–10 giây
2. Filter rõ
3. Table thao tác nhanh
4. QR management dễ dùng cho manager rạp
5. Import workflow an toàn
6. Ranking dễ so sánh
7. Negative feedback dễ drill-down
8. Coaching nằm gần performance data

---

# 38. Screens cần thiết kế

## Customer App

1. Feedback Form
2. Thank You
3. Invalid QR
4. Disabled QR
5. Generic Error
6. Privacy Policy
7. Loading / Skeleton state

## Admin — Authentication

8. Login
9. Forgot Password — nếu bật
10. Change Password

## Admin — Dashboard

11. Cinema Dashboard
12. Head Office Dashboard

## Admin — Feedback

13. Feedback List
14. Feedback Detail
15. Feedback Analytics

## Admin — Staff

16. Staff List
17. Create Staff
18. Edit Staff
19. Staff Detail
20. Import Staff — Upload
21. Import Staff — Preview
22. Import Staff — Result

## Admin — QR

23. QR Management List
24. QR Preview
25. Print Template Preview
26. Batch QR Generation Result

## Admin — Performance

27. Staff Ranking
28. Cinema Ranking
29. Staff Performance Detail

## Admin — Coaching

30. Coaching List
31. Create Coaching
32. Coaching Detail/Edit
33. Follow-up View

## Admin — Configuration

34. Rating Configuration
35. Feedback Reason Configuration

## Admin — Administration

36. Cinema List
37. Cinema Create/Edit
38. User List
39. User Create/Edit
40. Audit Log

---

# 39. Critical UX Flows cần design

## Flow A — Customer Feedback

```text
Scan QR
→ Feedback Form
→ Rating
→ Dynamic Reasons
→ Customer Info
→ Consent
→ Submit
→ Thank You
```

## Flow B — Manager tạo QR cho nhân viên

```text
Staff List
→ Select Staff
→ Generate QR
→ Preview
→ Download Raw QR
OR
→ Download Print Template
```

## Flow C — Generate QR hàng loạt

```text
QR Management
→ Generate All
→ Confirmation
→ Generate Missing QR
→ Result
→ Download Package
```

## Flow D — Import Staff

```text
Staff
→ Import
→ Download Template
→ Upload
→ Validate
→ Preview
→ Confirm
→ Result
```

## Flow E — Xem feedback thấp

```text
Dashboard
→ Negative Feedback
→ Filter Staff
→ Feedback Detail
→ Staff Performance
→ Create Coaching
```

## Flow F — Head Office so sánh rạp

```text
Head Office Dashboard
→ Cinema Comparison
→ Select Cinema
→ Drill-down
→ Staff Ranking
→ Feedback Reasons
```

---

# 40. Empty / Error / Loading States

Claude Design phải thiết kế cả state, không chỉ happy path.

Cần:

- Loading
- Skeleton
- Empty feedback
- Empty staff
- QR chưa generate
- QR disabled
- QR invalid
- Import error
- API error
- No ranking data
- Staff chưa đủ số feedback để ranking
- Permission denied
- Session expired

---

# 41. QR Error UX

Không expose technical information.

Không hiển thị:

```text
Token not found
Staff ID invalid
MongoDB error
```

Hiển thị:

```text
Mã QR hiện không khả dụng.

Vui lòng liên hệ nhân viên tại rạp để được hỗ trợ.
```

Button optional:

```text
THỬ LẠI
```

---

# 42. Admin UI Components cần reusable

- KPI Card
- Date Range Filter
- Cinema Selector
- Rating Badge
- Status Badge
- Staff Selector
- Feedback Reason Chips
- Data Table
- Export Button
- Import Dropzone
- QR Preview Card
- Empty State
- Confirm Dialog
- Side Drawer Detail
- Chart Container
- Filter Bar
- Search Input
- Audit Timeline
- Coaching Status Stepper

---

# 43. Chart Suggestions

Không overuse charts.

Ưu tiên:

### Line Chart

- Feedback trend
- Average rating trend

### Bar Chart

- Cinema comparison
- Staff comparison

### Horizontal Bar

- Feedback reasons

### Donut

- Positive / Neutral / Negative

### Distribution Bar

- Rating 1–5

Không dùng chart khi table đọc dễ hơn.

---

# 44. Phase 1 Development Plan

## Sprint 0 — Foundation

- Repository
- Nx workspace
- Angular Admin
- Angular Customer SSR
- Go API
- MongoDB
- Keycloak
- Local Docker environment
- Environment config
- CI/CD foundation

## Sprint 1 — Auth + Cinema

- Keycloak login
- Role mapping
- Cinema CRUD
- Permission middleware
- Cinema Manager scope

## Sprint 2 — Staff

- Staff CRUD
- Staff status
- Manual create
- Excel/CSV import
- Import preview/error handling

## Sprint 3 — QR Management

- Generate token
- QR PNG/SVG
- Preview
- Print template
- Regenerate
- Disable
- Batch generation

## Sprint 4 — Customer Feedback

- SSR route
- QR validation
- Dynamic rating
- Dynamic reasons
- Name + phone
- Consent
- Submit
- Thank-you page
- Error states

## Sprint 5 — Feedback Admin

- Feedback list
- Filters
- Feedback detail
- Customer search
- Suspicious flag

## Sprint 6 — Configuration

- Rating config
- Reason config
- Rating-dependent reasons
- Preview

## Sprint 7 — Cinema Dashboard

- KPIs
- Trend
- Rating distribution
- Reasons
- Staff table

## Sprint 8 — Head Office + Ranking

- System dashboard
- Cinema comparison
- Staff ranking
- Cinema ranking
- Minimum feedback eligibility

## Sprint 9 — Coaching

- Create coaching
- Follow-up
- Status
- Staff performance integration

## Sprint 10 — Security + Audit

- Rate limiting
- Spam detection
- Audit log
- Privacy
- Security headers
- Permission verification

## Sprint 11 — UAT

- UAT data
- Test cases
- Mobile QA
- Browser QA
- QR print/scan testing
- Security test

## Sprint 12 — Pilot

- Pilot 01 cinema
- Collect manager feedback
- Collect customer completion rate
- Review analytics
- Fix UX friction
- Production readiness

---

# 45. Phase 1 Acceptance Criteria

## Customer

- QR scan mở đúng feedback page.
- Không hiển thị thông tin nhân viên.
- Hiển thị ngày giờ hiện tại.
- Name required.
- Phone required.
- Rating required.
- Reasons thay đổi theo rating.
- Consent required.
- Submit thành công tạo đúng 1 record.
- Mobile UX tốt.
- QR invalid/disabled hiển thị generic error.

## Staff

- Manager tạo nhân viên thủ công được.
- Import `.xlsx/.csv` được.
- Có preview trước import.
- Duplicate staff code được validate.

## QR

- Generate QR riêng lẻ được.
- Generate batch được.
- Download PNG được.
- Download SVG được.
- Download print template được.
- Regenerate được.
- Disable được.
- QR không expose staff code.

## Dashboard

- Manager chỉ thấy rạp mình.
- Head Office thấy toàn hệ thống.
- Date filter hoạt động.
- Ranking có minimum feedback rule.
- Suspicious feedback mặc định không tính KPI.

## Security

- Unauthorized request bị chặn.
- Cross-cinema access bị chặn.
- Public APIs rate-limited.
- QR token random.
- Audit log ghi privileged actions.

---

# 46. Non-Goals Phase 1

Không làm trong Transaction Feedback MVP:

- POS integration
- Transaction ID mapping
- POS screen integration
- Real-time manager notification
- SMS OTP
- Marketing campaign
- Customer account
- Loyalty integration
- Service Recovery Code
- Smart Cinema Incident
- Smart Seat Request
- AI sentiment analysis

Các phần này có thể đưa vào phase sau.

---

# 47. Phase 2 — Service Recovery Code

Sau khi Phase 1 ổn định:

```text
Customer Complaint
↓
CS
↓
Create Recovery Code
↓
Send Code
↓
Customer presents code
↓
Cinema validates
↓
VALID / USED / EXPIRED
↓
Redeem
↓
Audit
```

Reuse:

- Authentication
- User/Role
- Cinema
- Staff
- Audit
- Dashboard
- Configuration

---

# 48. Phase 3 — Smart Cinema

Mục tiêu:

```text
QR
↓
Report Incident
↓
Assign
↓
Alert
↓
In Progress
↓
Resolved
↓
Confirmed
↓
SLA + Analytics
```

Nhóm:

- TECH
- FACILITY
- F&B
- SERVICE
- QAQC

Future dashboard:

- Heatmap sự cố
- SLA
- Issue frequency
- Equipment history
- Top incident locations

---

# 49. Phase 4 — Smart Seat

Customer scan QR tại ghế.

QR xác định:

```text
Cinema
Auditorium
Seat
```

Khách chọn:

- Ghế có vấn đề
- Vệ sinh
- Nhiệt độ
- Âm thanh
- Yêu cầu hỗ trợ
- Khác

Flow:

```text
Seat QR
↓
Customer Request
↓
Staff Alert
↓
Accept
↓
Resolve
↓
Close
↓
Analytics
```

Smart Cinema và Smart Seat nên dùng chung **Incident / Request Engine**.

---

# 50. Future Shared Platform Architecture

```text
SMART CINEMA PLATFORM
│
├── Identity & Access
├── Cinema
├── Staff
├── QR Management
├── Audit
├── Configuration
│
├── Transaction Feedback
│   ├── Feedback
│   ├── Ranking
│   └── Coaching
│
├── Service Recovery
│   ├── Code
│   ├── Redeem
│   └── Compensation Analytics
│
└── Smart Operations
    ├── Smart Cinema
    ├── Smart Seat
    ├── Incident Engine
    ├── SLA
    └── Heatmap
```

---

# 51. Prompt / Brief cho Claude Design

Claude Design nên nhận yêu cầu theo hướng sau:

> Thiết kế một nền tảng Smart Cinema hiện đại gồm Customer Feedback Website và Admin Management Website. Phase đầu tiên là Transaction Feedback QR.
>
> Customer Website phải mobile-first, Angular SSR, khách scan QR tại máy POS, sau đó đánh giá trải nghiệm. Không hiển thị tên hoặc mã nhân viên. Chỉ hiển thị ngày giờ hiện tại, rating dynamic, reasons dynamic theo rating, họ tên, số điện thoại, comment và privacy consent. Form phải hoàn thành nhanh trong khoảng 15–30 giây.
>
> Admin Website dùng desktop-first layout cho Cinema Manager, Head Office và System Admin. Phải có Dashboard, Feedback Management, Staff Management, Import Staff, QR Management, Staff Ranking, Cinema Ranking, Coaching, Feedback Configuration, Cinema/User Management và Audit Logs.
>
> Cinema Manager chỉ quản lý một cinema. Head Office xem toàn hệ thống.
>
> QR Management là feature quan trọng: generate QR riêng cho từng nhân viên, generate hàng loạt, preview, download PNG/SVG, download print template, print, disable và regenerate QR.
>
> QR public không được expose staff code. Customer không được nhìn thấy danh tính nhân viên.
>
> Design phải sử dụng PrimeNG + TailwindCSS mindset, component-driven, responsive, clean, professional, data-driven và dễ triển khai bằng Angular 21.
>
> Hãy thiết kế đầy đủ happy path, loading state, empty state, validation state, error state, confirmation dialog, responsive state và permission-based navigation.
>
> Ưu tiên trải nghiệm nhanh, rõ, thao tác ít và dễ scan dữ liệu trên admin dashboard.

---

# 52. Definition of Done cho Design

Design được xem là đủ để bắt đầu development khi có:

- App sitemap
- Navigation
- Customer mobile screens
- Admin desktop screens
- Responsive rules
- Component library
- Typography
- Color tokens
- Spacing tokens
- Form patterns
- Table patterns
- Modal / drawer patterns
- Chart patterns
- QR print template
- Loading state
- Empty state
- Error state
- Validation state
- Role-based menu states
- Core user flows prototype

---

# 53. Product Principle

Toàn bộ hệ thống nên tuân theo nguyên tắc:

```text
CUSTOMER
Scan → Feedback nhanh

MANAGER
Data → Hiểu vấn đề → Coaching

HEAD OFFICE
Data toàn hệ thống → So sánh → Cải tiến

PLATFORM
QR → DATA → ACTION → IMPROVE
```

Phase 1 tập trung làm Transaction Feedback thật tốt trước khi mở rộng sang 3 module còn lại.
