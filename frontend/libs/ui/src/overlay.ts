import {
  Component,
  TemplateRef,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
@Component({
  selector: 'cinema-overlay',
  host: { '(keydown.escape)': 'escape($event)' },
  imports: [DialogModule, DrawerModule, ConfirmDialogModule, NgTemplateOutlet],
  providers: [ConfirmationService],
  template: `<ng-template #body><ng-content /></ng-template>
    @if (variant() === 'confirm') {
      <p-confirmdialog
        appendTo="self"
        [visible]="open()"
        [header]="header()"
        [closable]="!saving()"
        [closeOnEscape]="false"
        [acceptVisible]="false"
        [rejectVisible]="false"
        [style]="{ width: '36rem', maxWidth: 'calc(100vw - 2rem)' }"
        (onHide)="setOpen(false); afterHide()"
        ><ng-template #message><ng-container *ngTemplateOutlet="body" /></ng-template>
        @if (footer()) {
          <ng-template #footer
            ><ng-container *ngTemplateOutlet="this.footer() || null"
          /></ng-template>
        }
      </p-confirmdialog>
    } @else if (variant() === 'drawer') {
      <p-drawer
        appendTo="self"
        [visible]="open()"
        (visibleChange)="setOpen($event)"
        [header]="header()"
        position="right"
        [closable]="!saving()"
        [closeOnEscape]="false"
        [dismissible]="!saving()"
        styleClass="cinema-drawer"
        (onHide)="afterHide()"
        ><ng-container *ngTemplateOutlet="body" />
        @if (footer()) {
          <ng-template #footer
            ><ng-container *ngTemplateOutlet="this.footer() || null"
          /></ng-template>
        }
      </p-drawer>
    } @else {
      <p-dialog
        appendTo="self"
        [visible]="open()"
        (visibleChange)="setOpen($event)"
        [header]="header()"
        [modal]="true"
        [blockScroll]="variant() === 'sheet'"
        [position]="variant() === 'sheet' ? 'bottom' : 'center'"
        [closeAriaLabel]="closeLabel()"
        [maskStyleClass]="variant() === 'sheet' ? 'cinema-sheet-mask' : ''"
        [styleClass]="variant() === 'sheet' ? 'cinema-bottom-sheet' : ''"
        [transitionOptions]="variant() === 'sheet' ? '180ms ease-out' : '150ms ease-out'"
        [closable]="!saving()"
        [closeOnEscape]="false"
        [dismissableMask]="!saving()"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '40rem', maxWidth: 'calc(100vw - 2rem)' }"
        (onHide)="afterHide()"
        ><ng-container *ngTemplateOutlet="body" />
        @if (footer()) {
          <ng-template #footer
            ><ng-container *ngTemplateOutlet="this.footer() || null"
          /></ng-template>
        }
      </p-dialog>
    }`,
})
export class Overlay {
  private document = inject(DOCUMENT);
  private returnFocus: HTMLElement | null = null;
  constructor() {
    effect(() => {
      if (this.open()) this.returnFocus = this.document.activeElement as HTMLElement | null;
    });
  }
  afterHide() {
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.closed.emit();
  }
  footer = contentChild<TemplateRef<unknown>>('footer');
  open = model(false);
  header = input('');
  closeLabel = input<string>();
  variant = input<'modal' | 'drawer' | 'confirm' | 'sheet'>('modal');
  saving = input(false);
  closed = output<void>();
  // PrimeNG binds its Escape listener only when opening. Own this dynamic saving guard.
  escape(event: Event) {
    if (!this.open() || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    if (!this.saving()) this.open.set(false);
  }
  setOpen(value: boolean) {
    if (!this.saving() || value) this.open.set(value);
  }
}
