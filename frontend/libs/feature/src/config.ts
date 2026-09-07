import {
  CinemaBadge,
  CinemaField,
  CinemaButton,
  CinemaCheckbox,
  CinemaInput,
  CinemaNumber,
  CinemaOption,
  CinemaSelect,
  CinemaTable,
  RatingControl,
  Overlay,
  RowLink,
} from '@cinema/ui';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeedbackConfig, Reason } from '@cinema/core';
import { AsyncPage, PageState } from './shared';
@Component({
  selector: 'cinema-rating-config',
  imports: [
    CinemaField,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaNumber,
    CinemaTable,
    FormsModule,
    RatingControl,
    PageState,
  ],
  template: ` <p class="kicker">{{ i18n.t('config.configuration_rating') }}</p>
    <h2>{{ i18n.t('config.rating_configuration') }}</h2>

    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    @if (config(); as cfg) {
      <div class="config-layout section">
        <form #editorForm="ngForm" (ngSubmit)="editorForm.valid && !busy() && save()">
          <cinema-field inputId="config-field-1" [label]="i18n.t('config.display_type')"
            ><cinema-select inputId="config-field-1" name="type" [(ngModel)]="cfg.ratingType">
              <cinema-option [value]="'ICON+TEXT'" [label]="i18n.t('config.icon_and_text')" />
              <cinema-option [value]="'STAR'" [label]="i18n.t('config.stars')" />
              <cinema-option [value]="'BUTTON'" [label]="i18n.t('config.buttons')" />
              <cinema-option [value]="'TEXT'" [label]="i18n.t('config.text')" /> </cinema-select
          ></cinema-field>
          <div class="table-wrap section">
            <cinema-table [rows]="cfg.ratingOptions" [columns]="4"
              ><ng-template #header>
                <tr>
                  <th>{{ i18n.t('config.value') }}</th>
                  <th>{{ i18n.t('config.display_label') }}</th>
                  <th>{{ i18n.t('config.enabled') }}</th>
                  <th>{{ i18n.t('config.order') }}</th>
                </tr> </ng-template
              ><ng-template #body let-r let-i="index"
                ><tr>
                  <td>{{ r.value }}</td>
                  <td>
                    <input
                      cinemaInput
                      [name]="'label' + r.value"
                      [(ngModel)]="r.label"
                      [attr.aria-label]="i18n.t('config.vietnamese_label')"
                      required
                      maxlength="100"
                    /><input
                      cinemaInput
                      [name]="'english' + r.value"
                      [(ngModel)]="r.english"
                      [attr.aria-label]="i18n.t('config.english_label')"
                      maxlength="100"
                    />
                  </td>
                  <td>
                    <cinema-checkbox
                      [name]="'enabled' + r.value"
                      [(ngModel)]="r.enabled"
                      [attr.aria-label]="i18n.t('config.enable_rating') + r.value"
                    />
                  </td>
                  <td>
                    <div class="actions">
                      <button
                        cinemaButton
                        type="button"
                        class="text-button"
                        [disabled]="i === 0"
                        (click)="move(i, -1)"
                        [attr.aria-label]="i18n.t('config.move_up')"
                      >
                        ↑</button
                      ><button
                        cinemaButton
                        type="button"
                        class="text-button"
                        [disabled]="i === 4"
                        (click)="move(i, 1)"
                        [attr.aria-label]="i18n.t('config.move_down')"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr></ng-template
              ></cinema-table
            >
          </div>
          <div class="form-fields section">
            <cinema-field
              inputId="config-field-2"
              [label]="i18n.t('config.minimum_feedback_for_ranking')"
              ><cinema-number
                inputId="config-field-2"
                name="minimum"
                [(ngModel)]="cfg.minimumFeedbackForRanking"
                [min]="1"
                [max]="10000"
                required /></cinema-field
            ><cinema-field inputId="config-field-3" [label]="i18n.t('config.consent_version')"
              ><input
                id="config-field-3"
                cinemaInput
                name="consent"
                [(ngModel)]="cfg.consentVersion"
                required
                maxlength="50"
            /></cinema-field>
          </div>
          <button type="submit" cinemaButton class="primary section" [disabled]="busy()">
            {{ i18n.t('config.save_configuration') }}
          </button>
        </form>
        <aside>
          <h4>{{ i18n.t('config.preview') }}</h4>

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
      this.notify('config.rating_configuration_saved');
    });
  }
}
@Component({
  selector: 'cinema-reasons',
  imports: [
    CinemaBadge,
    CinemaField,
    CinemaButton,
    CinemaInput,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaNumber,
    CinemaTable,
    FormsModule,
    Overlay,
    RowLink,
    PageState,
  ],
  template: ` <div class="page-title">
      <div>
        <p class="kicker">{{ i18n.t('config.configuration_feedback_reasons') }}</p>
        <h2>{{ i18n.t('config.feedback_reasons') }}</h2>
      </div>
      <button type="button" cinemaButton class="primary" (click)="edit()">
        {{ i18n.t('config.add_reason') }}
      </button>
    </div>
    <cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      [message]="i18n.t(message())"
      (retry)="load()"
    />
    <div class="table-wrap section">
      <cinema-table [rows]="reasons()" [columns]="7"
        ><ng-template #header>
          <tr>
            <th>{{ i18n.t('administration.code') }}</th>
            <th>{{ i18n.t('config.label') }}</th>
            <th>{{ i18n.t('config.type') }}</th>
            <th>{{ i18n.t('config.rating') }}</th>
            <th>{{ i18n.t('config.required') }}</th>
            <th>{{ i18n.t('administration.status') }}</th>
            <th>{{ i18n.t('config.order') }}</th>
          </tr> </ng-template
        ><ng-template #body let-r
          ><tr (rowOpen)="edit(r)">
            <td>{{ r.code }}</td>
            <td>
              {{ i18n.label(r) }}
            </td>
            <td>
              <cinema-badge
                class="tag"
                [class.bad]="r.type === 'NEGATIVE'"
                [class.good]="r.type === 'POSITIVE'"
                >{{ i18n.t('common.status.' + r.type) }}</cinema-badge
              >
            </td>
            <td>{{ r.ratings.join(' · ') }}</td>
            <td>{{ r.required ? i18n.t('config.yes') : i18n.t('config.no') }}</td>
            <td>{{ i18n.t('common.status.' + r.status) }}</td>
            <td>{{ r.order }}</td>
          </tr></ng-template
        ></cinema-table
      >
    </div>
    <cinema-overlay [saving]="busy()" [(open)]="dialog" [header]="i18n.t('config.feedback_reasons')"
      ><form
        class="form-fields"
        #editorForm="ngForm"
        (ngSubmit)="editorForm.valid && !busy() && save()"
      >
        <cinema-field inputId="config-field-1" [label]="i18n.t('config.code')"
          ><input
            id="config-field-1"
            cinemaInput
            name="code"
            [(ngModel)]="draft.code"
            pattern="[A-Z][A-Z0-9_]{1,49}"
            required /></cinema-field
        ><cinema-field inputId="config-field-2" [label]="i18n.t('config.vietnamese_label_84')"
          ><input
            id="config-field-2"
            cinemaInput
            name="label"
            [(ngModel)]="draft.label"
            required
            maxlength="100" /></cinema-field
        ><cinema-field inputId="config-field-3" [label]="i18n.t('config.english_label')"
          ><input
            id="config-field-3"
            cinemaInput
            name="english"
            [(ngModel)]="draft.english"
            maxlength="100" /></cinema-field
        ><cinema-field inputId="config-field-4" [label]="i18n.t('config.type')"
          ><cinema-select inputId="config-field-4" name="type" [(ngModel)]="draft.type">
            <cinema-option [value]="'POSITIVE'" [label]="i18n.t('config.positive')" />
            <cinema-option [value]="'NEGATIVE'" [label]="i18n.t('config.negative')" />
            <cinema-option [value]="'NEUTRAL'" [label]="i18n.t('config.neutral')" />
            <cinema-option
              [value]="'BOTH'"
              [label]="i18n.t('config.both')"
            /> </cinema-select></cinema-field
        ><label>{{ i18n.t('config.applicable_ratings') }}</label>
        <div class="actions">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <label class="checkbox-label"
              ><cinema-checkbox [checked]="draft.ratings?.includes(n)" (change)="toggle(n)" />{{
                n
              }}</label
            >
          }
        </div>
        <label class="checkbox-label"
          ><cinema-checkbox name="required" [(ngModel)]="draft.required" />{{
            i18n.t('config.required')
          }}</label
        ><cinema-field inputId="config-field-5" [label]="i18n.t('administration.status')"
          ><cinema-select inputId="config-field-5" name="status" [(ngModel)]="draft.status">
            <cinema-option [value]="'ACTIVE'" [label]="i18n.t('administration.active')" />
            <cinema-option
              [value]="'DISABLED'"
              [label]="i18n.t('config.disabled')"
            /> </cinema-select></cinema-field
        ><cinema-field inputId="config-field-6" [label]="i18n.t('config.order')"
          ><cinema-number inputId="config-field-6" name="order" [(ngModel)]="draft.order" required
        /></cinema-field>
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
            {{ i18n.t('config.save_reason') }}
          </button>
        </div>
      </form></cinema-overlay
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
      this.notify('config.feedback_reason_saved');
    });
  }
}
