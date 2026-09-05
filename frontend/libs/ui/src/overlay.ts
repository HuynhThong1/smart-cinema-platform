import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';
/**
 * Modal surface built on the native <dialog> element so the browser supplies the
 * top layer, the focus trap, background inertness and Escape handling. `variant`
 * only changes where the surface sits: 'modal' centres it, 'drawer' anchors it to
 * the trailing edge.
 */
@Component({
  selector: 'cinema-overlay',
  template: ` <dialog
    #surface
    class="overlay"
    [class.overlay-drawer]="variant() === 'drawer'"
    [attr.aria-label]="header()"
    (close)="open.set(false); closed.emit()"
    (click)="dismissFromBackdrop($event)"
  >
    <header class="overlay-header">
      <h3>{{ header() }}</h3>
      <button type="button" class="overlay-close" aria-label="Đóng" (click)="open.set(false)">
        <i class="ph-duotone ph-x" aria-hidden="true"></i>
      </button>
    </header>
    <div class="overlay-body"><ng-content /></div>
  </dialog>`,
})
export class Overlay {
  open = model(false);
  header = input('');
  variant = input<'modal' | 'drawer'>('modal');
  closed = output<void>();
  private surface = viewChild.required<ElementRef<HTMLDialogElement>>('surface');
  constructor() {
    effect(() => {
      const el = this.surface().nativeElement;
      if (this.open()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
  /** A click landing on the dialog box itself is a click on the backdrop: children cover the rest. */
  dismissFromBackdrop(event: MouseEvent) {
    if (event.target === this.surface().nativeElement) this.open.set(false);
  }
}
