import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dashboard } from '@cinema/core';
import { AsyncPage, PageState } from './shared';

export interface AppModule {
  code: string;
  title: string;
  english: string;
  description: string;
  phase: string;
  meta: string;
  /** Set once the module ships; an unset route renders the tile disabled. */
  route?: string;
}

/**
 * Registry of every module the platform knows how to render. What a given user
 * sees is intersected with the entitlement list on their token, so a module the
 * account holds no entitlement for is hidden rather than shown locked. Until the
 * API publishes that list the registry stands in for it, which is correct while
 * Phase 1 ships a single module every admin role can reach.
 */
export const MODULES: AppModule[] = [
  {
    code: 'FBQ',
    title: 'Transaction Feedback QR',
    english: 'Đánh giá giao dịch qua QR',
    description: 'Feedback khách hàng, QR nhân viên, ranking, coaching, cảnh báo.',
    phase: 'Phase 1 · Đang chạy',
    meta: '',
    route: '/dashboard',
  },
  {
    code: 'BOX',
    title: 'Bán vé & Suất chiếu',
    english: 'Box office & showtimes',
    description: 'Lịch chiếu, sơ đồ ghế, đơn vé và hoàn vé.',
    phase: 'Phase 2',
    meta: 'Dự kiến Q4/2026',
  },
  {
    code: 'FNB',
    title: 'F&B & Combo',
    english: 'Concession',
    description: 'Menu bắp nước, combo, tồn kho quầy.',
    phase: 'Phase 2',
    meta: 'Dự kiến Q4/2026',
  },
  {
    code: 'CRM',
    title: 'Khách hàng thân thiết',
    english: 'Loyalty & CRM',
    description: 'Hạng thành viên, điểm tích luỹ, chiến dịch ưu đãi.',
    phase: 'Phase 3',
    meta: 'Đang khảo sát',
  },
  {
    code: 'WFM',
    title: 'Ca làm & Chấm công',
    english: 'Workforce',
    description: 'Xếp ca, chấm công, liên kết hiệu suất nhân viên.',
    phase: 'Phase 3',
    meta: 'Đang khảo sát',
  },
  {
    code: 'OPS',
    title: 'Vận hành rạp',
    english: 'Cinema operations',
    description: 'Checklist mở/đóng rạp, sự cố thiết bị, bảo trì.',
    phase: 'Phase 3',
    meta: 'Đang khảo sát',
  },
];

@Component({
  selector: 'cinema-modules',
  imports: [RouterLink, PageState],
  template: `<p class="kicker">Sau đăng nhập</p>
    <h2>Chọn chức năng</h2>
    <p class="english">Module launcher — Smart Cinema Platform</p>
    <p class="muted">
      {{ auth.user()?.name }} · {{ roleName() }} ·
      {{ auth.global() ? 'Toàn hệ thống' : 'Rạp được phân quyền' }} — chỉ hiện các module bạn có
      quyền truy cập.
    </p>
    <cinema-state [message]="message()" />
    <div class="module-grid">
      @for (m of modules; track m.code) {
        @if (m.route) {
          <a class="module-card" [routerLink]="m.route">
            <span class="module-head"
              ><span class="kicker">{{ m.code }}</span
              ><span class="tag good">{{ m.phase }}</span></span
            >
            <h3>{{ m.title }}</h3>
            <p class="english">{{ m.english }}</p>
            <p class="module-desc">{{ m.description }}</p>
            <span class="module-meta"
              ><span>{{ todayLabel() }}</span
              ><span class="module-action" aria-hidden="true">Vào chức năng →</span></span
            >
          </a>
        } @else {
          <button
            type="button"
            class="module-card locked"
            [attr.aria-label]="m.title + ' — ' + m.phase + ', chưa mở trong bản này'"
            (click)="locked(m)"
          >
            <span class="module-head"
              ><span class="kicker">{{ m.code }}</span
              ><span class="tag">{{ m.phase }}</span></span
            >
            <h3>{{ m.title }}</h3>
            <p class="english">{{ m.english }}</p>
            <p class="module-desc">{{ m.description }}</p>
            <span class="module-meta"
              ><span>{{ m.meta }}</span
              ><span class="module-action">Chưa mở</span></span
            >
          </button>
        }
      }
    </div>
    <div class="note-block">
      <p class="muted">
        Phase 1 chỉ mở Transaction Feedback QR. Các module còn lại giữ chỗ trong menu để điều hướng
        và phân quyền không phải làm lại khi mở rộng — quyền truy cập lấy từ role trong Keycloak.
      </p>
    </div>`,
})
export class ModuleLauncherPage extends AsyncPage {
  modules = MODULES;
  today = signal<number | null>(null);
  roleName = () =>
    ({
      SYSTEM_ADMIN: 'System Admin',
      HEAD_OFFICE: 'Head Office',
      CINEMA_MANAGER: 'Cinema Manager',
    })[this.auth.user()?.role || 'CINEMA_MANAGER'];
  todayLabel() {
    const count = this.today();
    return count === null ? 'Đang chạy' : count + ' feedback hôm nay';
  }
  async ngOnInit() {
    // The live tile carries a real number rather than a decorative one. A failed
    // lookup falls back to the neutral label instead of blocking the launcher.
    const start = new Date(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()) + 'T00:00:00+07:00',
    );
    try {
      const d = await this.api.get<Dashboard>('/admin/dashboard', {
        from: start.toISOString(),
        to: new Date(start.getTime() + 86400000).toISOString(),
      });
      this.today.set(d.summary[0]?.count ?? 0);
    } catch {
      this.today.set(null);
    }
  }
  locked(m: AppModule) {
    this.notify('Chức năng thuộc ' + m.phase + ' — chưa mở trong bản này');
  }
}
