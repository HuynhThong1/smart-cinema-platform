import { CinemaBadge, CinemaEmpty, CinemaButton } from '@cinema/ui';
import { I18n, translatedMessage } from '@cinema/i18n';
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
  i18n = inject(I18n);
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
    class="notification-link"
    routerLink="/notifications"
    [attr.aria-label]="
      counter.count() === null
        ? i18n.t('notifications.notifications_unread_count_unavailable')
        : i18n.t('messages.bell', { count: counter.count() })
    "
    >{{ i18n.t('notification_rules.notifications') }}
    @if (counter.count()) {
      <sup class="bell-count" aria-hidden="true">{{ counter.count() }}</sup>
    }
  </a>`,
})
export class NotificationBell {
  i18n = inject(I18n);
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
  imports: [CinemaBadge, CinemaEmpty, CinemaButton, PageState, Pager],
  template: `<div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('notification_rules.notifications') }}</p>
        <h2>{{ i18n.t('notifications.notification_inbox') }}</h2>
      </div>
      <button type="button" cinemaButton class="secondary" (click)="load()" [disabled]="busy()">
        {{ i18n.t('notifications.refresh') }}
      </button>
    </div>
    <div
      class="pill-row"
      role="group"
      [attr.aria-label]="i18n.t('notifications.filter_notifications')"
    >
      @for (f of filters(); track f.key) {
        <button
          cinemaButton
          class="pill"
          type="button"
          [attr.aria-pressed]="filter() === f.key"
          (click)="pick(f.key)"
        >
          {{ i18n.t(f.label) }} ({{ f.count }})
        </button>
      }
      <span class="spacer"></span>
      <button
        type="button"
        cinemaButton
        class="secondary"
        (click)="markAllRead()"
        [disabled]="busy() || marking() || !unreadCount()"
      >
        {{ i18n.t('notifications.mark_all_as_read') }}
      </button>
    </div>
    <p class="muted">
      <small>{{
        i18n.t('notifications.updates_every_15_seconds_notification_type_filters_apply_to_the_c')
      }}</small>
    </p>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    @if (!busy()) {
      <div class="notif-list">
        @for (n of shown(); track n.id) {
          <article class="notif-row" [class.read]="n.readAt">
            <span
              class="notif-dot"
              [class.alert]="kind(n) === 'ALERT'"
              [attr.role]="n.readAt ? null : 'img'"
              [attr.aria-label]="n.readAt ? null : i18n.t('notifications.unread_270')"
            ></span>
            <div>
              <p class="notif-meta">
                <cinema-badge
                  class="tag"
                  [class.bad]="kind(n) === 'ALERT'"
                  [class.good]="kind(n) === 'TASK'"
                  >{{
                    kind(n) === 'ALERT'
                      ? i18n.t('notifications.needs_attention')
                      : i18n.t('notifications.information')
                  }}</cinema-badge
                ><span>{{ inboxTime(n.createdAt) }} · {{ i18n.t(ago(n.createdAt)) }}</span>
              </p>
              <h3>{{ i18n.t(title(n)) }}</h3>
              <p class="notif-body">{{ i18n.t(body(n)) }}</p>
            </div>
            <div class="notif-actions">
              <a
                cinemaButton
                class="secondary"
                [href]="feedbackUrl(n)"
                (click)="openFeedback($event, n)"
                >{{ i18n.t('notifications.view_feedback') }}</a
              >
              @if (!n.readAt) {
                <button
                  type="button"
                  cinemaButton
                  class="text-button"
                  (click)="markRead(n)"
                  [disabled]="reading() === n.id"
                >
                  {{ i18n.t('notifications.mark_as_read') }}
                </button>
              }
            </div>
          </article>
        } @empty {
          <cinema-empty class="empty">
            <h4>{{ i18n.t('notifications.no_notifications') }}</h4>
            <p class="muted">
              {{
                filter() === 'unread'
                  ? i18n.t('notifications.you_re_all_caught_up')
                  : i18n.t('notifications.no_notifications_match_this_filter')
              }}
            </p>
          </cinema-empty>
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
      <h4>{{ i18n.t('notifications.track_feedback') }}</h4>
      <p class="muted">
        {{
          i18n.t('notifications.notifications_go_to_the_staff_member_s_assigned_direct_manager_ma')
        }}
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
  inboxTime = (value: string) => this.i18n.date(value);
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
      { key: 'ALERT', label: 'notifications.alerts' },
      { key: 'SYSTEM', label: 'notifications.system' },
      { key: 'DIGEST', label: 'notifications.reports' },
      { key: 'TASK', label: 'notifications.tasks' },
    ];
    return [
      { key: 'all' as const, label: 'coaching.all', count: this.totalAll() },
      { key: 'unread' as const, label: 'notifications.unread_270', count: this.unreadCount() },
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
    if (n.suspicious) return 'notifications.suspicious_feedback_detected';
    return n.rating <= 2
      ? translatedMessage('messages.notification_title', { rating: n.rating, name: n.staffName })
      : translatedMessage('messages.notification_title', { rating: n.rating, name: n.staffName });
  }
  body(n: FeedbackNotification) {
    if (n.suspicious)
      return 'notifications.flagged_as_suspicious_and_excluded_from_ranking_pending_review';
    return n.rating <= 2
      ? translatedMessage('messages.notification_urgent', { rating: n.rating, name: n.staffName })
      : translatedMessage('messages.notification_body', { rating: n.rating, name: n.staffName });
  }
  /** Relative time in Vietnamese, matching the design's `2 phút trước` line. */
  ago(value: string) {
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'notifications.just_now';
    if (minutes < 60) return translatedMessage('messages.minutes_ago', { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return translatedMessage('messages.hours_ago', { count: hours });
    const days = Math.round(hours / 24);
    return days === 1
      ? 'notifications.yesterday'
      : translatedMessage('messages.days_ago', { count: days });
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
        this.error.set('notifications.unable_to_update_notifications_please_retry');
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
      this.error.set('notifications.unable_to_mark_notifications_please_retry');
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
      this.notify(translatedMessage('messages.marked_read', { count: updated }));
      await this.load();
    } catch {
      this.error.set('notifications.unable_to_mark_notifications_please_retry');
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
