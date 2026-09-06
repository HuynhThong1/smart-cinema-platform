import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QR, Staff, Cinema, Page, download } from '@cinema/core';
import { Overlay, RowLink } from '@cinema/ui';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-qr',
  imports: [FormsModule, Overlay, RowLink, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Nhân viên / QR Management</p>
        <h2>Quản lý QR</h2>
        <p class="english">One staff member. One fixed QR.</p>
      </div>
      <button class="primary" (click)="ask('batch')">Generate QR cho tất cả</button>
    </div>
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        name="search"
        [(ngModel)]="search"
        placeholder="Tìm mã hoặc tên nhân viên"
        aria-label="Tìm nhân viên"
      />
      @if (auth.global()) {
        <select name="cinema" [(ngModel)]="cinemaId" aria-label="Rạp">
          <option value="">Tất cả rạp</option>
          @for (c of cinemas(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      }
      <button class="secondary">Lọc</button
      ><button type="button" class="secondary" (click)="package()">↓ Tải ZIP</button>
    </form>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    <div class="qr-layout">
      <div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ tên</th>
                <th>Trạng thái</th>
                <th>QR</th>
              </tr>
            </thead>
            <tbody>
              @for (s of data().items; track s.id) {
                <tr
                  [style.background]="selected()?.id === s.id ? '#eaf1fa' : ''"
                  (rowOpen)="select(s)"
                >
                  <td>{{ s.staffCode }}</td>
                  <td>{{ s.name }}</td>
                  <td>
                    <span class="tag">{{ s.status }}</span>
                  </td>
                  <td>
                    <button class="text-button" (click)="select(s)">Xem QR</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">Chưa có nhân viên phù hợp.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
      </div>
      <aside class="qr-preview">
        @if (selected(); as s) {
          <h4>QR — {{ s.staffCode }}</h4>
          <p class="english">{{ s.name }}</p>
          @if (qr(); as q) {
            <span class="tag" [class.good]="q.status === 'ACTIVE'">{{ q.status }}</span>
            @if (q.url) {
              @if (q.status === 'ACTIVE') {
                <img class="qr-image" [src]="image()" alt="QR đánh giá trải nghiệm" />
              }
              <p class="qr-url">{{ q.url }}</p>
              <div class="actions">
                <button class="secondary" (click)="copy()">Copy URL</button
                ><button
                  class="secondary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="download('png')"
                >
                  PNG</button
                ><button
                  class="secondary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="download('svg')"
                >
                  SVG</button
                ><button
                  class="primary"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="printVisible = !printVisible"
                >
                  Mẫu in
                </button>
              </div>
              <div class="actions section">
                <button class="text-button" (click)="ask('regenerate')">Regenerate</button
                ><button
                  class="text-button negative"
                  [disabled]="q.status !== 'ACTIVE'"
                  (click)="ask('disable')"
                >
                  Disable
                </button>
              </div>
              <p class="english">
                Regenerate vô hiệu hoá mã cũ ngay lập tức. Cần in lại thẻ tại POS.
              </p>
            } @else {
              <div class="notice">
                <p>Chưa có QR</p>
                <button
                  class="primary"
                  [disabled]="s.status !== 'ACTIVE' || busy()"
                  (click)="generate()"
                >
                  Generate QR
                </button>
              </div>
            }
          }
        } @else {
          <div class="notice">Chọn nhân viên để xem hoặc tạo QR.</div>
        }
      </aside>
    </div>
    @if (printVisible && qr()?.status === 'ACTIVE') {
      <div class="section split">
        <div class="print-card">
          <img src="/galaxy-logo.png" width="150" alt="Galaxy Cinema" /><img
            class="qr-image"
            [src]="image()"
            alt="Quét mã để đánh giá"
          />
          <h3>QUÉT MÃ ĐỂ ĐÁNH GIÁ<br />TRẢI NGHIỆM CỦA BẠN</h3>
          <p class="english">Scan to rate your experience</p>
          <p class="positive">Chỉ mất 15–30 giây</p>
        </div>
        <div>
          <h4>Mẫu in tại POS</h4>
          <p>QR tối thiểu 35 mm, tương phản cao, nền trắng và khoảng trống ít nhất 4 module.</p>
          <div class="chips" role="radiogroup" aria-label="Khổ in">
            @for (size of printSizes; track size.value) {
              <button
                type="button"
                class="chip"
                role="radio"
                [class.selected]="printSize() === size.value"
                [attr.aria-checked]="printSize() === size.value"
                (click)="printSize.set(size.value)"
              >
                {{ size.label }}
              </button>
            }
          </div>
          <div class="actions section">
            <button class="primary" (click)="download('pdf')">↓ PDF</button
            ><button class="secondary" (click)="print()">In</button
            ><button class="text-button" (click)="printVisible = false">Đóng</button>
          </div>
        </div>
      </div>
    }
    <cinema-overlay
      [(open)]="dialog"
      [header]="
        action === 'batch'
          ? 'Generate QR cho tất cả nhân viên?'
          : action === 'disable'
            ? 'Vô hiệu hoá QR?'
            : 'Tạo lại QR?'
      "
      ><p>
        {{
          action === 'batch'
            ? 'Chỉ tạo QR còn thiếu trong phạm vi rạp đã chọn. QR hiện có được giữ nguyên.'
            : action === 'disable'
              ? 'QR sẽ ngừng nhận feedback. Thao tác được ghi audit.'
              : 'Token cũ mất hiệu lực ngay lập tức. Bạn cần in lại thẻ QR tại POS.'
        }}
      </p>
      <div class="overlay-actions">
        <button class="secondary" (click)="dialog = false">Huỷ</button
        ><button
          [class]="action === 'batch' ? 'primary' : 'danger'"
          [disabled]="busy()"
          (click)="confirm()"
        >
          Xác nhận
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
    { value: 'a6', label: 'A6 card' },
    { value: 'a5', label: 'A5 poster' },
    { value: 'sticker', label: '80×80 sticker' },
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
      this.notify('Đã tạo QR');
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
        this.notify('Đã tạo ' + r.created + ' QR · ' + r.existing + ' QR đã có');
      } else {
        const st = this.selected()!;
        if (this.action === 'disable') await this.api.delete('/admin/staff/' + st.id + '/qr');
        else await this.api.post('/admin/staff/' + st.id + '/qr/regenerate', {});
        await this.loadQR(st);
        this.notify('Đã cập nhật QR');
      }
      this.dialog = false;
    });
  }
  copy() {
    return this.run(async () => {
      await navigator.clipboard.writeText(this.qr()?.url || '');
      this.notify('Đã sao chép URL');
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
