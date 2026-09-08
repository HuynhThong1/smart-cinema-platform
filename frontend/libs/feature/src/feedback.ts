import {
  CinemaBadge,
  CinemaButton,
  CinemaCheckbox,
  CinemaInput,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Feedback,
  Page,
  Staff,
  Reason,
  FeedbackConfig,
  download,
  errorMessage,
} from '@cinema/core';
import { AsyncPage, Filters, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-feedback-list',
  imports: [
    CinemaBadge,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaTable,
    FormsModule,
    RouterLink,
    Overlay,
    RowLink,
    Filters,
    PageState,
    Pager,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('dashboard.feedback_124') }}</p>
        <h2>{{ i18n.t('feedback.all_feedback') }}</h2>
      </div>
      <button type="button" cinemaButton class="secondary" (click)="export()" [disabled]="busy()">
        {{ i18n.t('dashboard.export_csv') }}
      </button>
    </div>
    <cinema-filters
      [initialCinemaId]="route.snapshot.queryParamMap.get('cinemaId') || ''"
      (changed)="setFilters($event)"
    />
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        cinemaInput
        [attr.aria-label]="i18n.t('feedback.search_customers')"
        name="search"
        [(ngModel)]="search"
        [placeholder]="i18n.t('feedback.name_or_phone_number')"
      /><cinema-select [aria-label]="i18n.t('feedback.rating')" name="rating" [(ngModel)]="rating">
        <cinema-option [value]="''" [label]="i18n.t('feedback.all_ratings')" />
        <cinema-option [value]="'negative'" [label]="i18n.t('feedback.1_2_negative')" />
        <cinema-option [value]="'neutral'" [label]="i18n.t('feedback.3_neutral')" />
        <cinema-option
          [value]="'positive'"
          [label]="i18n.t('feedback.4_5_positive')" /></cinema-select
      ><cinema-select [aria-label]="i18n.t('coaching.staff')" name="staff" [(ngModel)]="staffId">
        <cinema-option [value]="''" [label]="i18n.t('feedback.all_staff')" />
        @for (s of staff(); track s.id) {
          <cinema-option [value]="s.id" [label]="s.staffCode + ' · ' + s.name" />
        }</cinema-select
      ><cinema-select [aria-label]="i18n.t('feedback.reason')" name="reason" [(ngModel)]="reason">
        <cinema-option [value]="''" [label]="i18n.t('feedback.all_reasons')" />
        @for (r of reasons(); track r.code) {
          <cinema-option [value]="r.code" [label]="i18n.label(r)" />
        }</cinema-select
      ><cinema-select
        [aria-label]="i18n.t('transaction.label')"
        name="hasTransaction"
        [(ngModel)]="hasTransaction"
      >
        <cinema-option [value]="''" [label]="i18n.t('transaction.all')" />
        <cinema-option [value]="'true'" [label]="i18n.t('transaction.has')" />
        <cinema-option [value]="'false'" [label]="i18n.t('transaction.none')" /> </cinema-select
      ><label class="checkbox-label"
        ><cinema-checkbox name="suspicious" [(ngModel)]="suspicious" />{{
          i18n.t('feedback.suspicious_only')
        }}</label
      ><button cinemaButton class="secondary" type="submit">{{ i18n.t('feedback.filter') }}</button>
    </form>
    <cinema-state [busy]="busy()" [error]="i18n.t(error())" (retry)="load()" />
    @if (detailError()) {
      <div class="error-panel" role="alert">{{ detailError() }}</div>
    }
    @if (!busy()) {
      <div class="table-wrap">
        <cinema-table [rows]="data().items" [columns]="9"
          ><ng-template #header>
            <tr>
              <th>{{ i18n.t('administration.time') }}</th>
              <th>{{ i18n.t('dashboard.rating') }}</th>
              <th>{{ i18n.t('feedback.customer') }}</th>
              <th>{{ i18n.t('feedback.phone') }}</th>
              <th>{{ i18n.t('coaching.staff') }}</th>
              <th>{{ i18n.t('dashboard.cinema') }}</th>
              <th>{{ i18n.t('feedback.reason') }}</th>
              <th>{{ i18n.t('transaction.label') }}</th>
              <th>{{ i18n.t('feedback.flag') }}</th>
            </tr> </ng-template
          ><ng-template #body let-f
            ><tr (rowOpen)="open(f.id)">
              <td>{{ localDate(f.createdAt) }}</td>
              <td>
                <cinema-badge
                  class="tag"
                  [class.bad]="f.rating.value < 3"
                  [class.good]="f.rating.value > 3"
                  >{{ f.rating.value }} · {{ i18n.label(f.rating) }}</cinema-badge
                >
              </td>
              <td>{{ f.customer.name }}</td>
              <td>{{ f.customer.phone }}</td>
              <td>{{ f.staff.code }}</td>
              <td>{{ f.cinema.name }}</td>
              <td>
                @for (r of f.reasons; track r.code) {
                  <span>{{ i18n.label(r) }} · </span>
                }
              </td>
              <td>{{ f.transactionId || '—' }}</td>
              <td>{{ f.metadata.suspicious ? '⚑' : '' }}</td>
            </tr></ng-template
          ><ng-template #empty
            ><tr>
              <td colspan="9">{{ i18n.t('feedback.no_feedback_matches_these_filters') }}</td>
            </tr></ng-template
          ></cinema-table
        >
      </div>
      <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
    }
    <cinema-overlay
      [saving]="busy()"
      [(open)]="drawer"
      variant="drawer"
      [header]="i18n.t('feedback.feedback_details')"
    >
      @if (detail(); as f) {
        <p class="english">{{ localDate(f.createdAt) }}</p>
        <h3>{{ f.rating.value }} / 5 · {{ i18n.label(f.rating) }}</h3>
        @if (f.metadata.suspicious) {
          <p class="tag bad">{{ i18n.t('feedback.suspicious_feedback') }}</p>
        }
        <dl>
          <dt>{{ i18n.t('transaction.label') }}</dt>
          <dd>
            {{ f.transactionId || '—' }}
            @if (f.transactionId) {
              <br />{{
                i18n.t(f.transactionVerified ? 'transaction.verified' : 'transaction.notVerified')
              }}
              · {{ i18n.t('transaction.' + (f.transactionSource || 'NONE')) }}
            }
          </dd>
          <dt>{{ i18n.t('feedback.customer') }}</dt>
          <dd>{{ f.customer.name }}<br />{{ f.customer.phone }}</dd>
          <dt>{{ i18n.t('coaching.staff') }}</dt>
          <dd>{{ f.staff.code }} · {{ f.staff.name }}</dd>
          <dt>{{ i18n.t('dashboard.cinema') }}</dt>
          <dd>{{ f.cinema.name }}</dd>
          <dt>{{ i18n.t('feedback.reason') }}</dt>
          <dd>
            <div class="chips">
              @for (r of f.reasons; track r.code) {
                <cinema-badge class="tag">{{ i18n.label(r) }}</cinema-badge>
              }
            </div>
          </dd>
          <dt>{{ i18n.t('feedback.comment') }}</dt>
          <dd>
            <em>{{ f.comment || i18n.t('feedback.no_comment') }}</em>
          </dd>
          <dt>{{ i18n.t('feedback.privacy_consent') }}</dt>
          <dd>{{ f.consent.version }} · {{ localDate(f.consent.acceptedAt) }}</dd>
        </dl>
        <div class="overlay-actions">
          <a cinemaButton class="secondary" [routerLink]="['/staff', f.staff.id, 'performance']">{{
            i18n.t('dashboard.staff_performance')
          }}</a
          ><a
            cinemaButton
            class="primary"
            routerLink="/coaching"
            [queryParams]="{ staffId: f.staff.id, create: 'true' }"
            >{{ i18n.t('coaching.create_coaching_43') }}</a
          >
        </div>
      }
    </cinema-overlay>`,
})
export class FeedbackList extends AsyncPage {
  route = inject(ActivatedRoute);
  data = signal<Page<Feedback>>({ items: [], total: 0, page: 1, pageSize: 20 });
  staff = signal<Staff[]>([]);
  reasons = signal<Reason[]>([]);
  detail = signal<Feedback | null>(null);
  detailError = signal('');
  drawer = false;
  page = signal(1);
  search = '';
  rating = this.route.snapshot.queryParamMap.get('rating') || '';
  staffId = this.route.snapshot.queryParamMap.get('staffId') || '';
  reason = '';
  suspicious = false;
  hasTransaction = '';
  params: Record<string, string | boolean> = {};
  localDate = (value: string) => this.i18n.date(value);
  async ngOnInit() {
    const feedbackId = this.route.snapshot.queryParamMap.get('feedbackId');
    if (feedbackId) void this.open(feedbackId);
    try {
      this.staff.set((await this.api.get<Page<Staff>>('/admin/staff', { pageSize: 100 })).items);
      this.reasons.set((await this.api.get<FeedbackConfig>('/public/feedback-config')).reasons);
    } catch {
      /* Main fetch reports failures. */
    }
  }
  setFilters(p: Record<string, string | boolean>) {
    this.params = { ...p };
    this.page.set(1);
    void this.load();
  }
  query() {
    return {
      ...this.params,
      search: this.search,
      rating: this.rating,
      staffId: this.staffId,
      reason: this.reason,
      suspicious: this.suspicious,
      hasTransaction: this.hasTransaction,
      page: this.page(),
    };
  }
  load() {
    return this.run(async (isCurrent) => {
      const result = await this.api.get<Page<Feedback>>('/admin/feedbacks', this.query());
      if (isCurrent()) this.data.set(result);
    });
  }
  // Kept off the shared run() state: the list reloads on its own as soon as the
  // filters emit, and that newer request would otherwise discard this error and
  // leave a notification deep link failing silently.
  async open(id: string) {
    this.detailError.set('');
    try {
      this.detail.set(await this.api.get<Feedback>('/admin/feedbacks/' + id));
      this.drawer = true;
    } catch (e) {
      this.detailError.set(errorMessage(e));
    }
  }
  export() {
    return this.run(async () =>
      download(await this.api.blob('/admin/feedbacks/export', this.query()), 'feedback.csv'),
    );
  }
}
