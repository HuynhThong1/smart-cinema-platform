import {
  CinemaBadge,
  CinemaButton,
  CinemaInput,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { translatedMessage } from '@cinema/i18n';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QR, Staff, Cinema, Page, download } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-qr',
  imports: [
    CinemaBadge,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaTable,
    FormsModule,
    Overlay,
    RowLink,
    PageState,
    Pager,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('qr.staff_qr_management') }}</p>
        <h2>{{ i18n.t('qr.qr_management') }}</h2>
      </div>
      <button type="button" cinemaButton class="primary" (click)="ask('batch')">
        {{ i18n.t('qr.generate_qr_for_all') }}
      </button>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        cinemaInput
        name="search"
        [(ngModel)]="search"
        [placeholder]="i18n.t('qr.search_staff_code_or_name')"
        [attr.aria-label]="i18n.t('qr.search_staff')"
      />
      @if (auth.global()) {
        <cinema-select
          name="cinema"
          [(ngModel)]="cinemaId"
          [aria-label]="i18n.t('dashboard.cinema')"
        >
          <cinema-option [value]="''" [label]="i18n.t('qr.all_cinemas')" />
          @for (c of cinemas(); track c.id) {
            <cinema-option [value]="c.id" [label]="c.name" />
          }
        </cinema-select>
      }
      <button type="submit" cinemaButton class="secondary">{{ i18n.t('feedback.filter') }}</button
      ><button cinemaButton type="button" class="secondary" (click)="package()">
        {{ i18n.t('qr.download_zip') }}
      </button>
    </form>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    <div class="qr-layout">
      <div>
        <div class="table-wrap">
          <cinema-table [rows]="data().items" [columns]="4"
            ><ng-template #header>
              <tr>
                <th>{{ i18n.t('administration.code') }}</th>
                <th>{{ i18n.t('import.full_name') }}</th>
                <th>{{ i18n.t('administration.status') }}</th>
                <th>{{ i18n.t('qr.qr') }}</th>
              </tr> </ng-template
            ><ng-template #body let-s
              ><tr [class.selected]="selected()?.id === s.id" (rowOpen)="select(s)">
                <td>{{ s.staffCode }}</td>
                <td>{{ s.name }}</td>
                <td>
                  <cinema-badge class="tag">{{ i18n.t('common.status.' + s.status) }}</cinema-badge>
                </td>
                <td>
                  <button type="button" cinemaButton class="text-button" (click)="select(s)">
                    {{ i18n.t('qr.view_qr') }}
                  </button>
                </td>
              </tr></ng-template
            ><ng-template #empty
              ><tr>
                <td colspan="4">{{ i18n.t('qr.no_matching_staff') }}</td>
              </tr></ng-template
            ></cinema-table
          >
        </div>
        <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
      </div>
      <aside class="qr-preview">
        @if (selected(); as s) {
          <h4>{{ i18n.t('qr.qr_p0', { p0: s.staffCode }) }}</h4>
          <p class="english">{{ s.name }}</p>
          @if (qr(); as q) {
            <cinema-badge class="tag" [class.good]="q.status === 'ACTIVE'">{{
              i18n.t('common.status.' + q.status)
            }}</cinema-badge>
            @if (q.url) {
              @if (q.status === 'ACTIVE') {
                <img class="qr-image" [src]="image()" [alt]="i18n.t('qr.experience_feedback_qr')" />
              }
              <p class="qr-url">{{ q.url }}</p>
              <div class="actions">
                <button type="button" cinemaButton class="secondary" (click)="copy()">
                  {{ i18n.t('qr.copy_url') }}</button
                ><button
                  type="button"
                  cinemaButton
                  class="secondary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="download('png')"
                >
                  {{ i18n.t('qr.png') }}</button
                ><button
                  type="button"
                  cinemaButton
                  class="secondary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="download('svg')"
                >
                  {{ i18n.t('qr.svg') }}</button
                ><button
                  type="button"
                  cinemaButton
                  class="primary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="printVisible = !printVisible"
                >
                  {{ i18n.t('qr.print_template') }}
                </button>
              </div>
              <div class="actions section">
                <button type="button" cinemaButton class="text-button" (click)="ask('regenerate')">
                  {{ i18n.t('qr.regenerate') }}</button
                ><button
                  type="button"
                  cinemaButton
                  class="text-button negative"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="ask('disable')"
                >
                  {{ i18n.t('qr.disable') }}
                </button>
              </div>
              <p class="english">
                {{ i18n.t('qr.regenerating_immediately_invalidates_the_old_code_reprint_the_pos') }}
              </p>
            } @else {
              <div class="notice">
                <p>{{ i18n.t('qr.no_qr_yet') }}</p>
                <button
                  type="button"
                  cinemaButton
                  class="primary"
                  [disabled]="s.status !== 'ACTIVE' || busy()"
                  (click)="generate()"
                >
                  {{ i18n.t('qr.generate_qr') }}
                </button>
              </div>
            }
          }
        } @else {
          <div class="notice">
            {{ i18n.t('qr.select_a_staff_member_to_view_or_create_a_qr_code') }}
          </div>
        }
      </aside>
    </div>
    @if (printVisible && qr()?.status === 'ACTIVE') {
      <div class="section split">
        <div class="print-card">
          <img src="/galaxy-logo.png" width="150" [alt]="i18n.t('qr.galaxy_cinema')" /><img
            class="qr-image"
            [src]="image()"
            [alt]="i18n.t('qr.scan_to_rate')"
          />
          <h3>{{ i18n.t('qr.scan_to_rate_315') }}<br />{{ i18n.t('qr.your_experience') }}</h3>

          <p class="positive">{{ i18n.t('qr.takes_15_30_seconds') }}</p>
        </div>
        <div>
          <h4>{{ i18n.t('qr.pos_print_template') }}</h4>
          <p>
            {{ i18n.t('qr.qr_minimum_35_mm_high_contrast_white_background_and_a_quiet_zone_') }}
          </p>
          <div class="chips" role="radiogroup" [attr.aria-label]="i18n.t('qr.print_size')">
            @for (size of printSizes; track size.value) {
              <button
                cinemaButton
                type="button"
                class="chip"
                role="radio"
                [class.selected]="printSize() === size.value"
                [attr.aria-checked]="printSize() === size.value"
                (click)="printSize.set(size.value)"
              >
                {{ i18n.t(size.label) }}
              </button>
            }
          </div>
          <div class="actions section">
            <button type="button" cinemaButton class="primary" (click)="download('pdf')">
              {{ i18n.t('qr.pdf') }}</button
            ><button type="button" cinemaButton class="secondary" (click)="print()">
              {{ i18n.t('qr.print') }}</button
            ><button type="button" cinemaButton class="text-button" (click)="printVisible = false">
              {{ i18n.t('qr.close') }}
            </button>
          </div>
        </div>
      </div>
    }
    <cinema-overlay
      [saving]="busy()"
      variant="confirm"
      [(open)]="dialog"
      [header]="
        action === 'batch'
          ? i18n.t('qr.generate_qr_for_all_staff')
          : action === 'disable'
            ? i18n.t('qr.disable_qr')
            : i18n.t('qr.regenerate_qr')
      "
      ><p>
        {{
          action === 'batch'
            ? i18n.t('qr.only_missing_qr_codes_in_the_selected_cinema_scope_will_be_create')
            : action === 'disable'
              ? i18n.t('qr.the_qr_code_will_stop_accepting_feedback_this_action_is_audited')
              : i18n.t('qr.the_old_token_becomes_invalid_immediately_reprint_the_qr_card_at_')
        }}
      </p>
      <div class="overlay-actions">
        <button
          type="button"
          cinemaButton
          class="secondary"
          [disabled]="busy()"
          (click)="dialog = false"
        >
          {{ i18n.t('administration.cancel') }}</button
        ><button
          type="button"
          cinemaButton
          [class]="action === 'batch' ? 'primary' : 'danger'"
          [disabled]="busy()"
          (click)="confirm()"
        >
          {{ i18n.t('qr.confirm') }}
        </button>
      </div></cinema-overlay
    >`,
})
export class QRPage extends AsyncPage {
  route = inject(ActivatedRoute);
  data = signal<Page<Staff>>({ items: [], total: 0, page: 1, pageSize: 20 });
  cinemas = signal<Cinema[]>([]);
  selected = signal<Staff | null>(null);
  qr = signal<QR | null>(null);
  image = signal('');
  page = signal(1);
  search = '';
  cinemaId = '';
  printVisible = false;
  printSize = signal('a6');
  printSizes = [
    { value: 'a6', label: 'navigation.a6' },
    { value: 'a5', label: 'navigation.a5' },
    { value: 'sticker', label: 'qr.80_80_sticker' },
  ];
  dialog = false;
  action = '';
  ngOnInit() {
    void this.load();
    void this.api
      .get<Page<Cinema>>('/admin/cinemas', { pageSize: 100 })
      .then((p) => this.cinemas.set(p.items))
      .catch(() => {});
  }
  ngOnDestroy() {
    if (this.image()) URL.revokeObjectURL(this.image());
  }
  load() {
    return this.run(async () => {
      this.data.set(
        await this.api.get<Page<Staff>>('/admin/staff', {
          page: this.page(),
          search: this.search,
          cinemaId: this.cinemaId,
        }),
      );
      const id = this.route.snapshot.queryParamMap.get('staffId');
      const st = this.data().items.find((s) => s.id === id);
      if (st && !this.selected()) await this.loadQR(st);
    });
  }
  async loadQR(st: Staff) {
    this.selected.set(st);
    this.printVisible = false;
    this.qr.set(null);
    const q = await this.api.get<QR>('/admin/staff/' + st.id + '/qr');
    this.qr.set(q);
    if (this.image()) URL.revokeObjectURL(this.image());
    this.image.set('');
    if (q.status === 'ACTIVE')
      this.image.set(
        URL.createObjectURL(
          await this.api.blob('/admin/staff/' + st.id + '/qr/download', {
            format: 'png',
          }),
        ),
      );
  }
  select(st: Staff) {
    return this.run(() => this.loadQR(st));
  }
  generate() {
    return this.run(async () => {
      const st = this.selected()!;
      await this.api.post('/admin/staff/' + st.id + '/qr', {});
      await this.loadQR(st);
      this.notify('qr.qr_created');
    });
  }
  ask(action: string) {
    this.action = action;
    this.dialog = true;
  }
  confirm() {
    return this.run(async () => {
      if (this.action === 'batch') {
        const q = this.cinemaId ? '?cinemaId=' + encodeURIComponent(this.cinemaId) : '';
        const r = await this.api.post<{ created: number; existing: number }>(
          '/admin/staff/qr/batch' + q,
          {},
        );
        this.notify(
          translatedMessage('messages.qr_batch', { created: r.created, existing: r.existing }),
        );
      } else {
        const st = this.selected()!;
        if (this.action === 'disable') await this.api.delete('/admin/staff/' + st.id + '/qr');
        else await this.api.post('/admin/staff/' + st.id + '/qr/regenerate', {});
        await this.loadQR(st);
        this.notify('qr.qr_updated');
      }
      this.dialog = false;
    });
  }
  copy() {
    return this.run(async () => {
      await navigator.clipboard.writeText(this.qr()?.url || '');
      this.notify('qr.url_copied');
    });
  }
  download(format: string) {
    return this.run(async () => {
      const file = await this.api.namedBlob(
        '/admin/staff/' + this.selected()!.id + '/qr/download',
        { format, size: this.printSize() },
      );
      download(file.blob, file.name);
    });
  }
  package() {
    return this.run(async () => {
      const file = await this.api.namedBlob('/admin/staff/qr/package', {
        cinemaId: this.cinemaId,
      });
      download(file.blob, file.name);
    });
  }
  print() {
    window.print();
  }
}
