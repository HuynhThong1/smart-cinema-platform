import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImportResult, download } from '@cinema/core';
import { AsyncPage, PageState } from './shared';
@Component({
  selector: 'cinema-import',
  imports: [RouterLink, PageState],
  template: `
    <p class="kicker">Nhân viên / Import</p>
    <h2>Import nhân viên</h2>
    <p class="english">Upload, review, then confirm</p>
    <div class="steps">
      @for (
        label of ['1. Upload', '2. Validate & preview', '3. Result'];
        track label;
        let i = $index
      ) {
        <div class="step" [class.active]="step() === i + 1">{{ label }}</div>
      }
    </div>
    <cinema-state [busy]="busy()" [error]="error()" (retry)="preview()" />
    @if (busy()) {
      <p role="status" aria-live="polite">{{ operation() }}</p>
    }
    @if (step() === 1) {
      <div class="dropzone" (dragover)="$event.preventDefault()" (drop)="drop($event)">
        <h4>Kéo tệp .xlsx / .csv vào đây</h4>
        <p class="english">Tối đa 5 MB · 1.000 dòng</p>
        <input #fileInput type="file" accept=".csv,.xlsx" hidden (change)="select($event)" /><button
          class="primary"
          [disabled]="busy()"
          (click)="fileInput.click()"
        >
          Chọn tệp
        </button>
      </div>
      <button class="text-button" [disabled]="busy()" (click)="template()">
        ↓ Tải template Excel (.xlsx)
      </button>
      <p class="muted">Staff Code · Full Name · Cinema Code · Manager Username</p>
      <p class="muted">
        Nhập tên đăng nhập của quản lý trực tiếp đang hoạt động cùng rạp. Để trống nếu chưa gán quản
        lý.
      </p>
    }
    @if (result(); as r) {
      @if (step() === 2) {
        <div class="kpis">
          <div>
            Tổng
            <div class="kpi-value">{{ r.total }}</div>
          </div>
          <div>
            Hợp lệ
            <div class="kpi-value positive">{{ r.valid }}</div>
          </div>
          <div>
            Lỗi
            <div class="kpi-value negative">{{ r.invalid }}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dòng</th>
                <th>Staff Code</th>
                <th>Họ tên</th>
                <th>Cinema Code</th>
                <th>Quản lý trực tiếp</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              @for (row of r.rows; track row.row) {
                <tr>
                  <td>{{ row.row }}</td>
                  <td>{{ row.staffCode }}</td>
                  <td>{{ row.name }}</td>
                  <td>{{ row.cinemaCode }}</td>
                  <td>{{ row.managerUsername || 'Chưa gán quản lý' }}</td>
                  <td>
                    <span class="tag" [class.bad]="row.error" [class.good]="!row.error">{{
                      row.error || 'Hợp lệ'
                    }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="actions section">
          <button class="primary" [disabled]="busy() || !r.valid" (click)="confirm()">
            {{ busy() ? 'Đang import…' : 'Xác nhận import ' + r.valid + ' dòng' }}</button
          ><button class="secondary" [disabled]="busy()" (click)="errors()">↓ Tải file lỗi</button
          ><button class="text-button" [disabled]="busy()" (click)="reset()">Huỷ</button>
        </div>
      }
      @if (step() === 3) {
        <section class="empty">
          <h3>Đã import {{ r.imported }} nhân viên</h3>
          <p>{{ r.invalid }} dòng bị bỏ qua.</p>
          <div class="actions">
            <a routerLink="/qr" class="primary">Generate QR cho nhân viên mới</a
            ><button class="secondary" [disabled]="busy()" (click)="errors()">↓ Tải file lỗi</button
            ><button class="text-button" [disabled]="busy()" (click)="reset()">
              Import tệp khác
            </button>
          </div>
        </section>
      }
    }
  `,
})
export class ImportPage extends AsyncPage {
  operation = signal('');
  file: File | null = null;
  result = signal<ImportResult | null>(null);
  step = signal(1);
  select(e: Event) {
    if (this.busy()) return;
    this.file = (e.target as HTMLInputElement).files?.[0] || null;
    void this.preview();
  }
  drop(e: DragEvent) {
    e.preventDefault();
    if (this.busy()) return;
    this.file = e.dataTransfer?.files[0] || null;
    void this.preview();
  }
  form(confirm = false) {
    const data = new FormData();
    if (this.file) data.append('file', this.file);
    data.append('confirm', String(confirm));
    return data;
  }
  preview() {
    if (this.busy() || !this.file) return;
    if (this.file.size > 5 * 1024 * 1024) {
      this.error.set('Tệp vượt quá 5 MB');
      return;
    }
    this.operation.set('Đang kiểm tra tệp…');
    return this.run(async () => {
      this.result.set(await this.api.post<ImportResult>('/admin/staff/import', this.form()));
      this.step.set(2);
    });
  }
  confirm() {
    if (this.busy() || !this.file || !this.result()?.valid || this.step() !== 2) return;
    this.operation.set('Đang import nhân viên, vui lòng chờ…');
    return this.run(async () => {
      this.result.set(await this.api.post<ImportResult>('/admin/staff/import', this.form(true)));
      this.step.set(3);
    });
  }
  template() {
    if (this.busy()) return;
    this.operation.set('Đang tải template Excel…');
    return this.run(async () =>
      download(await this.api.blob('/admin/staff/import/template'), 'staff-template.xlsx'),
    );
  }
  errors() {
    const rows = this.result()?.rows.filter((r) => r.error) || [];
    const cell = (s: string) =>
      '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"';
    download(
      new Blob(
        [
          '\ufeffDòng,Staff Code,Full Name,Cinema Code,Manager Username,Error\n' +
            rows
              .map((r) =>
                [String(r.row), r.staffCode, r.name, r.cinemaCode, r.managerUsername, r.error]
                  .map(cell)
                  .join(','),
              )
              .join('\n'),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'import-errors.csv',
    );
  }
  reset() {
    if (this.busy()) return;
    this.file = null;
    this.result.set(null);
    this.step.set(1);
    this.error.set('');
  }
}
