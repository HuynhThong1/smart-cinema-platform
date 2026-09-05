import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Ranking } from '@cinema/core';
import { AsyncPage, Filters, PageState } from './shared';
@Component({
  selector: 'cinema-ranking',
  imports: [DecimalPipe, RouterLink, Filters, PageState],
  template: ` <p class="kicker">Hiệu suất / Ranking</p>
    <h2>Ranking {{ kind === 'cinema' ? 'rạp' : 'nhân viên' }}</h2>
    <p class="english">Consistent service, meaningful recognition</p>
    <cinema-filters (changed)="params = $event; load()" /><cinema-state
      [busy]="busy()"
      [error]="error()"
      (retry)="load()"
    />
    @if (data(); as d) {
      <p class="notice">Cần tối thiểu {{ d.minimumFeedbackForRanking }} feedback để vào ranking.</p>
      <div class="split">
        @for (part of ['top', 'bottom']; track part) {
          <section>
            <h4>{{ part === 'top' ? 'Top' : 'Cần cải thiện' }}</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ kind === 'cinema' ? 'Rạp' : 'Nhân viên' }}</th>
                  <th>Điểm</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                @for (row of part === 'top' ? d.top : d.bottom; track row._id; let i = $index) {
                  <tr>
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
                      {{ row.average | number: '1.2-2' }}
                    </td>
                    <td>{{ row.count }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4">Chưa có dữ liệu đủ điều kiện.</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      </div>
      <section class="section">
        <h4>Chưa đủ điều kiện</h4>
        <table>
          <thead>
            <tr>
              <th>Đơn vị</th>
              <th>Điểm</th>
              <th>Feedback</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of d.ineligible; track row._id) {
              <tr>
                <td>{{ row.unit.code }} · {{ row.unit.name }}</td>
                <td>{{ row.average | number: '1.2-2' }}</td>
                <td>{{ row.count }}</td>
                <td><span class="tag">Not eligible</span></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">Không có dữ liệu.</td>
              </tr>
            }
          </tbody>
        </table>
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
