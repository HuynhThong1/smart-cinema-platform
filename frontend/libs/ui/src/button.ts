import {
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
/** Keep native button/link semantics while sharing PrimeNG styling and loading behaviour. */
@Directive({
  selector: 'button[cinemaButton],a[cinemaButton]',
  hostDirectives: [ButtonDirective],
  host: {
    '[attr.type]': 'buttonType()',
    '[attr.disabled]': 'blocked() ? true : null',
    '[attr.aria-disabled]': 'blocked() || null',
    '[attr.aria-busy]': 'loading() || null',
    '(click)': 'guard($event)',
  },
})
export class CinemaButton {
  private element = inject(ElementRef<HTMLElement>);
  type = input('button');
  loading = input(false, { transform: booleanAttribute });
  disabled = input(false, { transform: booleanAttribute });
  icon = input('');
  private prime = inject(ButtonDirective);
  constructor() {
    effect(() => {
      this.prime.loading = this.loading();
      this.prime.icon = this.icon();
      this.prime.severity =
        this.variant() === 'danger'
          ? 'danger'
          : this.variant() === 'secondary'
            ? 'secondary'
            : 'primary';
      this.prime.text = this.variant() === 'text';
    });
  }
  variant = input<'primary' | 'secondary' | 'danger' | 'text'>('primary');
  blocked = computed(() => this.disabled() || this.loading());
  buttonType = computed(() =>
    this.element.nativeElement.tagName === 'BUTTON' ? this.type() : null,
  );
  guard(event: Event) {
    if (this.blocked()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
