import { Component, inject, model } from '@angular/core';
import { I18n } from '@cinema/i18n';
import { CinemaButton, Overlay } from '@cinema/ui';

@Component({
  selector: 'cinema-transaction-help',
  imports: [CinemaButton, Overlay],
  template: `
    <cinema-overlay
      variant="sheet"
      [closeLabel]="i18n.t('common.close')"
      [(open)]="open"
      [header]="i18n.t('transaction.whichQr')"
    >
      <div
        class="sheet-grip"
        (pointerdown)="startDrag($event)"
        (pointerup)="endDrag($event)"
        (pointercancel)="dragStart = null"
        aria-hidden="true"
      >
        <span></span>
      </div>
      <div class="help-content">
        <p class="kicker">{{ i18n.t('transaction.twoCodes') }}</p>
        <h2>{{ i18n.t('transaction.scanNumber') }} <strong>1</strong></h2>
        <div class="ticket" aria-hidden="true">
          <strong>{{ i18n.t('transaction.ticketCinema') }}</strong
          ><br />{{ i18n.t('transaction.ticketType') }}
          <hr />
          {{ i18n.t('transaction.ticketMovie') }}<br />{{ i18n.t('transaction.ticketExample') }}
          <hr />
          {{ i18n.t('transaction.ticketTransaction') }}<br />{{ i18n.t('transaction.ticketTime') }}
          <div class="qr-block correct">
            <span class="number">1</span>
            <div class="fake-qr"><i></i><i></i><i></i></div>
          </div>
          <b>{{ i18n.t('transaction.scanThis') }}</b>
          <p>{{ i18n.t('transaction.ticketEntryInstruction') }}</p>
          <hr />
          {{ i18n.t('transaction.ticketFeedbackInstruction') }}
          <div class="qr-block incorrect">
            <span class="number">2</span>
            <div class="fake-qr"><i></i><i></i><i></i></div>
          </div>
          {{ i18n.t('transaction.notThis') }}
        </div>
        <ol>
          <li>
            <strong>{{ i18n.t('transaction.middleQr') }}</strong>
          </li>
          <li class="muted">{{ i18n.t('transaction.bottomQr') }}</li>
        </ol>
        <p class="skip">{{ i18n.t('transaction.noTicket') }}</p>
        <button cinemaButton type="button" class="primary understood" (click)="open.set(false)">
          {{ i18n.t('transaction.understood') }}
        </button>
      </div>
    </cinema-overlay>
  `,
  styles: [
    `
      .sheet-grip {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 28px;
        touch-action: none;
        cursor: grab;
      }
      .sheet-grip span {
        width: 38px;
        height: 4px;
        border-radius: 2px;
        background: #d1d5db;
      }
      .help-content {
        max-width: 440px;
        margin: auto;
      }
      h2 {
        margin: 4px 0 16px;
      }
      h2 strong {
        color: #02458f;
      }
      .ticket {
        width: 146px;
        padding: 10px 6px;
        margin: 0 auto 18px;
        border: 1px solid #e5e7eb;
        background: #fff;
        color: #1f2937;
        font: 7px/1.6 monospace;
        text-align: center;
      }
      hr {
        border: 0;
        border-top: 1px dashed #d1d5db;
        margin: 7px 0;
      }
      .qr-block {
        position: relative;
        width: fit-content;
        margin: 8px auto 4px;
        padding: 5px;
      }
      .correct {
        border: 2px solid #034ea2;
        background: #eaf1fa;
      }
      .incorrect {
        opacity: 0.45;
      }
      .number {
        position: absolute;
        z-index: 1;
        top: -7px;
        left: -13px;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        background: #034ea2;
        color: white;
        font: bold 13px/20px serif;
      }
      .incorrect .number {
        background: #6b7280;
      }
      .fake-qr {
        width: 48px;
        height: 48px;
        position: relative;
        background: repeating-conic-gradient(#1f2937 0% 25%, white 0% 50%) 0 0/8px 8px;
      }
      .fake-qr i {
        position: absolute;
        width: 14px;
        height: 14px;
        border: 3px solid #1f2937;
        box-shadow: inset 0 0 0 2px white;
        background: #1f2937;
      }
      .fake-qr i:nth-child(1) {
        top: 0;
        left: 0;
      }
      .fake-qr i:nth-child(2) {
        top: 0;
        right: 0;
      }
      .fake-qr i:nth-child(3) {
        bottom: 0;
        left: 0;
      }
      ol {
        list-style: decimal;
        padding-left: 24px;
        font-size: 14px;
      }
      li {
        padding-left: 4px;
        margin: 10px 0;
      }
      li::marker {
        color: #034ea2;
        font-weight: bold;
      }
      .skip {
        border-top: 1px solid #e5e7eb;
        padding-top: 14px;
        font-size: 13px;
      }
      .understood {
        width: 100%;
        min-height: 46px;
      }
    `,
  ],
})
export class TransactionHelp {
  i18n = inject(I18n);
  open = model(false);
  dragStart: { y: number; height: number; pointer: number } | null = null;
  startDrag(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    this.dragStart = {
      y: event.clientY,
      height: handle.closest('[role="dialog"]')?.getBoundingClientRect().height || innerHeight,
      pointer: event.pointerId,
    };
    handle.setPointerCapture(event.pointerId);
  }
  endDrag(event: PointerEvent) {
    if (
      this.dragStart?.pointer === event.pointerId &&
      event.clientY - this.dragStart.y > this.dragStart.height * 0.4
    )
      this.open.set(false);
    this.dragStart = null;
  }
}
