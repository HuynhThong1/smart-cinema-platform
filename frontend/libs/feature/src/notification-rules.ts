import { CinemaBadge, CinemaButton, CinemaTable } from '@cinema/ui';
import { I18n } from '@cinema/i18n';
import { inject, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cinema-notification-rules',
  imports: [CinemaBadge, CinemaButton, CinemaTable, RouterLink],
  template: `<p class="kicker">{{ i18n.t('notification_rules.notifications') }}</p>
    <h2>{{ i18n.t('notification_rules.rules_delivery_channels') }}</h2>

    <div class="notice">
      <p>
        {{
          i18n.t(
            'notification_rules.feedback_notifications_are_sent_to_the_staff_member_s_direct_mana'
          )
        }}
      </p>
      <a routerLink="/staff">{{ i18n.t('notification_rules.check_staff_manager_assignments') }}</a>
    </div>
    <section class="section" aria-labelledby="feedback-delivery">
      <h3 id="feedback-delivery">{{ i18n.t('notification_rules.when_new_feedback_arrives') }}</h3>
      <div class="table-wrap">
        <cinema-table [rows]="[true]" [columns]="3"
          ><ng-template #header>
            <tr>
              <th>{{ i18n.t('notification_rules.event') }}</th>
              <th>{{ i18n.t('notification_rules.recipient') }}</th>
              <th>{{ i18n.t('notification_rules.display') }}</th>
            </tr> </ng-template
          ><ng-template #body>
            <tr>
              <td>{{ i18n.t('notification_rules.customer_submits_feedback') }}</td>
              <td>{{ i18n.t('notification_rules.assigned_direct_manager') }}</td>
              <td>{{ i18n.t('notification_rules.notification_in_personal_inbox') }}</td>
            </tr>
            <tr>
              <td>{{ i18n.t('notification_rules.rating_of_1_2') }}</td>
              <td>{{ i18n.t('notification_rules.assigned_direct_manager') }}</td>
              <td>
                {{
                  i18n.t('notification_rules.needs_attention_label_unless_flagged_as_suspicious')
                }}
              </td>
            </tr>
            <tr>
              <td>{{ i18n.t('notification_rules.feedback_flagged_as_suspicious') }}</td>
              <td>{{ i18n.t('notification_rules.assigned_direct_manager') }}</td>
              <td>
                {{
                  i18n.t(
                    'notification_rules.notification_identifying_suspicious_feedback_for_review'
                  )
                }}
              </td>
            </tr>
          </ng-template></cinema-table
        >
      </div>
      <p class="muted section">
        {{
          i18n.t(
            'notification_rules.staff_without_an_assigned_manager_can_still_receive_feedback_but_'
          )
        }}
      </p>
    </section>
    <div class="columns">
      <section>
        <h3>{{ i18n.t('notification_rules.notification_channels') }}</h3>
        <div class="table-wrap">
          <cinema-table [rows]="[true]" [columns]="3"
            ><ng-template #header>
              <tr>
                <th>{{ i18n.t('notification_rules.channel') }}</th>
                <th>{{ i18n.t('notification_rules.availability') }}</th>
                <th>{{ i18n.t('notification_rules.requirements') }}</th>
              </tr> </ng-template
            ><ng-template #body>
              <tr>
                <td>{{ i18n.t('notification_rules.in_app') }}</td>
                <td>
                  <cinema-badge class="tag good">{{
                    i18n.t('notification_rules.supported')
                  }}</cinema-badge>
                </td>
                <td>
                  {{
                    i18n.t(
                      'notification_rules.sign_in_to_view_your_inbox_updates_every_15_seconds_while_the_app'
                    )
                  }}
                </td>
              </tr>
              <tr>
                <td>{{ i18n.t('notification_rules.email') }}</td>
                <td>
                  <cinema-badge class="tag">{{
                    i18n.t('notification_rules.configuration_dependent')
                  }}</cinema-badge>
                </td>
                <td>
                  {{
                    i18n.t(
                      'notification_rules.an_administrator_must_enable_delivery_and_the_manager_must_have_a'
                    )
                  }}
                </td>
              </tr>
              <tr>
                <td>{{ i18n.t('notification_rules.zalo_oa_sms') }}</td>
                <td>
                  <cinema-badge class="tag">{{
                    i18n.t('notification_rules.not_supported')
                  }}</cinema-badge>
                </td>
                <td>
                  {{
                    i18n.t(
                      'notification_rules.delivery_through_these_channels_is_not_yet_available'
                    )
                  }}
                </td>
              </tr>
            </ng-template></cinema-table
          >
        </div>
      </section>
      <section>
        <h3>{{ i18n.t('notification_rules.upcoming_features') }}</h3>
        <p>
          {{
            i18n.t(
              'notification_rules.daily_weekly_reports_coaching_reminders_qr_events_and_consecutive'
            )
          }}
        </p>
        <p class="muted">
          {{
            i18n.t(
              'notification_rules.quiet_hours_and_per_staff_alert_limits_are_not_yet_applied_if_ema'
            )
          }}
        </p>
        <a cinemaButton class="secondary" routerLink="/notifications">{{
          i18n.t('notification_rules.open_notifications')
        }}</a>
      </section>
    </div>`,
})
export class NotificationRulesPage {
  i18n = inject(I18n);
}
