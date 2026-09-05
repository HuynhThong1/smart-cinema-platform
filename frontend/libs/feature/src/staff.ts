import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { Cinema, Staff, Page, localDate } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-staff',
  imports: [FormsModule, RouterLink, DialogModule, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Nhân viên</p>
        <h2>Danh sách nhân viên</h2>
        <p class="english">Your cinema service team</p>
      </div>
      <div class="actions">
        <a class="secondary" routerLink="/staff/import">Import Excel/CSV</a
        ><button class="primary" (click)="edit()">+ Thêm nhân viên</button>
      </div>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        name="search"
        [(ngModel)]="search"
        placeholder="Mã hoặc tên nhân viên"
        aria-label="Tìm nhân viên"
      /><select name="status" [(ngModel)]="status" aria-label="Trạng thái">
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option></select
      ><button class="secondary">Tìm kiếm</button>
    </form>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    @if (!busy()) {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Họ tên</th>
              <th>Rạp</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (s of data().items; track s.id) {
              <tr>
                <td>
                  <strong>{{ s.staffCode }}</strong>
                </td>
                <td>
                  <button class="row-action" (click)="edit(s)">
                    {{ s.name }}
                  </button>
                </td>
                <td>{{ cinemaName(s.cinemaId) }}</td>
                <td>
                  <span class="tag" [class.good]="s.status === 'ACTIVE'">{{ s.status }}</span>
                </td>
                <td>{{ localDate(s.updatedAt) }}</td>
                <td>
                  <div class="actions">
                    <a [routerLink]="['/staff', s.id, 'performance']">Hiệu suất</a
                    ><a routerLink="/qr" [queryParams]="{ staffId: s.id }">QR</a
                    ><button class="text-button" (click)="edit(s)">Sửa</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6">Chưa có nhân viên. Thêm nhân viên hoặc import danh sách.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    }
    <p-dialog
      [(visible)]="dialog"
      [modal]="true"
      [header]="draft.id ? 'Sửa nhân viên' : 'Thêm nhân viên'"
      ><form class="form-fields" (ngSubmit)="save()">
        <label
          >Mã nhân viên *<input
            name="code"
            [(ngModel)]="draft.staffCode"
            required
            maxlength="50" /></label
        ><label
          >Họ tên *<input
            name="name"
            [(ngModel)]="draft.name"
            required
            minlength="2"
            maxlength="100" /></label
        ><label
          >Rạp *<select
            name="cinema"
            [(ngModel)]="draft.cinemaId"
            [disabled]="!auth.global()"
            required
          >
            @for (c of cinemas(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select></label
        ><label
          >Trạng thái<select name="status" [(ngModel)]="draft.status">
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select></label
        >
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="actions section">
          <button type="button" class="secondary" (click)="dialog = false">Huỷ</button
          ><button class="primary" [disabled]="busy()">Lưu nhân viên</button>
        </div>
      </form></p-dialog
    >`,
})
export class StaffPage extends AsyncPage {
  data = signal<Page<Staff>>({ items: [], total: 0, page: 1, pageSize: 20 });
  cinemas = signal<Cinema[]>([]);
  page = signal(1);
  search = '';
  status = '';
  dialog = false;
  draft: Partial<Staff> = {};
  localDate = localDate;
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
    this.dialog = true;
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/staff/' + this.draft.id, this.draft);
      else await this.api.post('/admin/staff', this.draft);
      this.dialog = false;
      this.notify('Đã lưu nhân viên');
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
