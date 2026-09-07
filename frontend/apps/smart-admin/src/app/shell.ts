import { I18n, translatedMessage } from '@cinema/i18n';
import { CinemaButton, LanguageSwitch } from '@cinema/ui';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NotificationBell } from '../../../../libs/feature/src/notifications';
import { Theme } from './theme';
import { Api, Auth, Cinema, Page } from '@cinema/core';
@Component({
  selector: 'cinema-shell',
  host: {
    '(document:click)': 'dismissAccount($event)',
    '(document:keydown.escape)': 'closeAccount(true)',
  },
  imports: [
    LanguageSwitch,
    CinemaButton,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NotificationBell,
  ],
  template: ` <div class="admin-shell">
    <header class="masthead">
      <div>
        <a routerLink="/" class="masthead-title">{{ i18n.t('admin.smart_cinema_platform') }}</a>
        <div class="kicker">{{ i18n.t('admin.galaxy_cinema_transaction_feedback_qr') }}</div>
      </div>
      <div class="utility-rail" [attr.aria-label]="i18n.t('admin.account_utilities')">
        <span class="utility-scope">{{ i18n.t(scopeName()) }}</span>
        <cinema-language /><cinema-notification-bell />
        <details class="account-menu" #accountMenu>
          <summary aria-controls="account-actions">
            <span class="account-identity"
              ><strong>{{ auth.user()?.name }}</strong
              ><span class="english">{{ roleName() }}</span></span
            >
            <span class="account-caret" aria-hidden="true">▾</span>
          </summary>
          <div id="account-actions" class="account-actions">
            <button cinemaButton type="button" (click)="closeAccount(); auth.account()">
              {{ i18n.t('admin.my_account') }}
            </button>
            <button cinemaButton type="button" (click)="closeAccount(); auth.changePassword()">
              {{ i18n.t('admin.change_password') }}
            </button>
            <button
              cinemaButton
              type="button"
              class="theme-toggle"
              role="switch"
              [attr.aria-label]="i18n.t('admin.dark_mode')"
              [attr.aria-checked]="theme.dark()"
              (click)="theme.toggle()"
            >
              <span>{{ i18n.t('admin.dark_mode') }}</span
              ><span class="theme-switch" aria-hidden="true"><span></span></span>
            </button>
            <button
              cinemaButton
              type="button"
              class="account-logout"
              (click)="closeAccount(); auth.logout()"
            >
              {{ i18n.t('admin.sign_out') }}
            </button>
          </div>
        </details>
      </div>
    </header>
    <a class="skip-link" href="#admin-content" (click)="focusContent($event)">{{
      i18n.t('admin.skip_to_main_content')
    }}</a>
    <button
      cinemaButton
      type="button"
      class="secondary mobile-nav-toggle"
      [attr.aria-expanded]="navOpen()"
      aria-controls="admin-navigation"
      (click)="navOpen.set(!navOpen())"
    >
      {{ navOpen() ? i18n.t('admin.close_menu') : i18n.t('admin.navigation_menu') }}
    </button>
    <div class="admin-layout">
      <aside class="sidebar" id="admin-navigation" [class.mobile-open]="navOpen()">
        <div class="kicker">{{ i18n.t('admin.administration_scope') }}</div>
        <strong>{{ roleName() }}</strong>

        <nav [attr.aria-label]="i18n.t('admin.main_navigation')">
          @for (group of groups; track group.title) {
            @if (!group.global || auth.global()) {
              <div class="nav-group">
                <h3>{{ i18n.t(group.title) }}</h3>
                @for (item of group.items; track item.path) {
                  @if (
                    (!item.global || auth.global()) &&
                    (!item.admin || auth.user()?.role === 'SYSTEM_ADMIN')
                  ) {
                    <a
                      [routerLink]="item.path"
                      (click)="navOpen.set(false); closeAccount()"
                      ariaCurrentWhenActive="page"
                      routerLinkActive="active"
                      [routerLinkActiveOptions]="{ exact: true }"
                      >{{ i18n.t(item.label) }}</a
                    >
                  }
                }
              </div>
            }
          }
        </nav>
      </aside>
      <main id="admin-content" #mainContent tabindex="-1"><router-outlet /></main>
    </div>
  </div>`,
})
export class Shell {
  i18n = inject(I18n);
  theme = inject(Theme);
  auth = inject(Auth);
  private api = inject(Api);
  accountMenu = viewChild<ElementRef<HTMLDetailsElement>>('accountMenu');
  mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  focusContent(event: Event) {
    event.preventDefault();
    this.mainContent()?.nativeElement.focus();
  }
  navOpen = signal(false);
  scopeName = signal(this.auth.global() ? 'modules.all_cinemas' : 'modules.assigned_cinema');
  async ngOnInit() {
    try {
      const page = await this.api.get<Page<Cinema>>('/admin/cinemas', { pageSize: 1 });
      this.scopeName.set(
        this.auth.global()
          ? translatedMessage('messages.scope', { count: page.total })
          : page.items[0]?.name || 'modules.assigned_cinema',
      );
    } catch {
      /* Keep a truthful scope label when cinema details are unavailable. */
    }
  }
  closeAccount(restoreFocus = false) {
    const menu = this.accountMenu()?.nativeElement;
    if (!menu?.open) return;
    menu.open = false;
    if (restoreFocus) menu.querySelector('summary')?.focus();
  }
  dismissAccount(event: Event) {
    const menu = this.accountMenu()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) this.closeAccount();
  }
  roleName() {
    return this.i18n.t('common.status.' + (this.auth.user()?.role || 'CINEMA_MANAGER'));
  }
  groups: {
    title: string;
    global?: boolean;
    items: { path: string; label: string; global?: boolean; admin?: boolean }[];
  }[] = [
    {
      title: 'admin.overview',
      items: [
        { path: '/', label: 'admin.modules' },
        { path: '/dashboard', label: 'navigation.dashboard' },
      ],
    },
    {
      title: 'navigation.feedback',
      items: [
        { path: '/feedback', label: 'feedback.all_feedback' },
        { path: '/analytics', label: 'admin.analytics' },
      ],
    },
    {
      title: 'coaching.staff',
      items: [
        { path: '/staff', label: 'staff.staff_list' },
        { path: '/staff/import', label: 'navigation.import' },
        { path: '/qr', label: 'qr.qr_management' },
      ],
    },
    {
      title: 'staff.performance',
      items: [
        { path: '/ranking/staff', label: 'admin.staff_ranking' },
        { path: '/ranking/cinema', label: 'admin.cinema_ranking', global: true },
      ],
    },
    {
      title: 'navigation.coaching',
      items: [{ path: '/coaching', label: 'navigation.coaching_cases' }],
    },
    {
      title: 'notification_rules.notifications',
      items: [
        { path: '/notifications', label: 'notifications.notification_inbox' },
        { path: '/notification-rules', label: 'notification_rules.rules_delivery_channels' },
      ],
    },
    {
      title: 'admin.configuration',
      global: true,
      items: [
        { path: '/rating', label: 'navigation.rating' },
        { path: '/reasons', label: 'config.feedback_reasons' },
      ],
    },
    {
      title: 'notifications.system',
      items: [
        { path: '/cinemas', label: 'dashboard.cinema', global: true },
        { path: '/users', label: 'admin.users', admin: true },
        { path: '/audit', label: 'navigation.audit' },
      ],
    },
  ];
}
@Component({
  imports: [LanguageSwitch, CinemaButton],
  selector: 'cinema-login',
  template: `<main class="login-page">
    <cinema-language />
    <img src="/galaxy-logo.png" width="150" [alt]="i18n.t('qr.galaxy_cinema')" />
    <p class="kicker">{{ i18n.t('admin.smart_cinema_platform_429') }}</p>
    <h1>{{ i18n.t('admin.admin_sign_in') }}</h1>

    <p>{{ i18n.t('admin.use_your_assigned_account_to_manage_feedback_and_service_quality_') }}</p>
    @if (auth.failed()) {
      <p class="error-panel" role="alert">
        {{ i18n.t('admin.unable_to_connect_to_the_sign_in_service_please_retry') }}
      </p>
    }
    <button type="button" cinemaButton class="primary submit" (click)="auth.login()">
      {{ i18n.t('admin.sign_in') }}
    </button>
    <p class="footnote">
      {{ i18n.t('admin.reset_or_change_your_password_on_the_sign_in_screen') }}
    </p>
  </main>`,
})
export class Login {
  i18n = inject(I18n);
  auth = inject(Auth);
}
@Component({
  selector: 'cinema-forbidden',
  imports: [CinemaButton, RouterLink],
  template: `<p class="kicker negative">{{ i18n.t('admin.403_permission_denied') }}</p>
    <h2>{{ i18n.t('admin.you_do_not_have_permission_to_view_this_content') }}</h2>
    <p>{{ i18n.t('admin.contact_your_administrator_to_change_your_access_scope') }}</p>
    <a cinemaButton routerLink="/dashboard" class="secondary">{{
      i18n.t('admin.back_to_dashboard')
    }}</a>`,
})
export class Forbidden {
  i18n = inject(I18n);
}
