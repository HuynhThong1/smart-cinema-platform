import { Component, inject } from '@angular/core';
import { Auth } from '@cinema/core';

export interface NotificationRule {
  code: string;
  event: string;
  condition: string;
  recipients: string;
  channels: string[];
  enabled: boolean;
}
export interface NotificationChannel {
  name: string;
  status: 'Bật' | 'Tắt' | 'Chưa nối';
  note: string;
}

/** The rule set the notification service evaluates. Read-only until the rules API ships. */
export const NOTIFICATION_RULES: NotificationRule[] = [
  {
    code: 'NEG_INSTANT',
    event: 'Feedback tiêu cực',
    condition: 'rating ≤ 2',
    recipients: 'Cinema Manager',
    channels: ['In-app', 'Email'],
    enabled: true,
  },
  {
    code: 'NEG_BURST',
    event: 'Chuỗi tiêu cực cùng nhân viên',
    condition: '≥ 3 feedback ≤ 2★ / 60 phút',
    recipients: 'Cinema Manager + Head Office',
    channels: ['In-app', 'Email', 'Zalo OA'],
    enabled: true,
  },
  {
    code: 'SUSPICIOUS',
    event: 'Feedback nghi vấn',
    condition: 'trùng SĐT trong 10 phút',
    recipients: 'Cinema Manager',
    channels: ['In-app'],
    enabled: true,
  },
  {
    code: 'DAILY_DIGEST',
    event: 'Báo cáo ngày',
    condition: '08:00 hằng ngày',
    recipients: 'Cinema Manager + Head Office',
    channels: ['Email'],
    enabled: true,
  },
  {
    code: 'WEEKLY_RANK',
    event: 'Ranking tuần',
    condition: 'Thứ 2, 09:00',
    recipients: 'Head Office',
    channels: ['Email'],
    enabled: true,
  },
  {
    code: 'COACH_DUE',
    event: 'Coaching đến hạn',
    condition: 'trước hạn 2 ngày',
    recipients: 'Người tạo case',
    channels: ['In-app', 'Email'],
    enabled: true,
  },
  {
    code: 'QR_EVENT',
    event: 'QR tạo mới / thu hồi',
    condition: 'mọi thay đổi QR',
    recipients: 'System Admin',
    channels: ['In-app'],
    enabled: false,
  },
];

/**
 * Channel status reflects what the platform can actually deliver today, not the
 * target state: In-app and Email are wired, Zalo OA and SMS are not. Showing an
 * unwired channel as `Bật` would promise delivery the service silently drops.
 */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { name: 'In-app', status: 'Bật', note: 'Mặc định, không tắt được' },
  { name: 'Email', status: 'Bật', note: 'SMTP Head Office' },
  { name: 'Zalo OA', status: 'Chưa nối', note: 'Chỉ cảnh báo NEG_BURST · chờ tích hợp' },
  { name: 'SMS', status: 'Tắt', note: 'Dự kiến phase 2' },
];

@Component({
  selector: 'cinema-notification-rules',
  template: `<p class="kicker">Notifications</p>
    <h2>Quy tắc &amp; kênh gửi</h2>
    <p class="english">Ai nhận cái gì, qua kênh nào, khi nào</p>
    <div class="notice">
      @if (auth.global()) {
        <p>
          Quy tắc áp dụng cho toàn hệ thống. Bản này hiển thị cấu hình đang chạy — chỉnh sửa sẽ mở
          khi API quy tắc sẵn sàng.
        </p>
      } @else {
        <p>
          Vai trò Cinema Manager chỉ xem được quy tắc áp dụng cho rạp mình. Chỉnh sửa thuộc Head
          Office.
        </p>
      }
    </div>
    <div class="table-wrap">
      <table class="table-wide">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Sự kiện</th>
            <th>Điều kiện</th>
            <th>Người nhận</th>
            <th>Kênh</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rules; track r.code) {
            <tr>
              <td>
                <code>{{ r.code }}</code>
              </td>
              <td>{{ r.event }}</td>
              <td class="muted">{{ r.condition }}</td>
              <td>{{ r.recipients }}</td>
              <td>{{ r.channels.join(' · ') }}</td>
              <td>
                <span class="tag" [class.good]="r.enabled">{{ r.enabled ? 'Bật' : 'Tắt' }}</span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="columns">
      <section>
        <h4>Kênh gửi</h4>
        <p class="english">Channels · phase 1</p>
        <table>
          <thead>
            <tr>
              <th>Kênh</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            @for (c of channels; track c.name) {
              <tr>
                <td>{{ c.name }}</td>
                <td>
                  <span class="tag" [class.good]="c.status === 'Bật'">{{ c.status }}</span>
                </td>
                <td class="muted">{{ c.note }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
      <section>
        <h4>Chống dội &amp; giờ yên lặng</h4>
        <p class="english">Throttling · enforced server-side</p>
        <p>
          Giờ yên lặng 23:00–07:00: cảnh báo không đẩy Email/Zalo mà gộp vào digest sáng hôm sau.
        </p>
        <p>Chống dội: tối đa 1 cảnh báo cùng loại / nhân viên / 30 phút.</p>
        <p class="muted">
          <small
            >Cả hai quy tắc chạy ở backend, không phụ thuộc màn hình này — tắt trình duyệt không làm
            mất cảnh báo.</small
          >
        </p>
      </section>
    </div>`,
})
export class NotificationRulesPage {
  auth = inject(Auth);
  rules = NOTIFICATION_RULES;
  channels = NOTIFICATION_CHANNELS;
}
