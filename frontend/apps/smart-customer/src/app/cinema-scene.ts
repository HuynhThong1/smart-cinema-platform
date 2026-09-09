import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CinemaButton } from '@cinema/ui';
import { I18n } from '@cinema/i18n';
import type { CinemaRenderer, SceneState } from './cinema-renderer';

@Component({
  selector: 'cinema-scene',
  host: { '[style.visibility]': "ready() ? 'visible' : 'hidden'" },
  imports: [CinemaButton],
  template: `
    <div
      #surface
      class="scene-surface"
      [attr.aria-label]="i18n.t('landing.map')"
      role="group"
    ></div>
    <div class="scene-markers">
      @for (index of stageIndices; track index) {
        <button
          #marker
          cinemaButton
          variant="text"
          class="scene-marker"
          [class.current]="state().stage === index"
          [class.label-left]="index >= 5"
          [attr.aria-label]="i18n.t(stageKeys[index])"
          [attr.aria-pressed]="state().stage === index"
          (click)="selected.emit(index)"
        >
          <span class="marker-number">{{ index + 1 }}</span>
          <span class="marker-name">{{ i18n.t(stageKeys[index]) }}</span>
        </button>
      }
    </div>
    @if (ready()) {
      <div class="scene-controls">
        <span>{{ i18n.t('landing.drag') }}</span>
        <div>
          <button
            cinemaButton
            variant="text"
            (click)="renderer?.rotate()"
            [attr.aria-label]="i18n.t('landing.rotate')"
          >
            <i class="ph-duotone ph-arrows-clockwise" aria-hidden="true"></i>
          </button>
          <button
            cinemaButton
            variant="text"
            (click)="renderer?.zoom(1)"
            [attr.aria-label]="i18n.t('landing.zoomIn')"
          >
            <i class="ph-duotone ph-plus" aria-hidden="true"></i>
          </button>
          <button
            cinemaButton
            variant="text"
            (click)="renderer?.zoom(-1)"
            [attr.aria-label]="i18n.t('landing.zoomOut')"
          >
            <i class="ph-duotone ph-minus" aria-hidden="true"></i>
          </button>
          <button
            cinemaButton
            variant="text"
            (click)="renderer?.resetCamera()"
            [attr.aria-label]="i18n.t('landing.overview')"
          >
            <i class="ph-duotone ph-corners-out" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .scene-surface {
      position: absolute;
      inset: 0;
    }
    .scene-markers {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .scene-marker.p-button {
      overflow: visible;
      position: absolute;
      top: 0;
      left: 0;
      width: 44px;
      height: 44px;
      padding: 0;
      display: grid;
      place-items: center;
      pointer-events: auto;
      background: transparent;
      border: 0;
    }
    .marker-number {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 1px solid #b4d6f3;
      border-radius: 50%;
      background: #10314f;
      color: white;
      font-size: 15px;
      font-weight: 600;
      line-height: 1;
      box-shadow: 0 2px 7px #05142660;
    }
    .current .marker-number {
      background: #f26b38;
      border-color: #ffe2c9;
      color: #172a3d;
    }
    .marker-name {
      display: none;
      position: absolute;
      bottom: 43px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background: #09263eea;
      color: #fff;
      padding: 4px 9px;
      border-radius: 3px;
      font-size: 13px;
      line-height: 1.4;
    }
    .current .marker-name,
    .scene-marker:hover .marker-name,
    .scene-marker:focus-visible .marker-name {
      display: block;
    }
    .scene-marker.label-left .marker-name {
      left: auto;
      right: 8px;
      transform: none;
    }
    .scene-marker.current,
    .scene-marker:focus-visible {
      z-index: 1;
    }
    .scene-marker:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
      border-radius: 50%;
    }
    .scene-controls {
      position: absolute;
      bottom: 8px;
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      pointer-events: none;
    }
    .scene-controls > span {
      font-size: 12px;
      color: #abc3dd;
      max-width: 210px;
    }
    .scene-controls > div {
      display: flex;
      background: #0e2c48d9;
      border: 1px solid #41607d;
      border-radius: 24px;
      padding: 2px;
      pointer-events: auto;
    }
    .scene-controls .p-button {
      color: #d4e7fa;
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: 50%;
    }
    .scene-controls .p-button:hover {
      background: #254868;
    }
    @media (max-width: 600px) {
      .scene-controls {
        left: 16px;
        right: 16px;
        bottom: 0;
      }
      .scene-controls > span {
        font-size: 11px;
        max-width: 110px;
        min-width: 0;
        flex: 1;
      }
      .scene-controls > div {
        flex-shrink: 0;
      }
    }
  `,
})
export class CinemaScene {
  readonly i18n = inject(I18n);
  readonly state = input.required<SceneState>();
  readonly loaded = output<boolean>();
  readonly selected = output<number>();
  readonly ready = signal(false);
  readonly stageIndices = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly stageKeys = [
    'landing.stage0_name',
    'landing.stage1_name',
    'landing.stage2_name',
    'landing.stage3_name',
    'landing.stage4_name',
    'landing.stage5_name',
    'landing.stage6_name',
    'landing.stage7_name',
  ];
  private readonly markers = viewChildren<ElementRef<HTMLButtonElement>>('marker');
  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly destroy = inject(DestroyRef);
  renderer?: CinemaRenderer;

  constructor() {
    effect(() => {
      const state = this.state();
      const language = this.i18n.language();
      this.renderer?.update(state, language);
    });
    afterNextRender(async () => {
      try {
        const { CinemaRenderer } = await import('./cinema-renderer');
        if (this.destroy.destroyed) return;
        this.renderer = new CinemaRenderer(this.surface().nativeElement, {
          markers: this.markers().map((marker) => marker.nativeElement),
          failed: () => {
            this.ready.set(false);
            this.loaded.emit(false);
          },
        });
        this.renderer.update(this.state(), this.i18n.language());
        this.ready.set(true);
        this.loaded.emit(true);
      } catch {
        // Keep the SSR CSS model usable on devices without WebGL or if the chunk fails.
        this.renderer?.dispose();
        this.loaded.emit(false);
      }
    });
    this.destroy.onDestroy(() => this.renderer?.dispose());
  }
}
