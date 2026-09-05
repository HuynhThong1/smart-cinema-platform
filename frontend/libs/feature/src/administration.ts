import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cinema, Audit, Page, localDate } from '@cinema/core';
import { Overlay } from '@cinema/ui';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-cinemas',
  imports: [FormsModule, Overlay, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Hệ thống / Cinemas</p>
        <h2>Quản lý rạp</h2>
        <p class="english">Cinema network</p>
      </div>
      <button class="primary" (click)="edit()">+ Thêm rạp</button>
    </div>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    <div class="table-wrap section">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên rạp</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of data().items; track c.id) {
            <tr>
              <td>{{ c.code }}</td>
              <td>{{ c.name }}</td>
              <td>
                <span class="tag" [class.good]="c.status === 'ACTIVE'">{{ c.status }}</span>
              </td>
              <td>
                <button class="text-button" (click)="edit(c)">Sửa</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
    <cinema-overlay [(open)]="dialog" header="Thông tin rạp"
      ><form class="form-fields" (ngSubmit)="save()">
        <label>Mã rạp *<input name="code" [(ngModel)]="draft.code" required maxlength="30" /></label
        ><label
          >Tên rạp *<input name="name" [(ngModel)]="draft.name" required maxlength="100" /></label
        ><label
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
          ><button class="primary" [disabled]="busy()">Lưu rạp</button>
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
      this.notify('Đã lưu rạp');
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
  imports: [PageState, Pager],
  template: `<p class="kicker">Hệ thống / Audit log</p>
    <h2>Nhật ký hoạt động</h2>
    <p class="english">Privileged actions, recorded</p>
    <cinema-state [busy]="busy()" [error]="error()" (retry)="load()" />
    <div class="table-wrap section">
      <table>
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người thực hiện</th>
            <th>Hành động</th>
            <th>Đối tượng</th>
          </tr>
        </thead>
        <tbody>
          @for (a of data().items; track a.id) {
            <tr>
              <td>{{ localDate(a.createdAt) }}</td>
              <td>{{ a.actor }}</td>
              <td class="positive">{{ a.action }}</td>
              <td>{{ a.target }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">Chưa có hoạt động được ghi nhận.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />`,
})
export class AuditPage extends AsyncPage {
  data = signal<Page<Audit>>({ items: [], total: 0, page: 1, pageSize: 20 });
  page = signal(1);
  localDate = localDate;
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
