import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NotificationBell } from '../../../../libs/feature/src/notifications';
import { Auth } from '@cinema/core';
@Component({
  selector: 'cinema-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationBell],
  template: ` <div class="admin-shell">
    <header class="masthead">
      <div>
        <a routerLink="/" class="masthead-title">SMART CINEMA PLATFORM</a>
        <div class="kicker">Galaxy Cinema · Transaction Feedback QR</div>
      </div>
      <div class="actions">
        <cinema-notification-bell /><span class="muted">{{ auth.user()?.name }}</span
        ><button class="text-button" (click)="auth.account()">Tài khoản</button
        ><button class="secondary" (click)="auth.logout()">Đăng xuất</button>
      </div>
    </header>
    <div class="admin-layout">
      <aside class="sidebar">
        <div class="kicker">Phạm vi quản trị</div>
        <strong>{{ roleName() }}</strong>
        <p class="english">
          {{
            auth.global() ? 'Toàn hệ thống / All cinemas' : 'Rạp được phân quyền / Assigned cinema'
          }}
        </p>
        <nav aria-label="Điều hướng chính">
          @for (group of groups; track group.title) {
            @if (!group.global || auth.global()) {
              <div class="nav-group">
                <h3>{{ group.title }}</h3>
                @for (item of group.items; track item.path) {
                  @if (
                    (!item.global || auth.global()) &&
                    (!item.admin || auth.user()?.role === 'SYSTEM_ADMIN')
                  ) {
                    <a
                      [routerLink]="item.path"
                      routerLinkActive="active"
                      [routerLinkActiveOptions]="{ exact: true }"
                      >{{ item.label }}</a
                    >
                  }
                }
              </div>
            }
          }
        </nav>
      </aside>
      <main><router-outlet /></main>
    </div>
  </div>`,
})
export class Shell {
  auth = inject(Auth);
  roleName() {
    return {
      SYSTEM_ADMIN: 'System Admin',
      HEAD_OFFICE: 'Head Office',
      CINEMA_MANAGER: 'Cinema Manager',
    }[this.auth.user()?.role || 'CINEMA_MANAGER'];
  }
  groups: {
    title: string;
    global?: boolean;
    items: { path: string; label: string; global?: boolean; admin?: boolean }[];
  }[] = [
    {
      title: 'Tổng quan',
      items: [
        { path: '/', label: 'Menu chức năng' },
        { path: '/dashboard', label: 'Dashboard' },
      ],
    },
    {
      title: 'Feedback',
      items: [
        { path: '/feedback', label: 'Tất cả feedback' },
        { path: '/analytics', label: 'Phân tích' },
      ],
    },
    {
      title: 'Nhân viên',
      items: [
        { path: '/staff', label: 'Danh sách nhân viên' },
        { path: '/staff/import', label: 'Import Excel / CSV' },
        { path: '/qr', label: 'Quản lý QR' },
      ],
    },
    {
      title: 'Hiệu suất',
      items: [
        { path: '/ranking/staff', label: 'Ranking nhân viên' },
        { path: '/ranking/cinema', label: 'Ranking rạp', global: true },
      ],
    },
    {
      title: 'Coaching',
      items: [{ path: '/coaching', label: 'Coaching cases' }],
    },
    {
      title: 'Thông báo',
      items: [
        { path: '/notifications', label: 'Hộp thư thông báo' },
        { path: '/notification-rules', label: 'Quy tắc & kênh gửi' },
      ],
    },
    {
      title: 'Cấu hình',
      global: true,
      items: [
        { path: '/rating', label: 'Rating' },
        { path: '/reasons', label: 'Lý do feedback' },
      ],
    },
    {
      title: 'Hệ thống',
      items: [
        { path: '/cinemas', label: 'Rạp', global: true },
        { path: '/users', label: 'Người dùng', admin: true },
        { path: '/audit', label: 'Audit log' },
      ],
    },
  ];
}
@Component({
  selector: 'cinema-login',
  template: `<main class="login-page">
    <img src="/galaxy-logo.png" width="150" alt="Galaxy Cinema" />
    <p class="kicker">Smart Cinema Platform</p>
    <h1>Đăng nhập quản trị</h1>
    <p class="english">Sign in to your cinema workspace</p>
    <p>Sử dụng tài khoản được cấp để quản lý feedback và chất lượng dịch vụ tại rạp.</p>
    @if (auth.failed()) {
      <p class="error-panel" role="alert">
        Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại.
      </p>
    }
    <button class="primary submit" (click)="auth.login()">Đăng nhập</button>
    <p class="footnote">Quên hoặc đổi mật khẩu tại màn hình đăng nhập.</p>
  </main>`,
})
export class Login {
  auth = inject(Auth);
}
@Component({
  selector: 'cinema-forbidden',
  imports: [RouterLink],
  template: `<p class="kicker negative">403 · Permission denied</p>
    <h2>Bạn không có quyền xem nội dung này</h2>
    <p>Vui lòng liên hệ quản trị viên nếu cần thay đổi phạm vi truy cập.</p>
    <a routerLink="/dashboard" class="secondary">Về dashboard</a>`,
})
export class Forbidden {}
