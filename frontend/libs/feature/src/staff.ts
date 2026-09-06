import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cinema, Staff, Page, localDate } from '@cinema/core';
import { Overlay, RowLink } from '@cinema/ui';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-staff',
  imports: [FormsModule, RouterLink, Overlay, RowLink, PageState, Pager],
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
              <tr (rowOpen)="edit(s)">
                <td>
                  <strong>{{ s.staffCode }}</strong>
                </td>
                <td>{{ s.name }}</td>
                <td>
                  {{ cinemaName(s.cinemaId) }}
                  @if (!s.managerId) {
                    <p class="negative">Chưa gán quản lý</p>
                  }
                </td>
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
    <cinema-overlay [(open)]="dialog" [header]="draft.id ? 'Sửa nhân viên' : 'Thêm nhân viên'"
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
            (ngModelChange)="draft.managerId = ''; loadManagers()"
            [disabled]="!auth.global()"
            required
          >
            @for (c of cinemas(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select></label
        ><label
          >Quản lý trực tiếp / Direct manager<select
            name="manager"
            [(ngModel)]="draft.managerId"
            [disabled]="managersLoading"
          >
            <option value="">Chưa gán quản lý</option>
            @for (m of managers(); track m.id) {
              <option [value]="m.id">{{ m.name }}</option>
            }
            @if (draft.managerId && !hasManager()) {
              <option [value]="draft.managerId">Quản lý đã gán · cần kiểm tra tài khoản</option>
            }
          </select></label
        >
        @if (managerError()) {
          <p class="field-error" role="alert">
            {{ managerError() }}
            <button type="button" class="text-button" (click)="loadManagers()">Thử lại</button>
          </p>
        }
        @if (!draft.managerId) {
          <p class="muted">Chưa gửi thông báo cho đến khi gán quản lý trực tiếp.</p>
        }
        <label
          >Trạng thái<select name="status" [(ngModel)]="draft.status">
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select></label
        >
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="overlay-actions">
          <button type="button" class="secondary" (click)="dialog = false">Huỷ</button
          ><button class="primary" [disabled]="busy()">Lưu nhân viên</button>
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
      this.managerError.set('Chọn rạp để tải danh sách quản lý.');
      return;
    }
    try {
      const items = await this.api.get<{ id: string; name: string }[]>('/admin/managers', {
        cinemaId,
      });
      if (request === this.managerRequest) this.managers.set(items);
    } catch {
      if (request === this.managerRequest) this.managerError.set('Không tải được quản lý của rạp.');
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
    this.draft.managerId ||= '';
    this.dialog = true;
    void this.loadManagers();
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
