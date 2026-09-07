import { CinemaBadge, CinemaButton, CinemaTable } from '@cinema/ui';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImportResult, download } from '@cinema/core';
import { AsyncPage, PageState } from './shared';
@Component({
  selector: 'cinema-import',
  imports: [CinemaBadge, CinemaButton, CinemaTable, RouterLink, PageState],
  template: `
    <p class="kicker">{{ i18n.t('import.staff_import') }}</p>
    <h2>{{ i18n.t('import.import_staff') }}</h2>

    <div class="steps">
      @for (
        label of ['messages.upload_step', 'messages.preview_step', 'messages.result_step'];
        track label;
        let i = $index
      ) {
        <div class="step" [class.active]="step() === i + 1">{{ i18n.t(label) }}</div>
      }
    </div>
    <cinema-state [busy]="busy()" [error]="i18n.t(error())" (retry)="preview()" />
    @if (busy()) {
      <p role="status" aria-live="polite">{{ i18n.t(operation()) }}</p>
    }
    @if (step() === 1) {
      <div class="dropzone" (dragover)="$event.preventDefault()" (drop)="drop($event)">
        <h4>{{ i18n.t('import.drop_an_xlsx_csv_file_here') }}</h4>
        <p class="muted">{{ i18n.t('import.up_to_5_mb_1_000_rows') }}</p>

        <input #fileInput type="file" accept=".csv,.xlsx" hidden (change)="select($event)" /><button
          type="button"
          cinemaButton
          class="primary"
          [disabled]="busy()"
          (click)="fileInput.click()"
        >
          {{ i18n.t('import.choose_file') }}
        </button>
      </div>
      <button
        type="button"
        cinemaButton
        class="text-button"
        [disabled]="busy()"
        (click)="template()"
      >
        {{ i18n.t('import.download_excel_template_xlsx') }}
      </button>
      <p class="muted">{{ i18n.t('import.staff_code_full_name_cinema_code_manager_username') }}</p>
      <p class="muted">
        {{ i18n.t('import.enter_the_username_of_an_active_direct_manager_in_the_same_cinema') }}
      </p>
    }
    @if (result(); as r) {
      @if (step() === 2) {
        <div class="kpis">
          <div>
            {{ i18n.t('import.total') }}
            <div class="kpi-value">{{ r.total }}</div>
          </div>
          <div>
            {{ i18n.t('import.valid') }}
            <div class="kpi-value positive">{{ r.valid }}</div>
          </div>
          <div>
            {{ i18n.t('import.errors') }}
            <div class="kpi-value negative">{{ r.invalid }}</div>
          </div>
        </div>
        <div class="table-wrap">
          <cinema-table [rows]="r.rows" [columns]="6"
            ><ng-template #header>
              <tr>
                <th>{{ i18n.t('import.row') }}</th>
                <th>{{ i18n.t('import.staff_code') }}</th>
                <th>{{ i18n.t('import.full_name') }}</th>
                <th>{{ i18n.t('import.cinema_code') }}</th>
                <th>{{ i18n.t('import.direct_manager') }}</th>
                <th>{{ i18n.t('import.result') }}</th>
              </tr> </ng-template
            ><ng-template #body let-row
              ><tr>
                <td>{{ row.row }}</td>
                <td>{{ row.staffCode }}</td>
                <td>{{ row.name }}</td>
                <td>{{ row.cinemaCode }}</td>
                <td>{{ row.managerUsername || i18n.t('import.no_manager_assigned') }}</td>
                <td>
                  <cinema-badge class="tag" [class.bad]="row.error" [class.good]="!row.error">{{
                    rowMessage(row)
                  }}</cinema-badge>
                </td>
              </tr></ng-template
            ></cinema-table
          >
        </div>
        <div class="actions section">
          <button
            type="button"
            cinemaButton
            class="primary"
            [disabled]="busy() || !r.valid"
            (click)="confirm()"
          >
            {{
              busy()
                ? i18n.t('import.importing')
                : i18n.t('import.confirm_import') + r.valid + i18n.t('import.rows')
            }}</button
          ><button
            type="button"
            cinemaButton
            class="secondary"
            [disabled]="busy()"
            (click)="errors()"
          >
            {{ i18n.t('import.download_errors') }}</button
          ><button
            type="button"
            cinemaButton
            class="text-button"
            [disabled]="busy()"
            (click)="reset()"
          >
            {{ i18n.t('administration.cancel') }}
          </button>
        </div>
      }
      @if (step() === 3) {
        <section class="empty">
          <h3>{{ i18n.t('import.imported_p0_staff_members', { p0: r.imported }) }}</h3>
          <p>{{ i18n.t('import.p0_rows_skipped', { p0: r.invalid }) }}</p>
          <div class="actions">
            <a cinemaButton routerLink="/qr" class="primary">{{
              i18n.t('import.generate_qr_for_new_staff')
            }}</a
            ><button
              type="button"
              cinemaButton
              class="secondary"
              [disabled]="busy()"
              (click)="errors()"
            >
              {{ i18n.t('import.download_errors') }}</button
            ><button
              type="button"
              cinemaButton
              class="text-button"
              [disabled]="busy()"
              (click)="reset()"
            >
              {{ i18n.t('import.import_another_file') }}
            </button>
          </div>
        </section>
      }
    }
  `,
})
export class ImportPage extends AsyncPage {
  rowMessage(row: ImportResult['rows'][number]) {
    if (!row.error) return this.i18n.t('import.valid');
    const key = 'common.errors.' + (row.errorCode || 'VALIDATION');
    const text = this.i18n.t(key);
    return text === key ? this.i18n.t('common.errors.VALIDATION') : text;
  }
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
      this.error.set('import.file_exceeds_5_mb');
      return;
    }
    this.operation.set('import.validating_file');
    return this.run(async () => {
      this.result.set(await this.api.post<ImportResult>('/admin/staff/import', this.form()));
      this.step.set(2);
    });
  }
  confirm() {
    if (this.busy() || !this.file || !this.result()?.valid || this.step() !== 2) return;
    this.operation.set('import.importing_staff_please_wait');
    return this.run(async () => {
      this.result.set(await this.api.post<ImportResult>('/admin/staff/import', this.form(true)));
      this.step.set(3);
    });
  }
  template() {
    if (this.busy()) return;
    this.operation.set('import.downloading_excel_template');
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
          this.i18n.t('import.row_staff_code_full_name_cinema_code_manager_username_error') +
            '\n' +
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
