import { Component, Injectable, inject, signal, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Api, Page, localDate } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';

export interface FeedbackNotification {
  id: string;
  feedbackId: string;
  staffName: string;
  rating: number;
  suspicious: boolean;
  createdAt: string;
  readAt: string | null;
}
@Injectable({ providedIn: 'root' })
export class NotificationCounter {
  private api = inject(Api);
  count = signal<number | null>(null);
  private pending = false;
  async refresh() {
    if (this.pending) return;
    this.pending = true;
    try {
      this.count.set(
        (await this.api.get<{ count: number }>('/admin/notifications/unread-count')).count,
      );
    } catch {
      this.count.set(null);
    } finally {
      this.pending = false;
    }
  }
}
@Component({
  selector: 'cinema-notification-bell',
  imports: [RouterLink],
  template: `<a
    class="secondary"
    routerLink="/notifications"
    [attr.aria-label]="
      counter.count() === null
        ? 'Thông báo · chưa tải được số chưa đọc'
        : 'Thông báo · ' + counter.count() + ' chưa đọc'
    "
    >Thông báo
    @if (counter.count() !== null) {
      <span class="tag">{{ counter.count() }}</span>
    } @else {
      <span>—</span>
    }
  </a>`,
})
export class NotificationBell {
  counter = inject(NotificationCounter);
  constructor() {
    void this.counter.refresh();
    const refresh = () => {
      if (!document.hidden) void this.counter.refresh();
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      this.counter.count.set(null);
    });
  }
}
@Component({
  selector: 'cinema-notifications',
  imports: [FormsModule, PageState, Pager],
  template: `<div class="page-title">
      <div>
        <p class="kicker">Thông báo</p>
        <h2>Feedback của nhân viên</h2>
        <p class="english">Your team's latest customer feedback</p>
      </div>
      <button class="secondary" (click)="load()" [disabled]="busy()">Làm mới</button>
    </div>
    <div class="toolbar">
      <label class="checkbox-label"
        ><input type="checkbox" [(ngModel)]="unread" (ngModelChange)="page.set(1); load()" />Chỉ
        chưa đọc</label
      ><span class="muted">Tự cập nhật mỗi 15 giây</span>
    </div>
    <cinema-state [busy]="busy()" [error]="error()" (retry)="load()" />
    @if (!busy()) {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Nhân viên</th>
              <th>Đánh giá</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (n of data().items; track n.id) {
              <tr>
                <td>{{ localDate(n.createdAt) }}</td>
                <td>{{ n.staffName }}</td>
                <td>
                  <span class="tag" [class.bad]="n.rating <= 2" [class.good]="n.rating >= 4"
                    >{{ n.rating }}/5</span
                  >
                  @if (n.rating <= 2) {
                    <strong class="negative">Cần xử lý sớm</strong>
                  }
                  @if (n.suspicious) {
                    <span class="tag">Nghi vấn</span>
                  }
                </td>
                <td>{{ n.readAt ? 'Đã đọc' : 'Chưa đọc' }}</td>
                <td>
                  <div class="actions">
                    <a [href]="feedbackUrl(n)" (click)="openFeedback($event, n)">Xem feedback</a>
                    @if (!n.readAt) {
                      <button
                        class="text-button"
                        (click)="markRead(n)"
                        [disabled]="reading() === n.id"
                      >
                        Đánh dấu đã đọc
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">
                  {{
                    unread
                      ? 'Bạn đã đọc hết thông báo.'
                      : 'Chưa có thông báo. Feedback mới sẽ xuất hiện khi bạn được gán làm quản lý trực tiếp.'
                  }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    }`,
})
export class NotificationsPage extends AsyncPage {
  counter = inject(NotificationCounter);
  private router = inject(Router);
  data = signal<Page<FeedbackNotification>>({ items: [], total: 0, page: 1, pageSize: 20 });
  page = signal(1);
  reading = signal('');
  unread = false;
  localDate = localDate;
  private polling = false;
  private revision = 0;
  constructor() {
    super();
    const timer = setInterval(() => {
      if (!document.hidden && !this.busy() && !this.polling && !this.reading()) void this.poll();
    }, 15000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.revision++;
    });
  }
  ngOnInit() {
    void this.load();
  }
  private fetch() {
    return this.api.get<Page<FeedbackNotification>>('/admin/notifications', {
      page: this.page(),
      unread: this.unread,
    });
  }
  load() {
    this.revision++;
    return this.run(async (current) => {
      const p = await this.fetch();
      if (current()) this.data.set(p);
      await this.counter.refresh();
    });
  }
  private async poll() {
    this.polling = true;
    const revision = this.revision;
    try {
      const p = await this.fetch();
      if (revision === this.revision) {
        this.data.set(p);
        this.error.set('');
      }
    } catch {
      if (revision === this.revision)
        this.error.set('Không cập nhật được thông báo. Vui lòng thử lại.');
    } finally {
      this.polling = false;
    }
  }
  feedbackUrl(n: FeedbackNotification) {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/feedback'], { queryParams: { feedbackId: n.feedbackId } }),
    );
  }
  // Reports whether the notification is now read, so callers can keep the user
  // on this page instead of navigating away from a failure they never saw.
  private async mark(n: FeedbackNotification) {
    if (n.readAt) return true;
    if (this.reading()) return false;
    this.reading.set(n.id);
    this.revision++;
    try {
      await this.api.put('/admin/notifications/' + n.id + '/read', {});
      return true;
    } catch {
      this.error.set('Không đánh dấu được thông báo. Vui lòng thử lại.');
      return false;
    } finally {
      this.reading.set('');
    }
  }
  async markRead(n: FeedbackNotification) {
    if (n.readAt || this.reading()) return;
    if (await this.mark(n)) await this.load();
  }
  // Marks read before navigating so the request cannot be cut short by this
  // component being destroyed. Modified clicks open a new tab untouched.
  async openFeedback(event: MouseEvent, n: FeedbackNotification) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (!(await this.mark(n))) return;
    await this.counter.refresh();
    await this.router.navigateByUrl(this.feedbackUrl(n));
  }
}
