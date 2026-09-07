import {
  Component,
  Injectable,
  inject,
  Directive,
  booleanAttribute,
  computed,
  effect,
  contentChildren,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { I18n } from '@cinema/i18n';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';

@Directive({ selector: 'input[cinemaInput]', hostDirectives: [InputText] })
export class CinemaInput {}
@Directive({ selector: 'textarea[cinemaTextarea]', hostDirectives: [Textarea] })
export class CinemaTextarea {}
@Component({
  selector: 'cinema-field',
  template: `<div class="cinema-field">
    <label [attr.for]="inputId()"
      >{{ label() }}
      @if (required()) {
        <span aria-hidden="true"> *</span>
      }</label
    ><ng-content />
    @if (hint()) {
      <small [id]="inputId() + '-hint'">{{ hint() }}</small>
    }
    @if (error()) {
      <small class="field-error" role="alert" [id]="inputId() + '-error'">{{ error() }}</small>
    }
  </div>`,
})
export class CinemaField {
  inputId = input.required<string>();
  label = input('');
  hint = input('');
  error = input('');
  required = input(false, { transform: booleanAttribute });
}
@Injectable({ providedIn: 'root' })
class ControlIds {
  private serial = 0;
  next() {
    return 'cinema-control-' + ++this.serial;
  }
}
@Directive()
export abstract class ValueControl<T> implements ControlValueAccessor, Validator {
  private validationChanged = () => {};
  protected bounds(): unknown[] {
    return [];
  }
  constructor() {
    effect(() => {
      this.required();
      this.bounds();
      this.validationChanged();
    });
  }
  registerOnValidatorChange(fn: () => void) {
    this.validationChanged = fn;
  }
  validate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    return this.required() &&
      (value == null || value === '' || value === false || (Array.isArray(value) && !value.length))
      ? { required: true }
      : null;
  }
  value = signal<T | null>(null);
  disabled = input(false, { transform: booleanAttribute });
  formDisabled = signal(false);
  blocked = computed(() => this.disabled() || this.formDisabled());
  inputId = input(inject(ControlIds).next());
  ariaLabel = input('', { alias: 'aria-label' });
  private field = inject(CinemaField, { optional: true });
  accessibleLabel = computed(() => this.ariaLabel() || this.field?.label() || undefined);
  required = input(false, { transform: booleanAttribute });
  invalid = input(false, { transform: booleanAttribute });
  change = output<T | null>();
  protected onChange: (value: T | null) => void = () => {};
  touched: () => void = () => {};
  writeValue(value: T | null) {
    this.value.set(value);
  }
  registerOnChange(fn: (value: T | null) => void) {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  setDisabledState(value: boolean) {
    this.formDisabled.set(value);
  }
  update(value: T | null) {
    this.value.set(value);
    this.onChange(value);
    this.change.emit(value);
  }
}
@Component({ selector: 'cinema-option', template: '', host: { hidden: '' } })
export class CinemaOption {
  value = input<unknown>('');
  label = input('');
  disabled = input(false, { transform: booleanAttribute });
}
@Component({
  selector: 'cinema-select',
  imports: [FormsModule, SelectModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CinemaSelect), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CinemaSelect), multi: true },
  ],
  template: `<p-select
      [options]="items()"
      [pt]="{
        dropdown: { 'aria-label': accessibleLabel() || i18n.t('common.prime.aria.listLabel') },
      }"
      optionLabel="label"
      optionValue="value"
      optionDisabled="disabled"
      [ngModel]="value()"
      (ngModelChange)="update($event)"
      [disabled]="blocked()"
      [inputId]="inputId()"
      [ariaLabel]="accessibleLabel()"
      [required]="required()"
      [invalid]="invalid()"
      [filter]="filter()"
      [placeholder]="placeholder()"
      (onBlur)="touched()"
      appendTo="body"
    /><ng-content />`,
})
export class CinemaSelect extends ValueControl<unknown> {
  protected i18n = inject(I18n);
  options = contentChildren(CinemaOption, { descendants: true });
  items = computed(() =>
    this.options().map((o) => ({ value: o.value(), label: o.label(), disabled: o.disabled() })),
  );
  filter = input(false, { transform: booleanAttribute });
  placeholder = input('');
}
@Component({
  selector: 'cinema-multiselect',
  imports: [FormsModule, MultiSelectModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CinemaMultiSelect), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CinemaMultiSelect), multi: true },
  ],
  template: `<p-multiselect
    [options]="options()"
    optionLabel="label"
    optionValue="value"
    [ngModel]="value()"
    (ngModelChange)="update($event)"
    [disabled]="blocked()"
    [inputId]="inputId()"
    [ariaLabel]="accessibleLabel()"
    [required]="required()"
    [invalid]="invalid()"
    (onBlur)="touched()"
    appendTo="body"
  />`,
})
export class CinemaMultiSelect extends ValueControl<unknown[]> {
  options = input<{ label: string; value: unknown }[]>([]);
}
@Component({
  selector: 'cinema-checkbox',
  imports: [FormsModule, CheckboxModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CinemaCheckbox), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CinemaCheckbox), multi: true },
  ],
  template: `<p-checkbox
    [binary]="true"
    [ngModel]="checked() ?? value()"
    (ngModelChange)="update($event)"
    [disabled]="blocked()"
    [inputId]="inputId()"
    [ariaLabel]="accessibleLabel()"
    [required]="required()"
    [invalid]="invalid()"
    (onBlur)="touched()"
  />`,
})
export class CinemaCheckbox extends ValueControl<boolean> {
  checked = input<boolean>();
}
@Component({
  selector: 'cinema-number',
  imports: [FormsModule, InputNumberModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CinemaNumber), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CinemaNumber), multi: true },
  ],
  template: `<p-inputnumber
    [ngModel]="value()"
    (ngModelChange)="update($event)"
    [disabled]="blocked()"
    [inputId]="inputId()"
    [ariaLabel]="accessibleLabel()"
    [required]="required()"
    [invalid]="invalid()"
    [min]="min()"
    [max]="max()"
    [useGrouping]="false"
    [locale]="i18n.language() === 'vi' ? 'vi-VN' : 'en-GB'"
    (onBlur)="touched()"
  />`,
})
export class CinemaNumber extends ValueControl<number> {
  protected i18n = inject(I18n);
  protected override bounds() {
    return [this.min(), this.max()];
  }
  override validate(control: AbstractControl): ValidationErrors | null {
    const error = super.validate(control);
    if (error || control.value == null) return error;
    const value = Number(control.value),
      min = this.min(),
      max = this.max();
    return !Number.isFinite(value)
      ? { number: true }
      : min != null && value < min
        ? { min: { min, actual: value } }
        : max != null && value > max
          ? { max: { max, actual: value } }
          : null;
  }

