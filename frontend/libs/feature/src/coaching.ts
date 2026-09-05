import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { Coaching, Staff, Page } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-coaching',
  imports: [FormsModule, DialogModule, PageState, Pager],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Coaching</p>
        <h2>Coaching cases</h2>
        <p class="english">From customer feedback to better service</p>
      </div>
      <button class="primary" (click)="edit()">+ Tạo coaching</button>
    </div>
    <div class="status-strip">OPEN → IN_PROGRESS → COMPLETED · CANCELLED</div>
    <div class="toolbar">
      <select aria-label="Trạng thái coaching" [(ngModel)]="status" (change)="page.set(1); load()">
        <option value="">Tất cả</option>
        <option>OPEN</option>
        <option>IN_PROGRESS</option>
        <option>COMPLETED</option>
        <option>CANCELLED</option></select
      ><label class="checkbox-label"
        ><input type="checkbox" [(ngModel)]="followUp" (change)="page.set(1); load()" />Đến hạn
        follow-up</label
      >
    </div>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Chủ đề</th>
            <th>Hành động</th>
            <th>Follow-up</th>
            <th>Trạng thái</th>
            <th>Người tạo</th>
          </tr>
        </thead>
        <tbody>
          @for (c of data().items; track c.id) {
            <tr>
              <td>{{ staffName(c.staffId) }}</td>
              <td>
                <button class="row-action" (click)="edit(c)">
                  {{ c.topic }}
                </button>
              </td>
              <td>{{ c.action }}</td>
              <td>{{ c.followUpDate }}</td>
              <td>
                <span class="tag" [class.good]="c.status === 'COMPLETED'">{{ c.status }}</span>
              </td>
              <td>{{ c.createdBy }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">Chưa có coaching phù hợp.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    <p-dialog
      [(visible)]="dialog"
      [modal]="true"
      [header]="draft.id ? 'Chi tiết coaching' : 'Tạo coaching'"
      ><form class="form-fields" (ngSubmit)="save()">
        <label
          >Nhân viên *<select
            name="staff"
            [(ngModel)]="draft.staffId"
            [disabled]="!!draft.id"
            required
          >
            @for (s of staff(); track s.id) {
              <option [value]="s.id">{{ s.staffCode }} · {{ s.name }}</option>
            }
          </select></label
        ><label
          >Chủ đề *<input
            name="topic"
            [(ngModel)]="draft.topic"
            required
            minlength="2"
            maxlength="200" /></label
        ><label
          >Hành động *<textarea
            name="action"
            [(ngModel)]="draft.action"
            required
            minlength="2"
            maxlength="2000"
          ></textarea></label
        ><label
          >Ghi chú<textarea name="note" [(ngModel)]="draft.note" maxlength="4000"></textarea></label
        ><label
          >Ngày follow-up *<input type="date" name="date" [(ngModel)]="draft.followUpDate" required
        /></label>
        @if (draft.id) {
          <label
            >Trạng thái<select name="status" [(ngModel)]="draft.status">
              <option>OPEN</option>
              <option>IN_PROGRESS</option>
              <option>COMPLETED</option>
              <option>CANCELLED</option>
            </select></label
          >
        }
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="actions section">
          <button type="button" class="secondary" (click)="dialog = false">Huỷ</button
          ><button class="primary" [disabled]="busy()">Lưu coaching</button>
        </div>
      </form></p-dialog
    >`,
})
export class CoachingPage extends AsyncPage {
  route = inject(ActivatedRoute);
  data = signal<Page<Coaching>>({ items: [], total: 0, page: 1, pageSize: 20 });
  staff = signal<Staff[]>([]);
  page = signal(1);
  status = '';
  followUp = false;
  dialog = false;
  draft: Partial<Coaching> = {};
  staffId = this.route.snapshot.queryParamMap.get('staffId') || '';
  ngOnInit() {
    void this.load();
    void this.api
      .get<Page<Staff>>('/admin/staff', { pageSize: 100 })
      .then((p) => {
        this.staff.set(p.items);
        if (this.route.snapshot.queryParamMap.get('create')) this.edit();
      })
      .catch(() => {});
  }
  query() {
    return {
      page: this.page(),
      status: this.status,
      followUp: this.followUp,
      staffId: this.staffId,
    };
  }
  load() {
    return this.run(async () =>
      this.data.set(await this.api.get<Page<Coaching>>('/admin/coaching', this.query())),
    );
  }
  staffName(id: string) {
    const s = this.staff().find((x) => x.id === id);
    return s ? s.staffCode + ' · ' + s.name : id;
  }
  edit(c?: Coaching) {
    this.error.set('');
    this.draft = c
      ? { ...c }
      : {
          staffId: this.staffId || this.staff()[0]?.id,
          topic: '',
          action: '',
          note: '',
          status: 'OPEN',
          followUpDate: '',
        };
    this.dialog = true;
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/coaching/' + this.draft.id, this.draft);
      else await this.api.post('/admin/coaching', this.draft);
      this.dialog = false;
      this.notify('Đã lưu coaching');
      this.data.set(await this.api.get<Page<Coaching>>('/admin/coaching', this.query()));
    });
  }
}
