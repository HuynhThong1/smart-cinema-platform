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
import { RouterLink } from '@angular/router';
import { Cinema, Staff, Page } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-staff',
  imports: [
    CinemaBadge,
    CinemaField,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaTable,
    FormsModule,
    RouterLink,
    Overlay,
    RowLink,
    PageState,
    Pager,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('coaching.staff') }}</p>
        <h2>{{ i18n.t('staff.staff_list') }}</h2>
      </div>
      <div class="actions">
        <a cinemaButton class="secondary" routerLink="/staff/import">{{
          i18n.t('staff.import_excel_csv')
        }}</a
        ><button type="button" cinemaButton class="primary" (click)="edit()">
          {{ i18n.t('staff.add_staff') }}
        </button>
      </div>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        cinemaInput
        name="search"
        [(ngModel)]="search"
        [placeholder]="i18n.t('staff.staff_code_or_name')"
        [attr.aria-label]="i18n.t('qr.search_staff')"
      /><cinema-select
        name="status"
        [(ngModel)]="status"
        [aria-label]="i18n.t('administration.status')"
      >
        <cinema-option [value]="''" [label]="i18n.t('staff.all_statuses')" />
        <cinema-option [value]="'ACTIVE'" [label]="i18n.t('staff.active')" />
        <cinema-option [value]="'INACTIVE'" [label]="i18n.t('staff.inactive')" /></cinema-select
      ><button type="submit" cinemaButton class="secondary">{{ i18n.t('staff.search') }}</button>
    </form>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    @if (!busy()) {
      <div class="table-wrap">
        <cinema-table [rows]="data().items" [columns]="6"
          ><ng-template #header>
            <tr>
              <th>{{ i18n.t('administration.code') }}</th>
              <th>{{ i18n.t('import.full_name') }}</th>
              <th>{{ i18n.t('dashboard.cinema') }}</th>
              <th>{{ i18n.t('administration.status') }}</th>
              <th>{{ i18n.t('staff.updated') }}</th>
              <th>{{ i18n.t('staff.actions') }}</th>
            </tr> </ng-template
          ><ng-template #body let-s
            ><tr (rowOpen)="edit(s)">
              <td>
                <strong>{{ s.staffCode }}</strong>
              </td>
              <td>{{ s.name }}</td>
              <td>
                {{ cinemaName(s.cinemaId) }}
                @if (!s.managerId) {
                  <p class="negative">{{ i18n.t('import.no_manager_assigned') }}</p>
                }
              </td>
              <td>
                <cinema-badge class="tag" [class.good]="s.status === 'ACTIVE'">{{
                  i18n.t('common.status.' + s.status)
                }}</cinema-badge>
              </td>
              <td>{{ localDate(s.updatedAt) }}</td>
              <td>
                <div class="actions">
                  <a [routerLink]="['/staff', s.id, 'performance']">{{
                    i18n.t('staff.performance')
                  }}</a
                  ><a routerLink="/qr" [queryParams]="{ staffId: s.id }">{{ i18n.t('qr.qr') }}</a
                  ><button type="button" cinemaButton class="text-button" (click)="edit(s)">
                    {{ i18n.t('administration.edit') }}
                  </button>
                </div>
              </td>
            </tr></ng-template
          ><ng-template #empty
            ><tr>
              <td colspan="6">{{ i18n.t('staff.no_staff_yet_add_staff_or_import_a_list') }}</td>
            </tr></ng-template
          ></cinema-table
        >
      </div>
      <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    }
    <cinema-overlay
      [saving]="busy()"
      [(open)]="dialog"
      [header]="draft.id ? i18n.t('staff.edit_staff') : i18n.t('staff.add_staff_376')"
      ><form
        class="form-fields"
        #editorForm="ngForm"
        (ngSubmit)="editorForm.valid && !busy() && save()"
      >
        <cinema-field inputId="staff-field-1" [label]="i18n.t('staff.staff_code')"
          ><input
            id="staff-field-1"
            cinemaInput
            name="code"
            [(ngModel)]="draft.staffCode"
            required
            maxlength="50" /></cinema-field
        ><cinema-field inputId="staff-field-2" [label]="i18n.t('staff.full_name')"
          ><input
            id="staff-field-2"
            cinemaInput
            name="name"
            [(ngModel)]="draft.name"
            required
            minlength="2"
            maxlength="100" /></cinema-field
        ><cinema-field inputId="staff-field-3" [label]="i18n.t('staff.cinema')"
          ><cinema-select
            inputId="staff-field-3"
            name="cinema"
            [(ngModel)]="draft.cinemaId"
            (ngModelChange)="draft.managerId = ''; loadManagers()"
            [disabled]="!auth.global()"
            required
          >
            @for (c of cinemas(); track c.id) {
              <cinema-option [value]="c.id" [label]="c.name" />
            }</cinema-select></cinema-field
        ><cinema-field inputId="staff-field-4" [label]="i18n.t('staff.direct_manager')"
          ><cinema-select
            inputId="staff-field-4"
            name="manager"
            [(ngModel)]="draft.managerId"
            [disabled]="managersLoading"
          >
            <cinema-option [value]="''" [label]="i18n.t('import.no_manager_assigned')" />
            @for (m of managers(); track m.id) {
              <cinema-option [value]="m.id" [label]="m.name" />
            }
            @if (draft.managerId && !hasManager()) {
              <cinema-option
                [value]="draft.managerId"
                [label]="i18n.t('staff.assigned_manager_account_needs_review')"
              />
            }</cinema-select
        ></cinema-field>
        @if (managerError()) {
          <p class="field-error" role="alert">
            {{ i18n.t(managerError()) }}
            <button cinemaButton type="button" class="text-button" (click)="loadManagers()">
              {{ i18n.t('staff.retry') }}
            </button>
          </p>
        }
        @if (!draft.managerId) {
          <p class="muted">
            {{ i18n.t('staff.notifications_will_not_be_sent_until_a_direct_manager_is_assigned') }}
          </p>
        }
        <cinema-field inputId="staff-field-5" [label]="i18n.t('administration.status')"
          ><cinema-select inputId="staff-field-5" name="status" [(ngModel)]="draft.status">
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
            {{ i18n.t('staff.save_staff') }}
          </button>
        </div>
      </form></cinema-overlay
    >`,
})
export class StaffPage extends AsyncPage {
  data = signal<Page<Staff>>({ items: [], total: 0, page: 1, pageSize: 20 });
  managers = signal<{ id: string; name: string }[]>([]);
  managerError = signal('');
  managersLoading = false;
  private managerRequest = 0;
  hasManager() {
    return this.managers().some((m) => m.id === this.draft.managerId);
  }
  async loadManagers() {
    const request = ++this.managerRequest;
    this.managersLoading = true;
    this.managerError.set('');
    this.managers.set([]);
    const cinemaId = this.draft.cinemaId || '';
    // The endpoint rejects an empty cinema with 403, so retrying is pointless
    // until a cinema is picked — the list may still be loading when this opens.
    if (!cinemaId) {
      this.managersLoading = false;
      this.managerError.set('staff.select_a_cinema_to_load_managers');
      return;
    }
    try {
      const items = await this.api.get<{ id: string; name: string }[]>('/admin/managers', {
        cinemaId,
      });
      if (request === this.managerRequest) this.managers.set(items);
    } catch {
      if (request === this.managerRequest)
        this.managerError.set('staff.unable_to_load_managers_for_this_cinema');
    } finally {
      if (request === this.managerRequest) this.managersLoading = false;
    }
  }
  cinemas = signal<Cinema[]>([]);
  page = signal(1);
  search = '';
  status = '';
  dialog = false;
  draft: Partial<Staff> = {};
  localDate = (value: string) => this.i18n.date(value);
  ngOnInit() {
    void this.load();
    void this.api
      .get<Page<Cinema>>('/admin/cinemas', { pageSize: 100 })
      .then((p) => this.cinemas.set(p.items))
      .catch(() => {});
  }
  load() {
    return this.run(async () =>
      this.data.set(
        await this.api.get<Page<Staff>>('/admin/staff', {
          page: this.page(),
          search: this.search,
          status: this.status,
        }),
      ),
    );
  }
  cinemaName(id: string) {
    return this.cinemas().find((c) => c.id === id)?.name || id;
  }
  edit(v?: Staff) {
    this.error.set('');
    this.draft = v
      ? { ...v }
      : {
          staffCode: '',
          name: '',
          cinemaId: this.auth.user()?.cinemaId || this.cinemas()[0]?.id || '',
          status: 'ACTIVE',
        };
    this.draft.managerId ||= '';
    this.dialog = true;
    void this.loadManagers();
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/staff/' + this.draft.id, this.draft);
      else await this.api.post('/admin/staff', this.draft);
      this.dialog = false;
      this.notify('staff.staff_saved');
      this.data.set(
        await this.api.get<Page<Staff>>('/admin/staff', {
          page: this.page(),
          search: this.search,
          status: this.status,
        }),
      );
    });
  }
}
