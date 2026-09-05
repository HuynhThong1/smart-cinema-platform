import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { Feedback, Page, Staff, Reason, FeedbackConfig, download, localDate } from '@cinema/core';
import { AsyncPage, Filters, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-feedback-list',
  imports: [FormsModule, RouterLink, DrawerModule, Filters, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Feedback</p>
        <h2>Tất cả feedback</h2>
        <p class="english">Every customer experience, recorded</p>
      </div>
      <button class="secondary" (click)="export()" [disabled]="busy()">Xuất CSV</button>
    </div>
    <cinema-filters
      [initialCinemaId]="route.snapshot.queryParamMap.get('cinemaId') || ''"
      (changed)="setFilters($event)"
    />
    <form class="toolbar" (ngSubmit)="page.set(1); load()">
      <input
        aria-label="Tìm khách hàng"
        name="search"
        [(ngModel)]="search"
        placeholder="Tên hoặc số điện thoại"
      /><select aria-label="Điểm đánh giá" name="rating" [(ngModel)]="rating">
        <option value="">Tất cả đánh giá</option>
        <option value="negative">1–2 · Tiêu cực</option>
        <option value="neutral">3 · Trung lập</option>
        <option value="positive">4–5 · Tích cực</option></select
      ><select aria-label="Nhân viên" name="staff" [(ngModel)]="staffId">
        <option value="">Tất cả nhân viên</option>
        @for (s of staff(); track s.id) {
          <option [value]="s.id">{{ s.staffCode }} · {{ s.name }}</option>
        }</select
      ><select aria-label="Lý do" name="reason" [(ngModel)]="reason">
        <option value="">Tất cả lý do</option>
        @for (r of reasons(); track r.code) {
          <option [value]="r.code">{{ r.label }}</option>
        }</select
      ><label class="checkbox-label"
        ><input type="checkbox" name="suspicious" [(ngModel)]="suspicious" />Chỉ nghi vấn</label
      ><button class="secondary" type="submit">Lọc</button>
    </form>
    <cinema-state [busy]="busy()" [error]="error()" (retry)="load()" />
    @if (!busy()) {
      <div class="table-wrap">
        <table class="table-wide">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Điểm</th>
              <th>Khách hàng</th>
              <th>Điện thoại</th>
              <th>Nhân viên</th>
              <th>Rạp</th>
              <th>Lý do</th>
              <th>Cờ</th>
            </tr>
          </thead>
          <tbody>
            @for (f of data().items; track f.id) {
              <tr>
                <td>
                  <button class="row-action" (click)="open(f.id)">
                    {{ localDate(f.createdAt) }}
                  </button>
                </td>
                <td>
                  <span
                    class="tag"
                    [class.bad]="f.rating.value < 3"
                    [class.good]="f.rating.value > 3"
                    >{{ f.rating.value }} · {{ f.rating.label }}</span
                  >
                </td>
                <td>{{ f.customer.name }}</td>
                <td>{{ f.customer.phone }}</td>
                <td>{{ f.staff.code }}</td>
                <td>{{ f.cinema.name }}</td>
                <td>
                  @for (r of f.reasons; track r.code) {
                    <span>{{ r.label }} · </span>
                  }
                </td>
                <td>{{ f.metadata.suspicious ? '⚑' : '' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">Không có feedback phù hợp với bộ lọc.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <cinema-pager [total]="data().total" [page]="page()" (changed)="page.set($event); load()" />
    }
    <p-drawer [(visible)]="drawer" position="right" header="Chi tiết feedback" [modal]="true">
      @if (detail(); as f) {
        <p class="english">{{ localDate(f.createdAt) }}</p>
        <h3>{{ f.rating.value }} / 5 · {{ f.rating.label }}</h3>
        @if (f.metadata.suspicious) {
          <p class="tag bad">Feedback nghi vấn</p>
        }
        <dl>
          <dt>Khách hàng</dt>
          <dd>{{ f.customer.name }}<br />{{ f.customer.phone }}</dd>
          <dt>Nhân viên</dt>
          <dd>{{ f.staff.code }} · {{ f.staff.name }}</dd>
          <dt>Rạp</dt>
          <dd>{{ f.cinema.name }}</dd>
          <dt>Lý do</dt>
          <dd>
            <div class="chips">
              @for (r of f.reasons; track r.code) {
                <span class="tag">{{ r.label }}</span>
              }
            </div>
          </dd>
          <dt>Bình luận</dt>
          <dd>
            <em>{{ f.comment || 'Không có bình luận' }}</em>
          </dd>
          <dt>Đồng ý bảo mật</dt>
          <dd>{{ f.consent.version }} · {{ localDate(f.consent.acceptedAt) }}</dd>
        </dl>
        <div class="actions">
          <a class="secondary" [routerLink]="['/staff', f.staff.id, 'performance']"
            >Hiệu suất nhân viên</a
          ><a
            class="primary"
            routerLink="/coaching"
            [queryParams]="{ staffId: f.staff.id, create: 'true' }"
            >Tạo coaching</a
          >
        </div>
      }
    </p-drawer>`,
})
export class FeedbackList extends AsyncPage {
  route = inject(ActivatedRoute);
  data = signal<Page<Feedback>>({ items: [], total: 0, page: 1, pageSize: 20 });
  staff = signal<Staff[]>([]);
  reasons = signal<Reason[]>([]);
  detail = signal<Feedback | null>(null);
  drawer = false;
  page = signal(1);
  search = '';
  rating = this.route.snapshot.queryParamMap.get('rating') || '';
  staffId = this.route.snapshot.queryParamMap.get('staffId') || '';
  reason = '';
  suspicious = false;
  params: Record<string, string | boolean> = {};
  localDate = localDate;
  async ngOnInit() {
    try {
      this.staff.set((await this.api.get<Page<Staff>>('/admin/staff', { pageSize: 100 })).items);
      this.reasons.set((await this.api.get<FeedbackConfig>('/public/feedback-config')).reasons);
    } catch {
      /* Main fetch reports failures. */
    }
  }
  setFilters(p: Record<string, string | boolean>) {
    this.params = { ...p };
    this.page.set(1);
    void this.load();
  }
  query() {
    return {
      ...this.params,
      search: this.search,
      rating: this.rating,
      staffId: this.staffId,
      reason: this.reason,
      suspicious: this.suspicious,
      page: this.page(),
    };
  }
  load() {
    return this.run(async (isCurrent) => {
      const result = await this.api.get<Page<Feedback>>('/admin/feedbacks', this.query());
      if (isCurrent()) this.data.set(result);
    });
  }
  open(id: string) {
    return this.run(async () => {
      this.detail.set(await this.api.get<Feedback>('/admin/feedbacks/' + id));
      this.drawer = true;
    });
  }
  export() {
    return this.run(async () =>
      download(await this.api.blob('/admin/feedbacks/export', this.query()), 'feedback.csv'),
    );
  }
}
