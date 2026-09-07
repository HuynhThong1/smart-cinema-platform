import { CinemaBadge, CinemaButton } from '@cinema/ui';
import { translatedMessage } from '@cinema/i18n';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dashboard } from '@cinema/core';
import { AsyncPage, PageState } from './shared';

export interface AppModule {
  code: string;
  title: string;
  description: string;
  phase: string;
  meta: string;
  /** Set once the module ships; an unset route renders the tile disabled. */
  route?: string;
}

/**
 * Registry of every module the platform knows how to render. What a given user
 * sees is intersected with the entitlement list on their token, so a module the
 * account holds no entitlement for is hidden rather than shown locked. Until the
 * API publishes that list the registry stands in for it, which is correct while
 * Phase 1 ships a single module every admin role can reach.
 */
export const MODULES: AppModule[] = [
  {
    code: 'FBQ',
    title: 'modules.transaction_feedback_qr',
    description: 'modules.customer_feedback_staff_qr_codes_ranking_coaching_and_alerts',
    phase: 'modules.phase_1_live',
    meta: '',
    route: '/dashboard',
  },
  {
    code: 'BOX',
    title: 'modules.box_office_showtimes',
    description: 'modules.showtimes_seating_plans_ticket_orders_and_refunds',
    phase: 'navigation.phase2',
    meta: 'modules.expected_q4_2026',
  },
  {
    code: 'FNB',
    title: 'navigation.concession',
    description: 'modules.concession_menu_combos_and_counter_inventory',
    phase: 'navigation.phase2',
    meta: 'modules.expected_q4_2026',
  },
  {
    code: 'CRM',
    title: 'modules.loyalty_crm',
    description: 'modules.membership_tiers_loyalty_points_and_promotional_campaigns',
    phase: 'navigation.phase3',
    meta: 'modules.under_research',
  },
  {
    code: 'WFM',
    title: 'modules.workforce_attendance',
    description: 'modules.shift_scheduling_attendance_and_staff_performance_integration',
    phase: 'navigation.phase3',
    meta: 'modules.under_research',
  },
  {
    code: 'OPS',
    title: 'modules.cinema_operations',
    description: 'modules.opening_closing_checklists_equipment_incidents_and_maintenance',
    phase: 'navigation.phase3',
    meta: 'modules.under_research',
  },
];

@Component({
  selector: 'cinema-modules',
  imports: [CinemaBadge, CinemaButton, RouterLink, PageState],
  template: `<p class="kicker">{{ i18n.t('modules.after_sign_in') }}</p>
    <h2>{{ i18n.t('modules.choose_a_module') }}</h2>

    <p class="muted">
      {{ auth.user()?.name }} · {{ roleName() }} ·
      {{ auth.global() ? i18n.t('modules.all_cinemas') : i18n.t('modules.assigned_cinema') }}
    </p>
    <cinema-state [message]="i18n.t(message())" />
    <div class="module-grid">
      @for (m of modules; track m.code) {
        @if (m.route) {
          <a class="module-card" [routerLink]="m.route">
            <span class="module-head"
              ><span class="kicker">{{ m.code }}</span
              ><cinema-badge class="tag good">{{ i18n.t(m.phase) }}</cinema-badge></span
            >
            <h3>{{ i18n.t(m.title) }}</h3>

            <p class="module-desc">{{ i18n.t(m.description) }}</p>
            <span class="module-meta"
              ><span>{{ i18n.t(todayLabel()) }}</span
              ><span class="module-action" aria-hidden="true">{{
                i18n.t('modules.open_module')
              }}</span></span
            >
          </a>
        } @else {
          <button
            cinemaButton
            type="button"
            class="module-card locked"
            [attr.aria-label]="
              i18n.t(m.title) +
              ' — ' +
              i18n.t(m.phase) +
              i18n.t('modules.not_available_in_this_release')
            "
            (click)="locked(m)"
          >
            <span class="module-head"
              ><span class="kicker">{{ m.code }}</span
              ><cinema-badge class="tag">{{ i18n.t(m.phase) }}</cinema-badge></span
            >
            <h3>{{ i18n.t(m.title) }}</h3>

            <p class="module-desc">{{ i18n.t(m.description) }}</p>
            <span class="module-meta"
              ><span>{{ i18n.t(m.meta) }}</span
              ><span class="module-action">{{ i18n.t('modules.coming_soon') }}</span></span
            >
          </button>
        }
      }
    </div>
    <div class="note-block">
      <p class="muted">
        {{ i18n.t('modules.select_transaction_feedback_qr_to_get_started_the_other_modules_a') }}
      </p>
    </div>`,
})
export class ModuleLauncherPage extends AsyncPage {
  modules = MODULES;
  today = signal<number | null>(null);
  roleName = () => this.i18n.t('common.status.' + (this.auth.user()?.role || 'CINEMA_MANAGER'));
  todayLabel() {
    const count = this.today();
    return count === null ? 'modules.live' : translatedMessage('messages.today', { count });
  }
  async ngOnInit() {
    // The live tile carries a real number rather than a decorative one. A failed
    // lookup falls back to the neutral label instead of blocking the launcher.
    const start = new Date(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()) + 'T00:00:00+07:00',
    );
    try {
      const d = await this.api.get<Dashboard>('/admin/dashboard', {
        from: start.toISOString(),
        to: new Date(start.getTime() + 86400000).toISOString(),
      });
      this.today.set(d.summary[0]?.count ?? 0);
    } catch {
      this.today.set(null);
    }
  }
  locked(m: AppModule) {
    this.notify(translatedMessage('messages.module_locked', { phase: translatedMessage(m.phase) }));
  }
}
