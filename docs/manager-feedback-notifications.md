# Thông báo feedback cho quản lý trực tiếp

Mỗi nhân viên có `managerId` là ID tài khoản Keycloak được chọn tại **Nhân viên → Sửa → Quản lý trực tiếp**. Chỉ gán tài khoản đang hoạt động, có role `CINEMA_MANAGER`, cùng rạp. API xác minh lại khi lưu; thay đổi được audit cùng nhân viên. Khi tài khoản quản lý bị xóa, đổi rạp, đổi role hoặc bị khóa, hệ thống tự bỏ gán `managerId` khỏi các nhân viên mà tài khoản đó không còn đọc được thông báo. Nhân viên cũ/import chưa có quản lý vẫn nhận feedback bình thường, nhưng không phát thông báo; màn hình nhân viên đánh dấu “Chưa gán quản lý”. Không tự chọn một người trong trường hợp rạp có nhiều quản lý.

Khi khách gửi thành công, mọi mức điểm đều tạo một thông báo in-app và một email job trong cùng transaction MongoDB với feedback. Người nhận được chốt theo quản lý lúc gửi. Không backfill đánh giá cũ hay chuyển thông báo đã tạo khi đổi quản lý. Thông báo gồm tên nhân viên, điểm, thời gian, cờ nghi vấn và liên kết chi tiết; không chứa thông tin khách hàng, bình luận hay QR token. Điểm 1–2 có nhãn “Cần xử lý sớm”. Xử lý/coaching vẫn dùng màn hình feedback hiện có; “đã đọc” không đồng nghĩa “đã xử lý”.

Hộp thư và số chưa đọc chỉ thuộc tài khoản đang đăng nhập, kèm phạm vi rạp hiện tại. Quyền toàn hệ thống không cho phép đọc hộp thư người khác. Admin tự cập nhật mỗi 15 giây khi tab đang mở; chuyển tab về foreground cập nhật số chưa đọc. Đây là polling khi app đang mở, chưa có push khi đóng trình duyệt.

## Bật email

Cấu hình môi trường API (không commit giá trị thật):

```dotenv
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_EMAIL_FROM=Smart Cinema <alerts@your-verified-domain.example>
RESEND_API_KEY=<sending-api-key>
ADMIN_URL=https://your-admin.example
KEYCLOAK_SERVICE_CLIENT=smart-cinema-service
KEYCLOAK_SERVICE_SECRET=<service-client-secret>
```

Xác minh domain gửi với Resend và điền email hợp lệ cho tài khoản quản lý. Worker chạy trong API, poll hàng đợi mỗi 5 giây lúc rảnh; MongoDB phải hỗ trợ transaction như cấu hình hiện có. Không cần Redis/broker. Provider hiện đã tích hợp là Resend HTTP API; interface `Sender` cho phép thêm provider khác sau.

Worker dùng lease atomically trong MongoDB, timeout 40 giây cho một lần xử lý, lease 2 phút, retry tăng dần tối đa 8 lần. Trước mỗi lần gửi, kiểm tra lại quản lý có hoạt động, role và rạp vẫn phù hợp; tài khoản đổi rạp/role bị hủy gửi. Email lỗi/thiếu chuyển failed; lỗi directory/provider retry. Job có idempotency key ổn định `feedback/<id>`; chỉ retry trong 12 giờ từ lúc feedback để không vượt cửa sổ idempotency 24 giờ của Resend. Sau crash, lease hết hạn cho phép xử lý lại. Đổi email/sender trong lúc retry có thể khiến provider từ chối payload khác với cùng key: kiểm tra job trước khi sửa/replay, không tự xóa key để gửi lại.

`notification_emails.status`: `pending`, `sending`, `sent` (provider đã chấp nhận, không bảo đảm vào inbox), `failed`, `cancelled`. `attempts`, `nextAttemptAt`, `lastError` cho phép vận hành kiểm tra backlog; không lưu response/secret của provider. Chưa có màn hình quản trị/replay email. Khi email tắt, in-app tiếp tục hoạt động và job email không được tạo (không có worker nên chúng chỉ có thể hết hạn). Provider trả 4xx (trừ 429) được coi là lỗi vĩnh viễn và chuyển `failed` ngay thay vì retry hết 8 lần. Không tự gửi email từ môi trường test.

## API

- `GET /admin/managers?cinemaId=...`: danh sách `{id,name}` quản lý đang hoạt động cùng rạp; cần quyền truy cập rạp; lỗi directory trả 502/503.
- `POST/PUT /admin/staff[/:id]`: thêm `managerId` (chuỗi rỗng để bỏ gán).
- `GET /admin/notifications?page=1&pageSize=20&unread=true`: trang thông báo của chính người dùng.
- `GET /admin/notifications/unread-count`: `{count:number}`.
- `PUT /admin/notifications/:id/read`: 204, idempotent; ID thuộc người/rạp khác trả 404.
- `/feedback?feedbackId=...`: mở chi tiết qua API có kiểm tra quyền như bình thường.

## Provider miễn phí tham khảo (kiểm tra ngày 2026-09-06)

- [Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits): 3.000 email/tháng, tối đa 100/ngày. Đã tích hợp; phù hợp pilot nhỏ.
- [Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan): 300 email/ngày. Đề xuất khi cần hạn mức ngày lớn hơn; chưa tích hợp.
- [Telegram Bot](https://core.telegram.org/bots): nền tảng bot miễn phí, phù hợp làm kênh bổ sung để quản lý nhận nhanh trên điện thoại; cần liên kết đúng chat với tài khoản quản lý và tuân thủ rate limit. Chưa tích hợp.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): giữ key trong 24 giờ.

## UAT

1. Gán quản lý cùng rạp, thử gán tài khoản khác rạp/disabled để xác nhận bị chặn.
2. Submit QR của nhân viên với điểm 1 và 5; mỗi feedback tạo đúng một in-app/job. Không gán quản lý thì vẫn submit được, không có notification.
3. Đăng nhập quản lý: số chưa đọc cập nhật, mở thông báo đến đúng feedback, đánh dấu đã đọc không tạo bản ghi mới.
4. Quản lý khác cùng rạp, khác rạp và head office không đọc được inbox của người nhận.
5. Email chỉ dùng mailbox thử nghiệm sau khi người vận hành bật cấu hình. Provider lỗi không rollback feedback; lease/retry không gửi trùng trong cửa sổ hỗ trợ.
6. Tắt mạng: hộp thư hiện lỗi và nút thử lại, số unread không giả về 0. Kiểm tra keyboard, admin 1366px, customer 320/390px; scan QR vật lý vẫn cần UAT.
