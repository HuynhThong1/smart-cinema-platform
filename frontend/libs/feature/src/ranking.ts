import { CinemaBadge, CinemaTable } from '@cinema/ui';
import { Component, inject, signal } from '@angular/core';
import { CinemaNumberPipe } from '@cinema/i18n';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Ranking } from '@cinema/core';
import { AsyncPage, Filters, PageState } from './shared';
@Component({
  selector: 'cinema-ranking',
  imports: [CinemaBadge, CinemaTable, CinemaNumberPipe, RouterLink, Filters, PageState],
  template: ` <p class="kicker">{{ i18n.t('ranking.performance_ranking') }}</p>
    <h2>
      {{
        i18n.t('ranking.p0_ranking', {
          p0: kind === 'cinema' ? i18n.t('ranking.cinema') : i18n.t('ranking.staff'),
        })
      }}
    </h2>

    <cinema-filters (changed)="params = $event; load()" /><cinema-state
      [busy]="busy()"
      [error]="i18n.t(error())"
      (retry)="load()"
    />
    @if (data(); as d) {
      <p class="notice">
        {{
          i18n.t('ranking.at_least_p0_feedback_entries_are_required_for_ranking', {
            p0: d.minimumFeedbackForRanking,
          })
        }}
      </p>
      <div class="split">
        @for (part of ['top', 'bottom']; track part) {
          <section>
            <h4>
              {{
                part === 'top'
                  ? i18n.t('navigation.top')
                  : i18n.t('dashboard.needs_improvement_120')
              }}
            </h4>
            <cinema-table [rows]="part === 'top' ? d.top : d.bottom" [columns]="4"
              ><ng-template #header>
                <tr>
                  <th>#</th>
                  <th>
                    {{ kind === 'cinema' ? i18n.t('dashboard.cinema') : i18n.t('coaching.staff') }}
                  </th>
                  <th>{{ i18n.t('dashboard.rating') }}</th>
                  <th>{{ i18n.t('dashboard.feedback_124') }}</th>
                </tr> </ng-template
              ><ng-template #body let-row let-i="index"
                ><tr>
                  <td>{{ i + 1 }}</td>
                  <td>
                    @if (kind === 'staff') {
                      <a [routerLink]="['/staff', row._id, 'performance']">{{ row.unit.name }}</a>
                    } @else {
                      <a routerLink="/feedback" [queryParams]="{ cinemaId: row._id }">{{
                        row.unit.name
                      }}</a>
                    }
                    <small>{{ row.unit.code }}</small>
                  </td>
                  <td [class.negative]="part === 'bottom'">
                    {{ row.average | cinemaNumber: '1.2-2' }}
                  </td>
                  <td>{{ row.count }}</td>
                </tr></ng-template
              ><ng-template #empty
                ><tr>
                  <td colspan="4">{{ i18n.t('ranking.no_eligible_data_yet') }}</td>
                </tr></ng-template
              ></cinema-table
            >
          </section>
        }
      </div>
      <section class="section">
        <h4>{{ i18n.t('ranking.not_yet_eligible') }}</h4>
        <cinema-table [rows]="d.ineligible" [columns]="4"
          ><ng-template #header>
            <tr>
              <th>{{ i18n.t('ranking.unit') }}</th>
              <th>{{ i18n.t('dashboard.rating') }}</th>
              <th>{{ i18n.t('dashboard.feedback_124') }}</th>
              <th></th>
            </tr> </ng-template
          ><ng-template #body let-row
            ><tr>
              <td>{{ row.unit.code }} · {{ row.unit.name }}</td>
              <td>{{ row.average | cinemaNumber: '1.2-2' }}</td>
              <td>{{ row.count }}</td>
              <td>
                <cinema-badge class="tag">{{ i18n.t('ranking.not_eligible') }}</cinema-badge>
              </td>
            </tr></ng-template
          ><ng-template #empty
            ><tr>
              <td colspan="4">{{ i18n.t('ranking.no_data') }}</td>
            </tr></ng-template
          ></cinema-table
        >
      </section>
    }`,
})
export class RankingPage extends AsyncPage {
  route = inject(ActivatedRoute);
  kind = this.route.snapshot.paramMap.get('kind') || 'staff';
  data = signal<Ranking | null>(null);
  params: Record<string, string | boolean> = {};
  ngOnInit() {
    this.route.paramMap.subscribe((p) => {
      this.kind = p.get('kind') || 'staff';
      void this.load();
    });
  }
  load() {
    return this.run(async () =>
      this.data.set(
        await this.api.get<Ranking>('/admin/dashboard/ranking', {
          ...this.params,
          kind: this.kind,
        }),
      ),
    );
  }
}
