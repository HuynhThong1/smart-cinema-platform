import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Auth, Cinema, Page, errorMessage } from '@cinema/core';
export class AsyncPage {
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
@Component({
  selector: 'cinema-state',
  template: `@if (error()) {
      <div class="error-panel" role="alert">
        {{ error() }}
        <button class="text-button" (click)="retry.emit()">Thử lại</button>
      </div>
    }
    @if (busy()) {
      <div aria-busy="true" aria-label="Đang tải">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    }
    @if (message()) {
      <div class="toast" role="status">{{ message() }}</div>
    }`,
})
export class PageState {
  busy = input(false);
  error = input('');
  message = input('');
  retry = output<void>();
}
@Component({
  selector: 'cinema-pager',
  template: `<div class="pagination">
    <span
      >{{ total() === 0 ? 0 : (page() - 1) * size() + 1 }}–{{
        Math.min(page() * size(), total())
      }}
      trong {{ total() }}</span
    ><button
      [disabled]="page() <= 1 || busy()"
      aria-label="Trang trước"
      (click)="changed.emit(page() - 1)"
    >
      ‹</button
    ><button
      [disabled]="page() * size() >= total() || busy()"
      aria-label="Trang sau"
      (click)="changed.emit(page() + 1)"
    >
      ›
    </button>
  </div>`,
})
export class Pager {
  total = input(0);
  page = input(1);
  size = input(20);
  busy = input(false);
  changed = output<number>();
  Math = Math;
}
@Component({
  selector: 'cinema-filters',
  imports: [FormsModule],
  template: ` <div class="toolbar">
    <div class="date-filter">
      <span class="filter-label" id="date-range-label">Khoảng thời gian</span>
      <div class="date-presets" role="group" aria-labelledby="date-range-label">
        @for (option of ranges; track option.value) {
          <button
            type="button"
            [attr.aria-pressed]="range === option.value"
            (click)="selectRange(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>
    @if (range === 'custom') {
      <div class="custom-dates">
        <label>Từ ngày<input type="date" [(ngModel)]="from" [max]="to" /></label>
        <label>Đến ngày<input type="date" [(ngModel)]="to" [min]="from" /></label>
        <button type="button" class="secondary" (click)="emit()">Áp dụng</button>
        @if (rangeError()) {
          <p class="field-error" role="alert">{{ rangeError() }}</p>
        }
      </div>
    }
    @if (auth.global()) {
      <label
        >Rạp<select aria-label="Rạp" [(ngModel)]="cinemaId" (ngModelChange)="emit()">
          <option value="">Tất cả rạp</option>
          @for (c of cinemas(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select></label
      >
    }
    <label class="checkbox-label"
      ><input type="checkbox" [(ngModel)]="include" (change)="emit()" />Bao gồm feedback nghi
      vấn</label
    >
  </div>`,
})
export class Filters {
  api = inject(Api);
  auth = inject(Auth);
  initialCinemaId = input('');
  changed = output<Record<string, string | boolean>>();
  cinemas = signal<Cinema[]>([]);
  range = '30';
  rangeError = signal('');
  ranges = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: '7', label: '7 ngày' },
    { value: '30', label: '30 ngày' },
    { value: 'custom', label: 'Tuỳ chọn' },
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
        'Chọn đủ ngày bắt đầu và kết thúc; ngày kết thúc phải từ ngày bắt đầu trở đi.',
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
