import { TransactionField } from './transaction';
import { parseTransaction, validTransaction } from './transaction-parser';
import { TransactionSource } from '@cinema/core';
import { I18n } from '@cinema/i18n';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, FeedbackConfig, errorMessage } from '@cinema/core';
import {
  ReasonChips,
  RatingControl,
  PageState,
  CinemaButton,
  CinemaInput,
  CinemaTextarea,
  CinemaCheckbox,
  LanguageSwitch,
} from '@cinema/ui';
interface Initial {
  config?: FeedbackConfig;
  serverTime?: string;
  error?: 'invalid' | 'error';
}
export const feedbackResolver: ResolveFn<Initial> = async (route) => {
  const api = inject(Api);
  try {
    const [validation, config] = await Promise.all([
      api.get<{ serverTime: string }>(
        '/public/feedback/' + encodeURIComponent(route.paramMap.get('qrToken') || ''),
      ),
      api.get<FeedbackConfig>('/public/feedback-config'),
    ]);
    return { config, serverTime: validation.serverTime };
  } catch (e) {
    return {
      error: e instanceof HttpErrorResponse && e.status === 404 ? 'invalid' : 'error',
    };
  }
};
@Component({
  selector: 'cinema-feedback',
  imports: [
    RouterLink,
    FormsModule,
    TransactionField,
    CinemaButton,
    CinemaInput,
    CinemaTextarea,
    CinemaCheckbox,
    LanguageSwitch,
    ReasonChips,
    RatingControl,
    PageState,
  ],
  templateUrl: './feedback.html',
})
export class FeedbackPage {
  i18n = inject(I18n);
  private route = inject(ActivatedRoute);
  private api = inject(Api);
  initial = this.route.snapshot.data['initial'] as Initial | undefined;
  config = signal(this.initial?.config);
  serverTime = signal(this.initial?.serverTime || '');
  screen = signal<string>(this.initial?.error || (this.initial ? 'form' : 'invalid'));
  rating = signal(0);
  reasons = signal<string[]>([]);
  name = '';
  phone = '';
  transactionId = parseTransaction(this.route.snapshot.queryParamMap.get('tx') || '') || '';
  transactionSource: TransactionSource = validTransaction(this.transactionId)
    ? 'QR_TICKET'
    : 'NONE';
  comment = '';
  consent = false;
  attempted = signal(false);
  submitting = signal(false);
  submitError = signal('');
  recordedAt = signal('');
  localDate = (value: string) => this.i18n.date(value);
  reasonsForRating() {
    return (
      this.config()?.reasons.filter(
        (r) => r.status === 'ACTIVE' && r.ratings.includes(this.rating()),
      ) || []
    );
  }
  reasonOptions() {
    return this.reasonsForRating().map((r) => ({
      code: r.code,
      label: this.i18n.label(r),
      required: r.required,
    }));
  }
  selectRating(value: number) {
    this.rating.set(value);
    this.reasons.set([]);
  }
  toggleReason(code: string) {
    this.reasons.update((v) => (v.includes(code) ? v.filter((x) => x !== code) : [...v, code]));
  }
  nameValid() {
    const n = [...this.name.trim()].length;
    return n >= 2 && n <= 100;
  }
  phoneValid() {
    return /^(0\d{9}|\+?84\d{9})$/.test(this.phone.replace(/[\s().-]/g, ''));
  }
  requiredReasonsValid() {
    return this.reasonsForRating().every((r) => !r.required || this.reasons().includes(r.code));
  }
  async reload() {
    this.screen.set('loading');
    try {
      const token = this.route.snapshot.paramMap.get('qrToken') || '';
      const [validation, config] = await Promise.all([
        this.api.get<{ serverTime: string }>('/public/feedback/' + encodeURIComponent(token)),
        this.api.get<FeedbackConfig>('/public/feedback-config'),
      ]);
      if (this.config()?.consentVersion !== config.consentVersion) this.consent = false;
      if (!config.ratingOptions.some((r) => r.value === this.rating() && r.enabled))
        this.rating.set(0);
      this.reasons.update((values) =>
        values.filter((code) =>
          config.reasons.some(
            (r) => r.code === code && r.status === 'ACTIVE' && r.ratings.includes(this.rating()),
          ),
        ),
      );
      this.config.set(config);
      this.submitError.set('');
      this.serverTime.set(validation.serverTime);
      this.screen.set('form');
    } catch (e) {
      this.screen.set(e instanceof HttpErrorResponse && e.status === 404 ? 'invalid' : 'error');
    }
  }
  async submit() {
    if (this.submitting()) return;
    this.attempted.set(true);
    this.submitError.set('');
    if (
      !this.rating() ||
      !this.nameValid() ||
      !this.phoneValid() ||
      !this.consent ||
      !this.requiredReasonsValid() ||
      this.comment.length > 2000
    )
      return;
    this.submitting.set(true);
    try {
      const result = await this.api.post<{ createdAt: string }>('/public/feedback', {
        qrToken: this.route.snapshot.paramMap.get('qrToken'),
        rating: this.rating(),
        reasons: this.reasons(),
        name: this.name.trim(),
        phone: this.phone,
        comment: this.comment,
        transactionId: validTransaction(this.transactionId) ? this.transactionId : '',
        transactionSource: this.transactionSource,
        consent: this.consent,
        consentVersion: this.config()?.consentVersion,
      });
      this.recordedAt.set(result.createdAt);
      this.screen.set('thanks');
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) this.screen.set('invalid');
      else
        this.submitError.set(
          e instanceof HttpErrorResponse && (e.status === 422 || e.status === 429)
            ? errorMessage(e)
            : 'customer.unable_to_send_feedback_your_answers_have_been_preserved_please_r',
        );
    } finally {
      this.submitting.set(false);
    }
  }
  reset() {
    this.rating.set(0);
    this.reasons.set([]);
    this.name = '';
    this.phone = '';
    this.comment = '';
    this.transactionId = '';
    this.transactionSource = 'NONE';
    this.consent = false;
    this.attempted.set(false);
    this.submitError.set('');
    void this.reload();
  }
}
