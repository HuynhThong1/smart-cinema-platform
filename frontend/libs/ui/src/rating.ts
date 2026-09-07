import { I18n } from '@cinema/i18n';
import { CinemaButton } from './button';
import { inject, Component, input, output } from '@angular/core';
import type { FeedbackConfig } from '@cinema/core';
@Component({
  imports: [CinemaButton],
  selector: 'cinema-rating',
  standalone: true,
  template: ` <div
    class="rating-options"
    [attr.data-type]="config().ratingType"
    role="group"
    [attr.aria-label]="i18n.t('rating.rating')"
  >
    @for (option of config().ratingOptions; track option.value) {
      @if (option.enabled) {
        <button
          cinemaButton
          type="button"
          class="rating-option"
          [class.selected]="value() === option.value"
          [attr.aria-pressed]="value() === option.value"
          (click)="changed.emit(option.value)"
        >
          <span class="rating-number">{{ option.value }}</span
          ><span class="rating-label">{{ i18n.label(option) }}</span>
          @if (config().ratingType === 'STAR') {
            <span class="rating-face" aria-hidden="true">★</span>
          }
          @if (config().ratingType === 'ICON+TEXT') {
            <i [class]="'rating-face ph-duotone ph-' + option.icon" aria-hidden="true"></i>
          }
        </button>
      }
    }
  </div>`,
})
export class RatingControl {
  i18n = inject(I18n);
  config = input.required<FeedbackConfig>();
  value = input(0);
  changed = output<number>();
}
