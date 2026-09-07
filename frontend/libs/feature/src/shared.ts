import { I18n } from '@cinema/i18n';
import { CinemaButton, CinemaCheckbox, CinemaDate, CinemaOption, CinemaSelect } from '@cinema/ui';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Auth, Cinema, Page, errorMessage } from '@cinema/core';
export class AsyncPage {
  i18n = inject(I18n);
  api = inject(Api);
  auth = inject(Auth);
  busy = signal(false);
  error = signal('');
  message = signal('');
  private serial = 0;
  async run(work: (isCurrent: () => boolean) => Promise<void>) {
    const id = ++this.serial;
    this.busy.set(true);
    this.error.set('');
    try {
      await work(() => id === this.serial);
    } catch (e) {
      if (id === this.serial) this.error.set(errorMessage(e));
    } finally {
      if (id === this.serial) this.busy.set(false);
    }
  }
  notify(message: string) {
    this.message.set(message);
    setTimeout(() => this.message.set(''), 3500);
  }
}
export { PageState, Pager } from '@cinema/ui';
@Component({
  selector: 'cinema-filters',
  imports: [CinemaButton, CinemaSelect, CinemaOption, CinemaCheckbox, CinemaDate, FormsModule],
  template: ` <div class="toolbar">
    <div class="date-filter">
      <span class="filter-label" id="date-range-label">{{ i18n.t('shared.date_range') }}</span>
      <div class="date-presets" role="group" aria-labelledby="date-range-label">
        @for (option of ranges; track option.value) {
          <button
            cinemaButton
            type="button"
            [attr.aria-pressed]="range === option.value"
            (click)="selectRange(option.value)"
          >
            {{ i18n.t(option.label) }}
          </button>
        }
      </div>
    </div>
    @if (range === 'custom') {
      <div class="custom-dates">
        <label>{{ i18n.t('shared.from') }}<cinema-date [(ngModel)]="from" [max]="to" /></label>
        <label>{{ i18n.t('shared.to') }}<cinema-date [(ngModel)]="to" [min]="from" /></label>
        <button cinemaButton type="button" class="secondary" (click)="emit()">
          {{ i18n.t('shared.apply') }}
        </button>
        @if (rangeError()) {
          <p class="field-error" role="alert">{{ i18n.t(rangeError()) }}</p>
        }
      </div>
    }
    @if (auth.global()) {
      <label
        >{{ i18n.t('dashboard.cinema')
        }}<cinema-select
          [aria-label]="i18n.t('dashboard.cinema')"
          [(ngModel)]="cinemaId"
          (ngModelChange)="emit()"
        >
          <cinema-option [value]="''" [label]="i18n.t('qr.all_cinemas')" />
          @for (c of cinemas(); track c.id) {
            <cinema-option [value]="c.id" [label]="c.name" />
          }</cinema-select
      ></label>
    }
    <label class="checkbox-label"
      ><cinema-checkbox [(ngModel)]="include" (change)="emit()" />{{
        i18n.t('shared.include_suspicious_feedback')
      }}</label
    >
  </div>`,
})
export class Filters {
  i18n = inject(I18n);
  api = inject(Api);
  auth = inject(Auth);
  initialCinemaId = input('');
  changed = output<Record<string, string | boolean>>();
  cinemas = signal<Cinema[]>([]);
  range = '30';
  rangeError = signal('');
  ranges = [
    { value: 'today', label: 'shared.today' },
    { value: 'yesterday', label: 'notifications.yesterday' },
    { value: '7', label: 'shared.7_days' },
    { value: '30', label: 'shared.30_days' },
    { value: 'custom', label: 'shared.custom' },
  ];
  selectRange(value: string) {
    this.range = value;
    this.rangeError.set('');
    if (value !== 'custom') this.emit();
  }
  from = '';
  to = '';
  cinemaId = '';
  include = false;
  async ngOnInit() {
    this.cinemaId = this.initialCinemaId();
    this.emit();
    if (this.auth.global()) {
      try {
        const p = await this.api.get<Page<Cinema>>('/admin/cinemas', {
          pageSize: 100,
        });
        this.cinemas.set(p.items);
      } catch {
        /* Parent page reports API availability. */
      }
    }
  }
  emit() {
    this.rangeError.set('');
    if (
      this.range === 'custom' &&
      (!this.from ||
        !this.to ||
        this.from > this.to ||
        !Number.isFinite(Date.parse(this.from)) ||
        !Number.isFinite(Date.parse(this.to)))
    ) {
      this.rangeError.set(
        'shared.choose_both_start_and_end_dates_the_end_date_must_be_on_or_after_',
      );
      return;
    }
    const p: Record<string, string | boolean> = {
      includeSuspicious: this.include,
    };
    if (this.cinemaId) p['cinemaId'] = this.cinemaId;
    if (this.range === 'custom') {
      if (this.from) p['from'] = new Date(this.from + 'T00:00:00+07:00').toISOString();
      if (this.to)
        p['to'] = new Date(
          new Date(this.to + 'T00:00:00+07:00').getTime() + 86400000,
        ).toISOString();
    } else {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const start = new Date(today + 'T00:00:00+07:00').getTime();
      const days = this.range === 'today' || this.range === 'yesterday' ? 1 : Number(this.range);
      p['from'] = new Date(
        start - (this.range === 'yesterday' ? 1 : days - 1) * 86400000,
      ).toISOString();
      p['to'] = new Date(start + (this.range === 'yesterday' ? 0 : 1) * 86400000).toISOString();
    }
    this.changed.emit(p);
  }
}
