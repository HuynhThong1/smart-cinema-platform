import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cinema, Page } from '@cinema/core';
import { Overlay } from '@cinema/ui';
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
  imports: [FormsModule, Overlay, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Hệ thống / Users</p>
        <h2>Quản lý người dùng</h2>
        <p class="english">Accounts, roles and cinema access</p>
      </div>
      <button class="primary" (click)="edit()">+ Thêm người dùng</button>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        name="search"
        [(ngModel)]="search"
        aria-label="Tìm người dùng"
        placeholder="Username hoặc họ tên"
      /><button class="secondary">Tìm kiếm</button>
    </form>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Họ tên</th>
            <th>Role</th>
            <th>Phạm vi rạp</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (u of data().items; track u.id) {
            <tr>
              <td>{{ u.username }}</td>
              <td>{{ u.firstName }} {{ u.lastName }}</td>
              <td>
                <span class="tag">{{ u.role }}</span>
              </td>
              <td>{{ cinemaName(u.cinemaId) }}</td>
              <td>{{ u.enabled ? 'Active' : 'Locked' }}</td>
              <td>
                <button class="text-button" (click)="edit(u)">Sửa</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    <cinema-overlay [(open)]="dialog" header="Thông tin người dùng"
      ><form class="form-fields" (ngSubmit)="save()">
        <label
          >Username *<input name="username" [(ngModel)]="draft.username" required maxlength="100"
        /></label>
        <div class="split">
          <label>Tên *<input name="firstName" [(ngModel)]="draft.firstName" required /></label
          ><label>Họ<input name="lastName" [(ngModel)]="draft.lastName" /></label>
        </div>
        <label>Email *<input type="email" name="email" [(ngModel)]="draft.email" required /></label
        ><label
          >Role<select name="role" [(ngModel)]="draft.role">
            <option>SYSTEM_ADMIN</option>
            <option>HEAD_OFFICE</option>
            <option>CINEMA_MANAGER</option>
          </select></label
        >
        @if (draft.role === 'CINEMA_MANAGER') {
          <label
            >Rạp *<select name="cinema" [(ngModel)]="draft.cinemaId" required>
              @for (c of cinemas(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select></label
          >
        }
        @if (!draft.id) {
          <label
            >Mật khẩu tạm *<input
              type="password"
              name="password"
              [(ngModel)]="draft.temporaryPassword"
              required
              minlength="12"
              autocomplete="new-password"
          /></label>
          <p class="english">Người dùng phải đổi mật khẩu khi đăng nhập lần đầu.</p>
        }
        <label class="checkbox-label"
          ><input name="enabled" type="checkbox" [(ngModel)]="draft.enabled" />Tài khoản hoạt
          động</label
        >
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="overlay-actions">
          <button type="button" class="secondary" (click)="dialog = false">Huỷ</button
          ><button class="primary" [disabled]="busy()">Lưu người dùng</button>
        </div>
      </form></cinema-overlay
    >`,
})
export class UsersPage extends AsyncPage {
  data = signal<Page<User>>({ items: [], total: 0, page: 1, pageSize: 20 });
  cinemas = signal<Cinema[]>([]);
  page = signal(1);
  search = '';
  dialog = false;
  draft: Partial<User> = {};
  ngOnInit() {
    void this.load();
    void this.api
      .get<Page<Cinema>>('/admin/cinemas', { pageSize: 100 })
      .then((p) => this.cinemas.set(p.items))
      .catch(() => {});
  }
  cinemaName(id: string) {
    return id ? this.cinemas().find((c) => c.id === id)?.name || id : 'Toàn hệ thống';
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
      this.notify('Đã lưu người dùng');
      this.data.set(
        await this.api.get<Page<User>>('/admin/users', {
          page: this.page(),
          search: this.search,
        }),
      );
    });
  }
}
