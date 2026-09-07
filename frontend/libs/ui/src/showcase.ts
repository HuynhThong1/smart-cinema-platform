import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { I18n } from '@cinema/i18n';
import { CinemaButton } from './button';
import {
  CinemaField,
  CinemaInput,
  CinemaTextarea,
  CinemaSelect,
  CinemaOption,
  CinemaCheckbox,
  CinemaDate,
  CinemaNumber,
  CinemaMultiSelect,
} from './fields';
import { CinemaTable } from './table';
import { Overlay } from './overlay';
import { LanguageSwitch, PageState } from './feedback';
/** Development-only integration surface. No API or authorization dependencies. */
@Component({
  selector: 'cinema-ui-showcase',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CinemaButton,
    CinemaField,
    CinemaInput,
    CinemaTextarea,
    CinemaSelect,
    CinemaOption,
    CinemaCheckbox,
    CinemaDate,
    CinemaNumber,
    CinemaMultiSelect,
    CinemaTable,
    Overlay,
    LanguageSwitch,
    PageState,
  ],
  template: ` <main style="max-width:900px;margin:30px auto;padding:20px">
    <cinema-language />
    <h1>{{ i18n.t('showcase.title') }}</h1>
    <form [formGroup]="form" (ngSubmit)="submitted.set(submitted() + 1)">
      <cinema-field inputId="demo-name" [label]="i18n.t('showcase.name')" [required]="true"
        ><input cinemaInput id="demo-name" formControlName="name"
      /></cinema-field>
      <cinema-field inputId="demo-select" [label]="i18n.t('showcase.select')"
        ><cinema-select inputId="demo-select" formControlName="choice" [required]="true"
          ><cinema-option value="a" [label]="i18n.t('showcase.first')" /><cinema-option
            value="b"
            [label]="i18n.t('showcase.second')" /></cinema-select
      ></cinema-field>
      <cinema-field inputId="demo-multi" [label]="i18n.t('showcase.multi')"
        ><cinema-multiselect
          inputId="demo-multi"
          formControlName="choices"
          [options]="[
            { label: i18n.t('showcase.first'), value: 'a' },
            { label: i18n.t('showcase.second'), value: 'b' },
          ]"
      /></cinema-field>
      <cinema-field inputId="demo-number" [label]="i18n.t('showcase.number')"
        ><cinema-number inputId="demo-number" formControlName="amount" [min]="1" [max]="5"
      /></cinema-field>
      <cinema-field inputId="demo-date" [label]="i18n.t('showcase.date')"
        ><cinema-date inputId="demo-date" formControlName="date"
      /></cinema-field>
      <cinema-field inputId="demo-notes" [label]="i18n.t('showcase.notes')">
        <textarea cinemaTextarea id="demo-notes" formControlName="notes"></textarea>
      </cinema-field>
      <label for="demo-check"
        ><cinema-checkbox inputId="demo-check" formControlName="checked" />{{
          i18n.t('showcase.check')
        }}</label
      >
      <div class="actions section">
        <button cinemaButton type="submit" [disabled]="form.invalid">
          {{ i18n.t('showcase.submit') }}</button
        ><button cinemaButton (click)="dialog.set(true)">{{ i18n.t('showcase.dialog') }}</button
        ><button cinemaButton (click)="drawer.set(true)">{{ i18n.t('showcase.drawer') }}</button
        ><button cinemaButton (click)="confirm.set(true)">{{ i18n.t('showcase.confirm') }}</button
        ><button cinemaButton [loading]="true">{{ i18n.t('showcase.loading') }}</button
        ><button cinemaButton (click)="form.disabled ? form.enable() : form.disable()">
          {{ i18n.t('showcase.toggle') }}
        </button>
      </div>
    </form>
    <output data-testid="form-value">{{ json(form.getRawValue()) }}</output
    ><output data-testid="touched">{{ form.controls.choice.touched }}</output
    ><output data-testid="submitted">{{ submitted() }}</output>
    <cinema-table
      [rows]="[
        { id: 'a', name: i18n.t('showcase.first') },
        { id: 'b', name: i18n.t('showcase.second') },
      ]"
      [columnDefinitions]="[{ field: 'name', label: i18n.t('showcase.name'), sortable: true }]"
      [selectable]="true"
      [selection]="selection()"
      (selectionChanged)="selection.set($event)"
      [paginated]="true"
      [page]="page()"
      [pageSize]="2"
      [total]="6"
      (pageChanged)="page.set($event.page)"
      (sortChanged)="sort.set($event.sortField?.toString() || '')"
    />
    <output data-testid="page">{{ page() }}</output
    ><output data-testid="selection">{{ selection().length }}</output
    ><output data-testid="sort">{{ sort() }}</output>
    <cinema-state [busy]="false" [message]="message()" />
    <cinema-overlay [(open)]="dialog" [header]="i18n.t('showcase.dialog')" [saving]="saving()"
      ><input cinemaInput [(ngModel)]="draft" [attr.aria-label]="i18n.t('showcase.name')" /><button
        cinemaButton
        (click)="saving.set(!saving())"
      >
        {{ i18n.t('showcase.saving') }}</button
      ><button cinemaButton [disabled]="saving()" (click)="dialog.set(false)">
        {{ i18n.t('common.close') }}
      </button></cinema-overlay
    >
    <cinema-overlay [(open)]="drawer" variant="drawer" [header]="i18n.t('showcase.drawer')"
      ><button cinemaButton (click)="drawer.set(false)">
        {{ i18n.t('common.close') }}
      </button></cinema-overlay
    >
    <cinema-overlay [(open)]="confirm" variant="confirm" [header]="i18n.t('showcase.confirm')"
      ><p>{{ i18n.t('showcase.confirm_text') }}</p>
      <button cinemaButton (click)="confirm.set(false)">{{ i18n.t('common.cancel') }}</button
      ><button cinemaButton (click)="confirm.set(false); message.set(i18n.t('showcase.confirmed'))">
        {{ i18n.t('common.confirm') }}
      </button></cinema-overlay
    >
  </main>`,
})
export class Showcase {
  i18n = inject(I18n);
  json = JSON.stringify;
  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    choice: new FormControl('a'),
    choices: new FormControl<string[]>([]),
    amount: new FormControl(1),
    date: new FormControl('2026-09-07'),
    notes: new FormControl(''),
    checked: new FormControl(false),
  });
  submitted = signal(0);
  page = signal(1);
  selection = signal<{ id: string; name: string }[]>([]);
  sort = signal('');
  dialog = signal(false);
  drawer = signal(false);
  confirm = signal(false);
  saving = signal(false);
  message = signal('');
  draft = '';
}
