import { CinemaBadge, CinemaEmpty, CinemaButton, CinemaTable } from '@cinema/ui';
import { Component, inject, signal } from '@angular/core';
import { CinemaNumberPipe } from '@cinema/i18n';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dashboard, Coaching, Page, download } from '@cinema/core';
import { AsyncPage, Filters, PageState } from './shared';
@Component({
  selector: 'cinema-dashboard',
  imports: [
    CinemaBadge,
    CinemaEmpty,
    CinemaButton,
    CinemaTable,
    CinemaNumberPipe,
    RouterLink,
    Filters,
    PageState,
  ],
  templateUrl: './dashboard.html',
})
export class DashboardPage extends AsyncPage {
  route = inject(ActivatedRoute);
  data = signal<Dashboard | null>(null);
  coaching = signal<Coaching[]>([]);
  staffId = this.route.snapshot.paramMap.get('id') || '';
  params: Record<string, string | boolean> = {};
  coachingMarker() {
    const d = this.data();
    if (!d?.latestCoaching || !d.trend.length) return null;
    const time = new Date(d.latestCoaching.createdAt).getTime();
    const start = new Date(d.trend[0]._id + 'T00:00:00+07:00').getTime();
    const end = new Date(d.trend[d.trend.length - 1]._id + 'T23:59:59+07:00').getTime();
    return time < start || time > end
      ? null
      : 15 + ((time - start) / Math.max(1, end - start)) * 470;
  }
  title() {
    return this.staffId
      ? this.data()?.staff[0]?.unit.name || 'dashboard.staff_performance'
      : this.auth.global()
        ? 'dashboard.system_dashboard'
        : 'dashboard.cinema_dashboard';
  }
  setFilters(p: Record<string, string | boolean>) {
    this.params = { ...p, ...(this.staffId ? { staffId: this.staffId } : {}) };
    void this.load();
  }
  load() {
    return this.run(async (isCurrent) => {
      const result = await this.api.get<Dashboard>('/admin/dashboard', this.params);
      if (!isCurrent()) return;
      this.data.set(result);
      if (this.staffId)
        this.coaching.set(
          (
            await this.api.get<Page<Coaching>>('/admin/coaching', {
              staffId: this.staffId,
            })
          ).items,
        );
    });
  }
  percent(count: number, total: number) {
    return total ? Math.round((count / total) * 100) : 0;
  }
  trendPoints() {
    const t = this.data()?.trend || [];
    const max = Math.max(1, ...t.map((x) => x.count));
    return t
      .map((x, i) => `${15 + (i * 470) / Math.max(1, t.length - 1)},${160 - (x.count / max) * 135}`)
      .join(' ');
  }
  ratingPoints() {
    const t = this.data()?.trend || [];
    return t
      .map((x, i) => `${15 + (i * 470) / Math.max(1, t.length - 1)},${160 - (x.average / 5) * 135}`)
      .join(' ');
  }
  maxReason() {
    return Math.max(1, ...(this.data()?.reasons.map((x) => x.count) || []));
  }
  export() {
    return this.run(async () =>
      download(await this.api.blob('/admin/feedbacks/export', this.params), 'feedback.csv'),
    );
  }
}