  min = input<number>();
  max = input<number>();
}
@Component({
  selector: 'cinema-date',
  imports: [FormsModule, DatePickerModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CinemaDate), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CinemaDate), multi: true },
  ],
  template: `<p-datepicker
    [ngModel]="dateValue()"
    (ngModelChange)="updateDate($event)"
    [disabled]="blocked()"
    [inputId]="inputId()"
    [ariaLabel]="accessibleLabel()"
    [required]="required()"
    [invalid]="invalid()"
    [minDate]="minDate()"
    [maxDate]="maxDate()"
    [showIcon]="true"
    [readonlyInput]="true"
    dateFormat="dd/mm/yy"
    (onBlur)="touched()"
    appendTo="body"
  />`,
})
export class CinemaDate extends ValueControl<string> {
  protected override bounds() {
    return [this.min(), this.max()];
  }
  override validate(control: AbstractControl): ValidationErrors | null {
    const error = super.validate(control);
    if (error || !control.value) return error;
    const value = control.value as string;
    return !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      (this.min() && value < this.min()) ||
      (this.max() && value > this.max())
      ? { date: true }
      : null;
  }

  min = input('');
  max = input('');
  private parse(value: string | null) {
    return value
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10)),
        )
      : null;
  }
  dateValue = computed(() => this.parse(this.value()));
  minDate = computed(() => this.parse(this.min()));
  maxDate = computed(() => this.parse(this.max()));
  updateDate(date: Date | null) {
    this.update(
      date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : '',
    );
  }
}
