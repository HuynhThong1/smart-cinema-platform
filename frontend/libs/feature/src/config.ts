import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { FeedbackConfig, Reason } from '@cinema/core';
import { RatingControl } from '@cinema/ui';
import { AsyncPage, PageState } from './shared';
@Component({
  selector: 'cinema-rating-config',
  imports: [FormsModule, RatingControl, PageState],
  template: ` <p class="kicker">Cấu hình / Rating</p>
    <h2>Cấu hình đánh giá</h2>
    <p class="english">Change the customer experience without a deployment</p>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    @if (config(); as cfg) {
      <div class="config-layout section">
        <form (ngSubmit)="save()">
          <label
            >Kiểu hiển thị<select name="type" [(ngModel)]="cfg.ratingType">
              <option>ICON+TEXT</option>
              <option>STAR</option>
              <option>BUTTON</option>
              <option>TEXT</option>
            </select></label
          >
          <div class="table-wrap section">
            <table>
              <thead>
                <tr>
                  <th>Giá trị</th>
                  <th>Nhãn hiển thị</th>
                  <th>Bật</th>
                  <th>Thứ tự</th>
                </tr>
              </thead>
              <tbody>
                @for (r of cfg.ratingOptions; track r.value; let i = $index) {
                  <tr>
                    <td>{{ r.value }}</td>
                    <td>
                      <input
                        [name]="'label' + r.value"
                        [(ngModel)]="r.label"
                        aria-label="Nhãn tiếng Việt"
                        required
                        maxlength="100"
                      /><input
                        [name]="'english' + r.value"
                        [(ngModel)]="r.english"
                        aria-label="Nhãn tiếng Anh"
                        maxlength="100"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        [name]="'enabled' + r.value"
                        [(ngModel)]="r.enabled"
                        [attr.aria-label]="'Bật mức ' + r.value"
                      />
                    </td>
                    <td>
                      <div class="actions">
                        <button
                          type="button"
                          class="text-button"
                          [disabled]="i === 0"
                          (click)="move(i, -1)"
                          aria-label="Lên"
                        >
                          ↑</button
                        ><button
                          type="button"
                          class="text-button"
                          [disabled]="i === 4"
                          (click)="move(i, 1)"
                          aria-label="Xuống"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="form-fields section">
            <label
              >Feedback tối thiểu để ranking<input
                type="number"
                name="minimum"
                [(ngModel)]="cfg.minimumFeedbackForRanking"
                min="1"
                max="10000"
                required /></label
            ><label
              >Phiên bản consent<input
                name="consent"
                [(ngModel)]="cfg.consentVersion"
                required
                maxlength="50"
            /></label>
          </div>
          <button class="primary section" [disabled]="busy()">Lưu cấu hình</button>
        </form>
        <aside>
          <h4>Xem trước</h4>
          <p class="english">Customer rating control</p>
          <cinema-rating [config]="cfg" [value]="preview()" (changed)="preview.set($event)" />
        </aside>
      </div>
    }`,
})
export class RatingPage extends AsyncPage {
  config = signal<FeedbackConfig | null>(null);
  preview = signal(4);
  ngOnInit() {
    void this.load();
  }
  load() {
    return this.run(async () =>
      this.config.set(await this.api.get<FeedbackConfig>('/admin/feedback-config')),
    );
  }
  move(i: number, d: number) {
    const c = this.config()!;
    const next = [...c.ratingOptions];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    this.config.set({ ...c, ratingOptions: next });
  }
  save() {
    return this.run(async () => {
      await this.api.put('/admin/feedback-config', this.config());
      this.notify('Đã lưu cấu hình đánh giá');
    });
  }
}
@Component({
  selector: 'cinema-reasons',
  imports: [FormsModule, DialogModule, PageState],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">Cấu hình / Feedback reasons</p>
        <h2>Lý do feedback</h2>
        <p class="english">Relevant reasons for every rating</p>
      </div>
      <button class="primary" (click)="edit()">+ Thêm lý do</button>
    </div>
    <cinema-state [busy]="busy()" [error]="error()" [message]="message()" (retry)="load()" />
    <div class="table-wrap section">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Nhãn</th>
            <th>Loại</th>
            <th>Rating</th>
            <th>Bắt buộc</th>
            <th>Trạng thái</th>
            <th>Thứ tự</th>
          </tr>
        </thead>
        <tbody>
          @for (r of reasons(); track r.id) {
            <tr>
              <td>
                <button class="row-action" (click)="edit(r)">
                  {{ r.code }}
                </button>
              </td>
              <td>
                {{ r.label }}<small>{{ r.english }}</small>
              </td>
              <td>
                <span
                  class="tag"
                  [class.bad]="r.type === 'NEGATIVE'"
                  [class.good]="r.type === 'POSITIVE'"
                  >{{ r.type }}</span
                >
              </td>
              <td>{{ r.ratings.join(' · ') }}</td>
              <td>{{ r.required ? 'Có' : 'Không' }}</td>
              <td>{{ r.status }}</td>
              <td>{{ r.order }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p-dialog [(visible)]="dialog" [modal]="true" header="Lý do feedback"
      ><form class="form-fields" (ngSubmit)="save()">
        <label
          >Mã *<input
            name="code"
            [(ngModel)]="draft.code"
            pattern="[A-Z][A-Z0-9_]{1,49}"
            required /></label
        ><label
          >Nhãn tiếng Việt *<input
            name="label"
            [(ngModel)]="draft.label"
            required
            maxlength="100" /></label
        ><label
          >Nhãn tiếng Anh<input name="english" [(ngModel)]="draft.english" maxlength="100" /></label
        ><label
          >Loại<select name="type" [(ngModel)]="draft.type">
            <option>POSITIVE</option>
            <option>NEGATIVE</option>
            <option>NEUTRAL</option>
            <option>BOTH</option>
          </select></label
        ><label>Áp dụng rating</label>
        <div class="actions">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <label class="checkbox-label"
              ><input
                type="checkbox"
                [checked]="draft.ratings?.includes(n)"
                (change)="toggle(n)"
              />{{ n }}</label
            >
          }
        </div>
        <label class="checkbox-label"
          ><input name="required" type="checkbox" [(ngModel)]="draft.required" />Bắt buộc</label
        ><label
          >Trạng thái<select name="status" [(ngModel)]="draft.status">
            <option>ACTIVE</option>
            <option>DISABLED</option>
          </select></label
        ><label
          >Thứ tự<input type="number" name="order" [(ngModel)]="draft.order" required
        /></label>
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        }
        <div class="actions section">
          <button type="button" class="secondary" (click)="dialog = false">Huỷ</button
          ><button class="primary" [disabled]="busy()">Lưu lý do</button>
        </div>
      </form></p-dialog
    >`,
})
export class ReasonPage extends AsyncPage {
  reasons = signal<Reason[]>([]);
  dialog = false;
  draft: Partial<Reason> = {};
  ngOnInit() {
    void this.load();
  }
  load() {
    return this.run(async () =>
      this.reasons.set(await this.api.get<Reason[]>('/admin/feedback-reasons')),
    );
  }
  edit(r?: Reason) {
    this.error.set('');
    this.draft = r
      ? { ...r, ratings: [...r.ratings] }
      : {
          code: '',
          label: '',
          english: '',
          type: 'BOTH',
          ratings: [1, 2, 3, 4, 5],
          status: 'ACTIVE',
          required: false,
          order: this.reasons().length + 1,
        };
    this.dialog = true;
  }
  toggle(n: number) {
    const values = this.draft.ratings || [];
    this.draft.ratings = values.includes(n) ? values.filter((v) => v !== n) : [...values, n].sort();
  }
  save() {
    return this.run(async () => {
      if (this.draft.id) await this.api.put('/admin/feedback-reasons/' + this.draft.id, this.draft);
      else await this.api.post('/admin/feedback-reasons', this.draft);
      this.reasons.set(await this.api.get<Reason[]>('/admin/feedback-reasons'));
      this.dialog = false;
      this.notify('Đã lưu lý do feedback');
    });
  }
}
