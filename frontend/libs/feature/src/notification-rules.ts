import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cinema-notification-rules',
  imports: [RouterLink],
  template: `<p class="kicker">Thông báo</p>
    <h2>Quy tắc &amp; kênh gửi</h2>
    <p class="english">Notification delivery</p>
    <div class="notice">
      <p>
        Thông báo feedback được gửi đến quản lý trực tiếp của nhân viên. Trang này giải thích cách
        nhận thông báo; hiện chưa hỗ trợ chỉnh sửa quy tắc.
      </p>
      <a routerLink="/staff">Kiểm tra quản lý đã gán cho nhân viên</a>
    </div>
    <section class="section" aria-labelledby="feedback-delivery">
      <h3 id="feedback-delivery">Khi có feedback mới</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sự kiện</th>
              <th>Người nhận</th>
              <th>Cách hiển thị</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Khách gửi đánh giá</td>
              <td>Quản lý trực tiếp đã gán</td>
              <td>Thông báo trong hộp thư cá nhân</td>
            </tr>
            <tr>
              <td>Đánh giá 1–2 điểm</td>
              <td>Quản lý trực tiếp đã gán</td>
              <td>Nhãn “Cần xem sớm” nếu không bị gắn cờ nghi vấn</td>
            </tr>
            <tr>
              <td>Feedback bị gắn cờ nghi vấn</td>
              <td>Quản lý trực tiếp đã gán</td>
              <td>Thông báo có nội dung nghi vấn để kiểm tra</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted section">
        Nhân viên chưa được gán quản lý vẫn nhận đánh giá nhưng chưa phát thông báo. Thông báo đã
        gửi giữ nguyên người nhận khi thay đổi quản lý.
      </p>
    </section>
    <div class="columns">
      <section>
        <h3>Kênh nhận thông báo</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kênh</th>
                <th>Khả dụng</th>
                <th>Điều kiện</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Trong ứng dụng</td>
                <td><span class="tag good">Đã hỗ trợ</span></td>
                <td>Đăng nhập để xem hộp thư; cập nhật mỗi 15 giây khi mở ứng dụng.</td>
              </tr>
              <tr>
                <td>Email</td>
                <td><span class="tag">Theo cấu hình</span></td>
                <td>Cần được quản trị viên bật và tài khoản quản lý có email hợp lệ.</td>
              </tr>
              <tr>
                <td>Zalo OA / SMS</td>
                <td><span class="tag">Chưa hỗ trợ</span></td>
                <td>Chưa gửi qua các kênh này.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>Chức năng chưa mở</h3>
        <p>
          Báo cáo ngày/tuần, nhắc coaching, sự kiện QR và cảnh báo chuỗi feedback chưa được phát tự
          động.
        </p>
        <p class="muted">
          Giờ yên lặng và giới hạn số cảnh báo theo nhân viên chưa áp dụng. Nếu chưa nhận email,
          liên hệ quản trị viên để kiểm tra cấu hình gửi.
        </p>
        <a class="secondary" routerLink="/notifications">Mở hộp thư thông báo</a>
      </section>
    </div>`,
})
export class NotificationRulesPage {}
