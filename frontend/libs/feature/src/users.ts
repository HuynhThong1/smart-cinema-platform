import {
  CinemaBadge,
  CinemaField,
  CinemaButton,
  CinemaCheckbox,
  CinemaInput,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cinema, Page } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  enabled: boolean;
  role: string;
  cinemaId: string;
  temporaryPassword?: string;
}
@Component({
  selector: 'cinema-users',
  imports: [
    CinemaBadge,
    CinemaField,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaTable,
    FormsModule,
    Overlay,
    RowLink,
    PageState,
    Pager,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('users.system_users') }}</p>
        <h2>{{ i18n.t('users.user_management') }}</h2>
      </div>
      <button type="button" cinemaButton class="primary" (click)="edit()">
        {{ i18n.t('users.add_user') }}
      </button>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        cinemaInput
        name="search"
        [(ngModel)]="search"
        [attr.aria-label]="i18n.t('users.search_users')"
        [placeholder]="i18n.t('users.username_or_name')"
      /><button type="submit" cinemaButton class="secondary">{{ i18n.t('staff.search') }}</button>
    </form>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    <div class="table-wrap">
      <cinema-table [rows]="data().items" [columns]="6"
        ><ng-template #header>
          <tr>
            <th>{{ i18n.t('users.username') }}</th>
            <th>{{ i18n.t('import.full_name') }}</th>
            <th>{{ i18n.t('users.role') }}</th>
            <th>{{ i18n.t('users.cinema_scope') }}</th>
            <th>{{ i18n.t('administration.status') }}</th>
            <th></th>
          </tr> </ng-template
        ><ng-template #body let-u
          ><tr (rowOpen)="edit(u)">
            <td>{{ u.username }}</td>
            <td>{{ u.firstName }} {{ u.lastName }}</td>
            <td>
              <cinema-badge class="tag">{{ i18n.t('common.status.' + u.role) }}</cinema-badge>
            </td>
            <td>{{ cinemaName(u.cinemaId) }}</td>
            <td>{{ u.enabled ? i18n.t('staff.active') : i18n.t('navigation.locked') }}</td>
            <td>
              <div class="actions">
                <button type="button" cinemaButton class="text-button" (click)="edit(u)">
                  {{ i18n.t('administration.edit') }}
                </button>
                <button
                  type="button"
                  cinemaButton
                  class="text-button negative"
                  [disabled]="auth.user()?.subject === u.id"
                  [attr.title]="
                    auth.user()?.subject === u.id
                      ? i18n.t('users.you_cannot_delete_your_own_account')
                      : null
                  "
                  (click)="askDelete(u)"
                >
                  {{ i18n.t('users.delete') }}
                </button>
              </div>
            </td>
          </tr></ng-template
        ></cinema-table
      >
    </div>
    <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    <cinema-overlay [saving]="busy()" [(open)]="dialog" [header]="i18n.t('users.user_details')"
      ><form
        class="form-fields"
        #editorForm="ngForm"
        (ngSubmit)="editorForm.valid && !busy() && save()"
      >
        <cinema-field inputId="users-field-1" [label]="i18n.t('users.username_400')"
          ><input
            id="users-field-1"
            cinemaInput
            name="username"
            [(ngModel)]="draft.username"
            required
            maxlength="100"
        /></cinema-field>
        <div class="split">
          <cinema-field inputId="users-field-2" [label]="i18n.t('users.first_name')"
            ><input
              id="users-field-2"
              cinemaInput
              name="firstName"
              [(ngModel)]="draft.firstName"
              required /></cinema-field
          ><cinema-field inputId="users-field-3" [label]="i18n.t('users.last_name')"
            ><input id="users-field-3" cinemaInput name="lastName" [(ngModel)]="draft.lastName"
          /></cinema-field>
        </div>
        <cinema-field inputId="users-field-4" [label]="i18n.t('users.email')"
          ><input
            id="users-field-4"
            cinemaInput
            type="email"
            name="email"
            [(ngModel)]="draft.email"
            required /></cinema-field
        ><cinema-field inputId="users-field-5" [label]="i18n.t('users.role')"
          ><cinema-select inputId="users-field-5" name="role" [(ngModel)]="draft.role">
            <cinema-option
              [value]="'SYSTEM_ADMIN'"
              [label]="i18n.t('users.system_administrator')"
            />
            <cinema-option [value]="'HEAD_OFFICE'" [label]="i18n.t('users.head_office')" />
            <cinema-option
              [value]="'CINEMA_MANAGER'"
              [label]="i18n.t('users.cinema_manager')"
            /> </cinema-select
        ></cinema-field>
        @if (draft.role === 'CINEMA_MANAGER') {
          <cinema-field inputId="users-field-6" [label]="i18n.t('staff.cinema')"
            ><cinema-select
              inputId="users-field-6"
              name="cinema"
              [(ngModel)]="draft.cinemaId"
              required
            >
              @for (c of cinemas(); track c.id) {
                <cinema-option [value]="c.id" [label]="c.name" />
              }</cinema-select
          ></cinema-field>
        }
        @if (!draft.id) {
          <cinema-field inputId="users-field-7" [label]="i18n.t('users.temporary_password')"
            ><input
              id="users-field-7"
              cinemaInput
              type="password"
              name="password"
              [(ngModel)]="draft.temporaryPassword"
              required
              minlength="12"
              autocomplete="new-password"
          /></cinema-field>
        }
        <label class="checkbox-label"
          ><cinema-checkbox name="enabled" [(ngModel)]="draft.enabled" />{{
            i18n.t('users.account_enabled')
          }}</label
        >
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
            {{ i18n.t('users.save_user') }}
          </button>
        </div>
      </form></cinema-overlay
    ><cinema-overlay
      [saving]="busy()"
      variant="confirm"
      [(open)]="deleteDialog"
      [header]="i18n.t('users.delete_account')"
    >
      @if (pendingDelete; as user) {
        <p>
          {{ i18n.t('users.permanently_delete_account') }}<strong>{{ user.username }}</strong>
          {{ i18n.t('users.from_the_identity_system') }}
        </p>

        @if (error()) {
          <p class="field-error" role="alert">{{ i18n.t(error()) }}</p>
        }
        <div class="overlay-actions">
          <button
            cinemaButton
            type="button"
            class="secondary"
            [disabled]="busy()"
            (click)="deleteDialog = false"
          >
            {{ i18n.t('administration.cancel') }}
          </button>
          <button cinemaButton type="button" class="danger" [disabled]="busy()" (click)="remove()">
            {{ i18n.t('users.delete_account') }}
          </button>
        </div>
      }
    </cinema-overlay>`,
})
export class UsersPage extends AsyncPage {
  data = signal<Page<User>>({ items: [], total: 0, page: 1, pageSize: 20 });
  cinemas = signal<Cinema[]>([]);
  page = signal(1);
  search = '';
  dialog = false;
  deleteDialog = false;
  pendingDelete?: User;
  draft: Partial<User> = {};
  ngOnInit() {
    void this.load();
    void this.api
      .get<Page<Cinema>>('/admin/cinemas', { pageSize: 100 })
      .then((p) => this.cinemas.set(p.items))
      .catch(() => {});
  }
  cinemaName(id: string) {
    return id
      ? this.cinemas().find((c) => c.id === id)?.name || id
      : this.i18n.t('modules.all_cinemas');
  }
  load() {
    return this.run(async () =>
      this.data.set(
        await this.api.get<Page<User>>('/admin/users', {
          page: this.page(),
          search: this.search,
        }),
      ),
    );
  }
  edit(u?: User) {
    this.error.set('');
    this.draft = u
      ? { ...u }
      : {
          username: '',
          firstName: '',
          lastName: '',
          email: '',
          role: 'CINEMA_MANAGER',
          cinemaId: this.cinemas()[0]?.id || '',
          enabled: true,
          temporaryPassword: '',
        };
    this.dialog = true;
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/users/' + this.draft.id, this.draft);
      else await this.api.post('/admin/users', this.draft);
      this.draft.temporaryPassword = '';
      this.dialog = false;
      this.notify('users.user_saved');
      this.data.set(
        await this.api.get<Page<User>>('/admin/users', {
          page: this.page(),
          search: this.search,
        }),
      );
    });
  }
  askDelete(user: User) {
    if (this.auth.user()?.subject === user.id) return;
    this.error.set('');
    this.pendingDelete = user;
    this.deleteDialog = true;
  }
  remove() {
    return this.run(async () => {
      const user = this.pendingDelete;
      if (!user) return;
      await this.api.delete('/admin/users/' + encodeURIComponent(user.id));
      if (this.data().items.length === 1 && this.page() > 1) this.page.update((p) => p - 1);
      this.deleteDialog = false;
      this.pendingDelete = undefined;
      this.notify('users.user_deleted');
      this.data.set(
        await this.api.get<Page<User>>('/admin/users', {
          page: this.page(),
          search: this.search,
        }),
      );
    });
  }
}
