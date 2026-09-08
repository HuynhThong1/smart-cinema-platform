import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, TransactionSource } from '@cinema/core';
import { I18n } from '@cinema/i18n';
import { CinemaButton, CinemaInput } from '@cinema/ui';
import { TransactionHelp } from './transaction-help';
import { parseTransaction, validTransaction } from './transaction-parser';

@Component({
  selector: 'cinema-transaction',
  imports: [FormsModule, CinemaButton, CinemaInput, TransactionHelp],
  template: `
    <section class="transaction-field" aria-labelledby="transaction-label">
      <div class="transaction-label-row">
        <h2 id="transaction-label" class="question">{{ i18n.t('transaction.label') }}</h2>
        <button
          cinemaButton
          type="button"
          class="transaction-help-button"
          [attr.aria-label]="i18n.t('transaction.whichQr')"
          aria-haspopup="dialog"
          [attr.aria-expanded]="helpOpen()"
          (click)="openHelp()"
        >
          ?
        </button>
      </div>
      <cinema-transaction-help [(open)]="helpOpen" />
      <p class="muted">{{ i18n.t('transaction.optional') }}</p>
      @if (mode() === 'idle') {
        <button cinemaButton type="button" class="secondary" (click)="scan()">
          {{ i18n.t('transaction.scan') }}
        </button>
        <p class="divider">{{ i18n.t('transaction.or') }}</p>
        <button cinemaButton type="button" class="text-button" (click)="manual()">
          {{ i18n.t('transaction.manual') }}
        </button>
      }
      @if (mode() === 'scanning') {
        <div class="scanner">
          <video
            #video
            autoplay
            muted
            playsinline
            [attr.aria-label]="i18n.t('transaction.point')"
          ></video>
          <p>{{ i18n.t('transaction.point') }}</p>
          <button cinemaButton type="button" class="text-button" (click)="manual()">
            {{ i18n.t('transaction.fallback') }}
          </button>
        </div>
      }
      @if (mode() === 'manual') {
        <label for="transaction-id">{{ i18n.t('transaction.label') }}</label>
        <input
          #manualInput
          cinemaInput
          id="transaction-id"
          name="transactionId"
          [ngModel]="value()"
          (ngModelChange)="change($event)"
          inputmode="text"
          autocomplete="off"
          maxlength="32"
          placeholder="01313035/0002"
          aria-describedby="transaction-help transaction-status"
          [attr.aria-invalid]="!!value() && !valid(value())"
        />
        <p id="transaction-help" class="muted">{{ i18n.t('transaction.help') }}</p>
        <button cinemaButton type="button" class="text-button" (click)="scan()">
          {{ i18n.t('transaction.scanInstead') }}
        </button>
      }
      @if (mode() === 'captured') {
        <div class="captured">
          <strong>{{ i18n.t('transaction.captured') }}</strong>
          <p>
            Trans No <strong>{{ value() }}</strong>
          </p>
          <button cinemaButton type="button" class="text-button" (click)="clear()">
            {{ i18n.t('transaction.change') }}
          </button>
        </div>
      }
      <p id="transaction-status" role="status" [class.field-error]="!!value() && !valid(value())">
        {{ i18n.t(message()) }}
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .transaction-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .transaction-label-row h2 {
        margin: 0;
      }
      .transaction-help-button {
        min-width: 44px;
        min-height: 44px;
        border-radius: 50%;
        background: #eaf1fa;
        border: 1px solid #9dbde4;
        color: #02458f;
        padding: 0;
      }
      .transaction-help-button:hover {
        background: #cbdcf1;
      }
      .transaction-field {
        margin: 0;
      }
      .transaction-field > button,
      input {
        width: 100%;
        min-height: 46px;
      }
      input {
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
      }
      .muted,
      #transaction-status {
        font-size: 13px;
      }
      .divider {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #6b7280;
      }
      .divider::before,
      .divider::after {
        content: '';
        height: 1px;
        background: #e5e7eb;
        flex: 1;
      }
      .scanner {
        background: #f5f5f5;
        padding: 16px;
        text-align: center;
      }
      video {
        display: block;
        width: 100%;
        max-height: 260px;
        object-fit: cover;
      }
      .captured {
        padding: 14px 16px;
        border: 1px solid #9dbde4;
        background: #eaf1fa;
        color: #02458f;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class TransactionField {
  i18n = inject(I18n);
  private api = inject(Api);
  initial = input('');
  changed = output<{ id: string; source: TransactionSource }>();
  helpOpen = signal(false);
  openHelp() {
    if (this.mode() === 'scanning') {
      this.stop();
      this.mode.set('idle');
    }
    this.helpOpen.set(true);
  }
  value = signal('');
  mode = signal<'idle' | 'manual' | 'scanning' | 'captured'>('idle');
  message = signal('');
  valid = validTransaction;
  video = viewChild<ElementRef<HTMLVideoElement>>('video');
  manualInput = viewChild<ElementRef<HTMLInputElement>>('manualInput');
  private stream?: MediaStream;
  private generation = 0;
  private lookup = 0;
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      ++this.lookup;
      clearTimeout(this.timer);
    });
    afterNextRender(() => {
      if (this.initial()) {
        this.value.set(this.initial());
        this.mode.set(validTransaction(this.initial()) ? 'captured' : 'manual');
        if (validTransaction(this.initial())) void this.resolve(this.initial());
        else this.message.set('transaction.invalid');
      }
      const hide = () => {
        if (document.hidden && this.mode() === 'scanning') this.manual(false);
      };
      const leave = () => this.stop();
      document.addEventListener('visibilitychange', hide);
      window.addEventListener('pagehide', leave);
      this.cleanup = () => {
        document.removeEventListener('visibilitychange', hide);
        window.removeEventListener('pagehide', leave);
      };
    });
    inject(DestroyRef).onDestroy(() => this.cleanup?.());
  }
  private cleanup?: () => void;
  private stop() {
    ++this.generation;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
  manual(focus = true) {
    this.stop();
    this.mode.set('manual');
    if (focus) setTimeout(() => this.manualInput()?.nativeElement.focus());
  }
  clear() {
    this.stop();
    ++this.lookup;
    clearTimeout(this.timer);
    this.value.set('');
    this.message.set('');
    this.mode.set('idle');
    this.changed.emit({ id: '', source: 'NONE' });
  }
  change(raw: string) {
    ++this.lookup;
    clearTimeout(this.timer);
    const id = raw.trim();
    this.value.set(id);
    this.changed.emit({
      id: validTransaction(id) ? id : '',
      source: validTransaction(id) ? 'MANUAL' : 'NONE',
    });
    this.message.set(id && !validTransaction(id) ? 'transaction.invalid' : '');
    if (validTransaction(id)) this.timer = setTimeout(() => void this.resolve(id), 500);
  }
  private async resolve(id: string) {
    const request = ++this.lookup;
    this.message.set('transaction.checking');
    try {
      await this.api.get('/public/transaction/' + encodeURIComponent(id));
      if (request === this.lookup) this.message.set('transaction.unverified');
    } catch {
      if (request === this.lookup) this.message.set('transaction.unavailable');
    }
  }
  async scan() {
    this.stop();
    ++this.lookup;
    clearTimeout(this.timer);
    const generation = this.generation;
    this.message.set('');
    this.mode.set('scanning');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const video = this.video()?.nativeElement;
      if (!video) throw new Error('video unavailable');
      video.srcObject = stream;
      await video.play();
      const { default: jsQR } = await import('jsqr');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('canvas unavailable');
      const read = async () => {
        if (generation !== this.generation) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = Math.min(video.videoWidth, 640);
            canvas.height = Math.round((video.videoHeight * canvas.width) / video.videoWidth);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsQR(frame.data, frame.width, frame.height);
            if (hit) {
              const id = parseTransaction(hit.data);
              if (id) {
                this.stop();
                this.value.set(id);
                this.mode.set('captured');
                this.changed.emit({ id, source: 'QR_SCAN' });
                void this.resolve(id);
                return;
              }
              this.message.set('transaction.wrongQr');
            }
          }
          setTimeout(() => void read(), 200);
        } catch {
          this.manual();
          this.message.set('transaction.camera');
        }
      };
      void read();
    } catch {
      if (generation !== this.generation) return;
      this.manual();
      this.message.set('transaction.camera');
    }
  }
}
