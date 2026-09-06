import { Component, Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, Page } from '@cinema/core';
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
const INBOX_TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});
/** `05/09 21:59` — date first, no year, matching the design's inbox dateline. */
export function inboxTime(value: string) {
  const p = Object.fromEntries(
    INBOX_TIME.formatToParts(new Date(value)).map((x) => [x.type, x.value]),
  );
  return `${p['day']}/${p['month']} ${p['hour']}:${p['minute']}`;
}
/** Inbox kinds from the design system. ALERT needs action this shift. */
export type NotificationKind = 'ALERT' | 'SYSTEM' | 'DIGEST' | 'TASK';

/**
 * Phase 1 only emits feedback notifications, so the kind is a pure function of
 * the record: a suspicious submission is an operational event, a 1-2 star score
 * needs handling in the shift, anything else is informational. Move this to a
 * stored field once the API starts emitting import, QR, digest and coaching
 * notifications, which are not derivable from these columns.
 */
export function notificationKind(n: FeedbackNotification): NotificationKind {
  if (n.suspicious) return 'SYSTEM';
  return n.rating <= 2 ? 'ALERT' : 'SYSTEM';
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
    @if (counter.count()) {
      <span class="tag bell-count" aria-hidden="true">{{ counter.count() }}</span>
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
  imports: [PageState, Pager],
  template: `<div class="page-title">
      <div>
        <p class="kicker">Notifications</p>
        <h2>Hộp thư thông báo</h2>
        <p class="english">Cảnh báo realtime · báo cáo định kỳ · sự kiện hệ thống</p>
      </div>
      <button class="secondary" (click)="load()" [disabled]="busy()">Làm mới</button>
    </div>
    <div class="pill-row" role="group" aria-label="Lọc thông báo">
      @for (f of filters(); track f.key) {
        <button
          class="pill"
          type="button"
          [attr.aria-pressed]="filter() === f.key"
          (click)="pick(f.key)"
        >
          {{ f.label }} ({{ f.count }})
        </button>
      }
      <span class="spacer"></span>
      <button
        class="secondary"
        (click)="markAllRead()"
        [disabled]="busy() || marking() || !unreadCount()"
      >
        Đánh dấu tất cả đã đọc
      </button>
    </div>
    <p class="muted"><small>Tự cập nhật mỗi 15 giây</small></p>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    @if (!busy()) {
      <div class="notif-list">
        @for (n of shown(); track n.id) {
          <article class="notif-row" [class.read]="n.readAt">
            <span
              class="notif-dot"
              [class.alert]="kind(n) === 'ALERT'"
              [attr.role]="n.readAt ? null : 'img'"
              [attr.aria-label]="n.readAt ? null : 'Chưa đọc'"
            ></span>
            <div>
              <p class="notif-meta">
                <span
                  class="tag"
                  [class.bad]="kind(n) === 'ALERT'"
                  [class.good]="kind(n) === 'TASK'"
                  >{{ kind(n) }}</span
                ><span>{{ inboxTime(n.createdAt) }} · {{ ago(n.createdAt) }}</span>
              </p>
              <h3>{{ title(n) }}</h3>
              <p class="notif-body">{{ body(n) }}</p>
            </div>
            <div class="notif-actions">
              <a class="secondary" [href]="feedbackUrl(n)" (click)="openFeedback($event, n)"
                >Xem feedback</a
              >
              @if (!n.readAt) {
                <button class="text-button" (click)="markRead(n)" [disabled]="reading() === n.id">
                  Đánh dấu đã đọc
                </button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">
            <h4>Không có thông báo</h4>
            <p class="muted">
              {{
                filter() === 'unread'
                  ? 'Bạn đã đọc hết thông báo.'
                  : 'Chưa có thông báo nào trong bộ lọc này.'
              }}
            </p>
          </div>
        }
      </div>
      <cinema-pager
        [page]="page()"
        [total]="data().total"
        [busy]="busy()"
        (changed)="page.set($event); load()"
      />
    }
    <div class="note-block">
      <h4>Quy ước</h4>
      <p class="muted">
        ALERT là cảnh báo cần xử lý trong ca · SYSTEM là sự kiện vận hành (import, QR, nghi vấn) ·
        DIGEST là báo cáo theo lịch · TASK là việc coaching đến hạn. Thông báo giữ 90 ngày, sau đó
        tự lưu trữ.
      </p>
    </div>`,
})
export class NotificationsPage extends AsyncPage {
  counter = inject(NotificationCounter);
  private router = inject(Router);
  data = signal<Page<FeedbackNotification>>({ items: [], total: 0, page: 1, pageSize: 20 });
  page = signal(1);
  reading = signal('');
  marking = signal(false);
  filter = signal<'all' | 'unread' | NotificationKind>('all');
  inboxTime = inboxTime;
  kind = notificationKind;
  private polling = false;
  private revision = 0;
  // The unread filter is a server query so it can page past the current window;
  // kind is derived per record, so those pills narrow what is already loaded.
  private items = computed(() => this.data().items);
  /** Server total for the whole inbox, held across an unread-only query. */
  private totalAll = signal(0);
  unreadCount = computed(() => this.counter.count() ?? 0);
  shown = computed(() => {
    const f = this.filter();
    return this.items().filter((n) =>
      f === 'all' || f === 'unread' ? true : notificationKind(n) === f,
    );
  });
  filters = computed(() => {
    const items = this.items();
    const count = (k: NotificationKind) => items.filter((n) => notificationKind(n) === k).length;
    const kinds: { key: NotificationKind; label: string }[] = [
      { key: 'ALERT', label: 'Cảnh báo' },
      { key: 'SYSTEM', label: 'Hệ thống' },
      { key: 'DIGEST', label: 'Báo cáo' },
      { key: 'TASK', label: 'Việc cần làm' },
    ];
    return [
      { key: 'all' as const, label: 'Tất cả', count: this.totalAll() },
      { key: 'unread' as const, label: 'Chưa đọc', count: this.unreadCount() },
      // A kind the platform does not emit yet would sit at a permanent zero, so
      // it is left out rather than shipped as a control that can never do anything.
      ...kinds.map((k) => ({ ...k, count: count(k.key) })).filter((k) => k.count > 0),
    ];
  });
  constructor() {
    super();
    const timer = setInterval(() => {
      if (!document.hidden && !this.busy() && !this.polling && !this.reading() && !this.marking())
        void this.poll();
    }, 15000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.revision++;
    });
  }
  ngOnInit() {
    void this.load();
  }
  title(n: FeedbackNotification) {
    if (n.suspicious) return 'Phát hiện feedback nghi vấn';
    return n.rating <= 2
      ? `Feedback ${n.rating}★ mới — ${n.staffName}`
      : `Feedback mới — ${n.staffName}`;
  }
  body(n: FeedbackNotification) {
    if (n.suspicious)
      return 'Đã gắn cờ nghi vấn và loại khỏi ranking cho tới khi được kiểm tra lại.';
    return n.rating <= 2
      ? `Khách chấm ${n.rating}/5 cho ${n.staffName}. Cần xem và xử lý trong ca.`
      : `Khách chấm ${n.rating}/5 cho ${n.staffName}.`;
  }
  /** Relative time in Vietnamese, matching the design's `2 phút trước` line. */
  ago(value: string) {
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'Hôm qua' : `${days} ngày trước`;
  }
  pick(key: 'all' | 'unread' | NotificationKind) {
    const wasUnread = this.filter() === 'unread';
    this.filter.set(key);
    if (wasUnread !== (key === 'unread')) {
      this.page.set(1);
      void this.load();
    }
  }
  // Falls back to the full inbox when a reload drops the kind currently selected,
  // so the list cannot strand the reader on a filter with nothing behind it.
  private reconcileFilter() {
    const f = this.filter();
    if (f === 'all' || f === 'unread') return;
    if (!this.filters().some((x) => x.key === f)) this.filter.set('all');
  }
  private store(p: Page<FeedbackNotification>) {
    this.data.set(p);
    if (this.filter() !== 'unread') this.totalAll.set(p.total);
    this.reconcileFilter();
  }
  private fetch() {
    return this.api.get<Page<FeedbackNotification>>('/admin/notifications', {
      page: this.page(),
      unread: this.filter() === 'unread',
    });
  }
  load() {
    this.revision++;
    return this.run(async (current) => {
      const p = await this.fetch();
      if (current()) this.store(p);
      await this.counter.refresh();
    });
  }
  private async poll() {
    this.polling = true;
    const revision = this.revision;
    try {
      const p = await this.fetch();
      if (revision === this.revision) {
        this.store(p);
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
  async markAllRead() {
    if (this.marking() || !this.unreadCount()) return;
    this.marking.set(true);
    this.revision++;
    try {
      const { updated } = await this.api.put<{ updated: number }>(
        '/admin/notifications/read-all',
        {},
      );
      this.notify(`Đã đánh dấu ${updated} thông báo là đã đọc`);
      await this.load();
    } catch {
      this.error.set('Không đánh dấu được thông báo. Vui lòng thử lại.');
    } finally {
      this.marking.set(false);
    }
  }
  // Marks read before navigating so the request cannot be cut short by this
  // component being destroyed. Modified clicks open a new tab untouched.
  async openFeedback(event: MouseEvent, n: FeedbackNotification) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    await this.goToFeedback(n);
  }
  async goToFeedback(n: FeedbackNotification) {
    if (!(await this.mark(n))) return;
    await this.counter.refresh();
    await this.router.navigateByUrl(this.feedbackUrl(n));
  }
}
