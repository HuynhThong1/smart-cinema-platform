import { Component, effect, inject, input, output } from '@angular/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { I18n, TranslatePipe } from '@cinema/i18n';
import { CinemaButton } from './button';
@Component({
  selector: 'cinema-state',
  imports: [MessageModule, SkeletonModule, ToastModule, TranslatePipe, CinemaButton],
  providers: [MessageService],
  template: `@if (error()) {
      <p-message severity="error" role="alert"
        >{{ error() }}
        <button cinemaButton (click)="retry.emit()">{{ 'common.retry' | t }}</button></p-message
      >
    }
    @if (busy()) {
      <div aria-busy="true" [attr.aria-label]="'common.loading' | t">
        <p-skeleton height="2rem" /><p-skeleton height="2rem" /><p-skeleton height="2rem" />
      </div>
    }
    <p-toast />`,
})
export class PageState {
  busy = input(false);
  error = input('');
  message = input('');
  retry = output<void>();
  private messages = inject(MessageService);
  constructor() {
    effect(() => {
      const detail = this.message();
      this.messages.clear();
      if (detail) this.messages.add({ severity: 'success', detail, life: 3500 });
    });
  }
}
@Component({
  selector: 'cinema-language',
  imports: [CinemaButton, TranslatePipe],
  template: `<div class="language-switch" role="group" [attr.aria-label]="'common.language' | t">
    <button
      cinemaButton
      [attr.aria-pressed]="i18n.language() === 'vi'"
      (click)="i18n.setLanguage('vi')"
    >
      VI</button
    ><button
      cinemaButton
      [attr.aria-pressed]="i18n.language() === 'en'"
      (click)="i18n.setLanguage('en')"
    >
      EN
    </button>
  </div>`,
})
export class LanguageSwitch {
  i18n = inject(I18n);
}
