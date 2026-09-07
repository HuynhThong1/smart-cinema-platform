import {
  CinemaBadge,
  CinemaField,
  CinemaButton,
  CinemaInput,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cinema, Audit, Page } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-cinemas',
  imports: [
    CinemaBadge,
    CinemaField,
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
        <p class="kicker">{{ i18n.t('administration.system_cinemas') }}</p>
        <h2>{{ i18n.t('administration.cinema_management') }}</h2>
      </div>
      <button type="button" cinemaButton class="primary" (click)="edit()">
        {{ i18n.t('administration.add_cinema') }}
      </button>
    </div>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    <div class="table-wrap section">
      <cinema-table [rows]="data().items" [columns]="4"
        ><ng-template #header>
          <tr>
            <th>{{ i18n.t('administration.code') }}</th>
            <th>{{ i18n.t('administration.cinema_name') }}</th>
            <th>{{ i18n.t('administration.status') }}</th>
            <th></th>
          </tr> </ng-template
        ><ng-template #body let-c
          ><tr (rowOpen)="edit(c)">
            <td>{{ c.code }}</td>
            <td>{{ c.name }}</td>
            <td>
              <cinema-badge class="tag" [class.good]="c.status === 'ACTIVE'">{{
                i18n.t('common.status.' + c.status)
              }}</cinema-badge>
            </td>
            <td>
              <button type="button" cinemaButton class="text-button" (click)="edit(c)">
                {{ i18n.t('administration.edit') }}
              </button>
            </td>
          </tr></ng-template
        ></cinema-table
      >
    </div>
    <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
    <cinema-overlay
      [saving]="busy()"
      [(open)]="dialog"
      [header]="i18n.t('administration.cinema_details')"
      ><form
        class="form-fields"
        #editorForm="ngForm"
        (ngSubmit)="editorForm.valid && !busy() && save()"
      >
        <cinema-field
          inputId="administration-field-1"
          [label]="i18n.t('administration.cinema_code')"
          ><input
            id="administration-field-1"
            cinemaInput
            name="code"
            [(ngModel)]="draft.code"
            required
            maxlength="30" /></cinema-field
        ><cinema-field
          inputId="administration-field-2"
          [label]="i18n.t('administration.cinema_name_11')"
          ><input
            id="administration-field-2"
            cinemaInput
            name="name"
            [(ngModel)]="draft.name"
            required
            maxlength="100" /></cinema-field
        ><cinema-field inputId="administration-field-3" [label]="i18n.t('administration.status')"
          ><cinema-select inputId="administration-field-3" name="status" [(ngModel)]="draft.status">
            <cinema-option [value]="'ACTIVE'" [label]="i18n.t('administration.active')" />
            <cinema-option
              [value]="'INACTIVE'"
              [label]="i18n.t('administration.inactive')"
            /> </cinema-select
        ></cinema-field>
        @if (error()) {
          <p class="field-error" role="alert">{{ i18n.t(error()) }}</p>
        }
        <div class="overlay-actions">
          <button
            cinemaButton
            type="button"
            class="secondary"
            [disabled]="busy()"
            (click)="dialog = false"
          >
            {{ i18n.t('administration.cancel') }}</button
          ><button type="submit" cinemaButton class="primary" [disabled]="busy()">
            {{ i18n.t('administration.save_cinema') }}
          </button>
        </div>
      </form></cinema-overlay
    >`,
})
export class CinemaPage extends AsyncPage {
  data = signal<Page<Cinema>>({ items: [], total: 0, page: 1, pageSize: 20 });
  page = signal(1);
  draft: Partial<Cinema> = {};
  dialog = false;
  ngOnInit() {
    void this.load();
  }
  load() {
    return this.run(async () =>
      this.data.set(
        await this.api.get<Page<Cinema>>('/admin/cinemas', {
          page: this.page(),
        }),
      ),
    );
  }
  edit(c?: Cinema) {
    this.error.set('');
    this.draft = c ? { ...c } : { code: '', name: '', status: 'ACTIVE' };
    this.dialog = true;
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/cinemas/' + this.draft.id, this.draft);
      else await this.api.post('/admin/cinemas', this.draft);
      this.dialog = false;
      this.notify('administration.cinema_saved');
      this.data.set(
        await this.api.get<Page<Cinema>>('/admin/cinemas', {
          page: this.page(),
        }),
      );
    });
  }
}
@Component({
  selector: 'cinema-audit',
  imports: [CinemaTable, PageState, Pager],
  template: `<p class="kicker">{{ i18n.t('administration.system_audit_log') }}</p>
    <h2>{{ i18n.t('administration.activity_log') }}</h2>

    <cinema-state [busy]="busy()" [error]="i18n.t(error())" (retry)="load()" />
    <div class="table-wrap section">
      <cinema-table [rows]="data().items" [columns]="4"
        ><ng-template #header>
          <tr>
            <th>{{ i18n.t('administration.time') }}</th>
            <th>{{ i18n.t('administration.actor') }}</th>
            <th>{{ i18n.t('administration.action') }}</th>
            <th>{{ i18n.t('administration.target') }}</th>
          </tr> </ng-template
        ><ng-template #body let-a
          ><tr>
            <td>{{ localDate(a.createdAt) }}</td>
            <td>{{ a.actor }}</td>
            <td class="positive">{{ i18n.code('audit', a.action) }}</td>
            <td>{{ a.target }}</td>
          </tr></ng-template
        ><ng-template #empty
          ><tr>
            <td colspan="4">{{ i18n.t('administration.no_activity_recorded_yet') }}</td>
          </tr></ng-template
        ></cinema-table
      >
    </div>
    <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />`,
})
export class AuditPage extends AsyncPage {
  data = signal<Page<Audit>>({ items: [], total: 0, page: 1, pageSize: 20 });
  page = signal(1);
  localDate = (value: string) => this.i18n.date(value);
  ngOnInit() {
    void this.load();
  }
  load() {
    return this.run(async () =>
      this.data.set(
        await this.api.get<Page<Audit>>('/admin/audit-logs', {
          page: this.page(),
        }),
      ),
    );
  }
}
