import { Directive, output } from '@angular/core';
/**
 * Makes a whole table row open its record. Clicks landing on a nested control
 * (the row's own action links and buttons) are left alone so those keep their
 * behaviour, and the row stays keyboard reachable without taking a role that
 * would hide the cells from assistive tech.
 */
@Directive({
  selector: 'tr[rowOpen]',
  host: {
    class: 'row-link',
    tabindex: '0',
    '(click)': 'trigger($event)',
    '(keydown.enter)': 'trigger($event)',
    '(keydown.space)': 'trigger($event)',
  },
})
export class RowLink {
  rowOpen = output<void>();
  trigger(event: Event) {
    if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
    event.preventDefault();
    this.rowOpen.emit();
  }
}
