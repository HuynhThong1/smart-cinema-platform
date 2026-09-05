import { Component, input, output } from '@angular/core';
import { FeedbackConfig } from '@cinema/core';
@Component({
  selector: 'cinema-rating',
  standalone: true,
  template: ` <div
    class="rating-options"
    [attr.data-type]="config().ratingType"
    role="group"
    aria-label="Mức đánh giá / Rating"
  >
    @for (option of config().ratingOptions; track option.value) {
      @if (option.enabled) {
        <button
          type="button"
          class="rating-option"
          [class.selected]="value() === option.value"
          [attr.aria-pressed]="value() === option.value"
          (click)="changed.emit(option.value)"
        >
          <span class="rating-number">{{ option.value }}</span
          ><span class="rating-label"
            >{{ option.label }}<small>{{ option.english }}</small></span
          >
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
  config = input.required<FeedbackConfig>();
  value = input(0);
  changed = output<number>();
}
