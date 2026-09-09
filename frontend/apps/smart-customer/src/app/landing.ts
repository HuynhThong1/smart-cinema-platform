import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '@cinema/i18n';
import { CinemaButton, LanguageSwitch } from '@cinema/ui';
import { CinemaScene } from './cinema-scene';

@Component({
  selector: 'cinema-landing',
  imports: [RouterLink, CinemaButton, LanguageSwitch, CinemaScene],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage {
  readonly i18n = inject(I18n);
  readonly stage = signal(0);
  readonly sceneReady = signal(false);
  readonly sceneState = computed(() => ({
    stage: this.stage(),
    seat: this.seat(),
    combo: this.combo(),
    support: this.support(),
    resolved: this.resolved(),
    rating: this.rating(),
    cleaned: this.cleaned(),
    playing: this.playing(),
  }));
  readonly playing = signal(false);
  readonly angle = signal(-32);
  readonly seat = signal('C4');
  readonly combo = signal(1);
  readonly support = signal<number | null>(null);
  readonly resolved = signal(false);
  readonly rating = signal(0);
  readonly cleaned = signal(false);
  readonly rows = ['A', 'B', 'C', 'D'];
  readonly columns = [1, 2, 3, 4, 5, 6];
  readonly choices = ['C3', 'C4', 'C5'];
  readonly stages = [
    { x: 115, y: 335, icon: 'ph-door-open' },
    { x: 55, y: 110, icon: 'ph-ticket' },
    { x: 198, y: 110, icon: 'ph-popcorn' },
    { x: 278, y: 265, icon: 'ph-scan' },
    { x: 435, y: 135, icon: 'ph-film-projector' },
    { x: 535, y: 305, icon: 'ph-hand-heart' },
    { x: 385, y: 345, icon: 'ph-star' },
    { x: 595, y: 230, icon: 'ph-broom' },
  ];
  readonly visitor = computed(() => this.stages[this.stage()]);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pause());
  }

  t(key: string) {
    return this.i18n.t('landing.' + key);
  }
  select(index: number) {
    this.pause();
    this.stage.set(index);
  }
  next() {
    this.pause();
    if (this.stage() === 7) this.reset();
    else this.stage.update((value) => value + 1);
  }
  togglePlayback() {
    if (this.playing()) {
      this.pause();
      return;
    }
    if (this.stage() === 7) this.stage.set(0);
    this.playing.set(true);
    // Start only after an explicit browser interaction, never during SSR.
    this.timer = setInterval(() => {
      this.stage.update((value) => Math.min(7, value + 1));
      if (this.stage() === 7) this.pause();
    }, 5500);
  }
  pause() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.playing.set(false);
  }
  reset() {
    this.pause();
    this.stage.set(0);
    this.seat.set('C4');
    this.combo.set(1);
    this.support.set(null);
    this.resolved.set(false);
    this.rating.set(0);
    this.cleaned.set(false);
    this.angle.set(-32);
  }
  requestSupport(value: number) {
    this.pause();
    this.support.set(value);
    this.resolved.set(false);
  }
}
