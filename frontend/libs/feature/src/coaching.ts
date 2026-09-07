import {
  CinemaBadge,
  CinemaField,
  CinemaButton,
  CinemaCheckbox,
  CinemaDate,
  CinemaInput,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  CinemaTextarea,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Coaching, Staff, Page } from '@cinema/core';
import { AsyncPage, PageState, Pager } from './shared';
@Component({
  selector: 'cinema-coaching',
  imports: [
    CinemaBadge,
    CinemaField,
    CinemaButton,
    CinemaInput,
    CinemaTextarea,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaDate,
    CinemaTable,
    FormsModule,
    Overlay,
    RowLink,
    PageState,
    Pager,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('coaching.coaching') }}</p>
        <h2>{{ i18n.t('coaching.coaching_cases') }}</h2>
      </div>
      <button type="button" cinemaButton class="primary" (click)="edit()">
        {{ i18n.t('coaching.create_coaching') }}
      </button>
    </div>
    <div class="status-strip">{{ i18n.t('coaching.open_in_progress_completed_cancelled') }}</div>
    <div class="toolbar">
      <cinema-select
        [aria-label]="i18n.t('coaching.coaching_status')"
        [(ngModel)]="status"
        (change)="page.set(1); load()"
      >
        <cinema-option [value]="''" [label]="i18n.t('coaching.all')" />
        <cinema-option [value]="'OPEN'" [label]="i18n.t('coaching.open')" />
        <cinema-option [value]="'IN_PROGRESS'" [label]="i18n.t('coaching.in_progress')" />
        <cinema-option [value]="'COMPLETED'" [label]="i18n.t('coaching.completed')" />
        <cinema-option
          [value]="'CANCELLED'"
          [label]="i18n.t('coaching.cancelled')" /></cinema-select
      ><label class="checkbox-label"
        ><cinema-checkbox [(ngModel)]="followUp" (change)="page.set(1); load()" />{{
          i18n.t('coaching.follow_up_due')
        }}</label
      >
    </div>
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
            <th>{{ i18n.t('coaching.staff') }}</th>
            <th>{{ i18n.t('coaching.topic') }}</th>
            <th>{{ i18n.t('administration.action') }}</th>
            <th>{{ i18n.t('coaching.follow_up') }}</th>
            <th>{{ i18n.t('administration.status') }}</th>
            <th>{{ i18n.t('coaching.created_by') }}</th>
          </tr> </ng-template
        ><ng-template #body let-c
          ><tr (rowOpen)="edit(c)">
            <td>{{ staffName(c.staffId) }}</td>
            <td>{{ c.topic }}</td>
            <td>{{ c.action }}</td>
            <td>{{ c.followUpDate }}</td>
            <td>
              <cinema-badge class="tag" [class.good]="c.status === 'COMPLETED'">{{
                i18n.t('common.status.' + c.status)
              }}</cinema-badge>
            </td>
            <td>{{ c.createdBy }}</td>
          </tr></ng-template
        ><ng-template #empty
          ><tr>
            <td colspan="6">{{ i18n.t('coaching.no_matching_coaching_cases') }}</td>
          </tr></ng-template
        ></cinema-table
      >
    </div>
    <cinema-pager [page]="page()" [total]="data().total" (changed)="page.set($event); load()" />
    <cinema-overlay
      [saving]="busy()"
      [(open)]="dialog"
      [header]="
        draft.id ? i18n.t('coaching.coaching_details') : i18n.t('coaching.create_coaching_43')
      "
      ><form
        class="form-fields"
        #editorForm="ngForm"
        (ngSubmit)="editorForm.valid && !busy() && save()"
      >
        <cinema-field inputId="coaching-field-1" [label]="i18n.t('coaching.staff_44')"
          ><cinema-select
            inputId="coaching-field-1"
            name="staff"
            [(ngModel)]="draft.staffId"
            [disabled]="!!draft.id"
            required
          >
            @for (s of staff(); track s.id) {
              <cinema-option [value]="s.id" [label]="s.staffCode + ' · ' + s.name" />
            }</cinema-select></cinema-field
        ><cinema-field inputId="coaching-field-2" [label]="i18n.t('coaching.topic_45')"
          ><input
            id="coaching-field-2"
            cinemaInput
            name="topic"
            [(ngModel)]="draft.topic"
            required
            minlength="2"
            maxlength="200" /></cinema-field
        ><cinema-field inputId="coaching-field-3" [label]="i18n.t('coaching.action')">
          <textarea
            id="coaching-field-3"
            cinemaTextarea
            name="action"
            [(ngModel)]="draft.action"
            required
            minlength="2"
            maxlength="2000"
          ></textarea></cinema-field
        ><cinema-field inputId="coaching-field-4" [label]="i18n.t('coaching.notes')">
          <textarea
            id="coaching-field-4"
            cinemaTextarea
            name="note"
            [(ngModel)]="draft.note"
            maxlength="4000"
          ></textarea></cinema-field
        ><cinema-field inputId="coaching-field-5" [label]="i18n.t('coaching.follow_up_date')"
          ><cinema-date
            inputId="coaching-field-5"
            name="date"
            [(ngModel)]="draft.followUpDate"
            required
        /></cinema-field>
        @if (draft.id) {
          <cinema-field inputId="coaching-field-6" [label]="i18n.t('administration.status')"
            ><cinema-select inputId="coaching-field-6" name="status" [(ngModel)]="draft.status">
              <cinema-option [value]="'OPEN'" [label]="i18n.t('coaching.open')" />
              <cinema-option [value]="'IN_PROGRESS'" [label]="i18n.t('coaching.in_progress')" />
              <cinema-option [value]="'COMPLETED'" [label]="i18n.t('coaching.completed')" />
              <cinema-option
                [value]="'CANCELLED'"
                [label]="i18n.t('coaching.cancelled')"
              /> </cinema-select
          ></cinema-field>
        }
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
            {{ i18n.t('coaching.save_coaching') }}
          </button>
        </div>
      </form></cinema-overlay
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
      this.notify('coaching.coaching_saved');
      this.data.set(await this.api.get<Page<Coaching>>('/admin/coaching', this.query()));
    });
  }
}
