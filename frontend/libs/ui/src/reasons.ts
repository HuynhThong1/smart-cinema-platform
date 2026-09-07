import { Component, input, output } from '@angular/core';
import { CinemaButton } from './button';
export interface ReasonChip {
  code: string;
  label: string;
  required?: boolean;
}
@Component({
  selector: 'cinema-reasons',
  imports: [CinemaButton],
  template: `<div class="chips">
    @for (reason of options(); track reason.code) {
      <button
        cinemaButton
        type="button"
        class="chip"
        [class.selected]="value().includes(reason.code)"
        [attr.aria-pressed]="value().includes(reason.code)"
        [disabled]="disabled()"
        (click)="toggled.emit(reason.code)"
      >
        {{ reason.label }}{{ reason.required ? ' *' : '' }}
      </button>
    }
  </div>`,
})
export class ReasonChips {
  options = input<ReasonChip[]>([]);
  value = input<string[]>([]);
  disabled = input(false);
  toggled = output<string>();
}
