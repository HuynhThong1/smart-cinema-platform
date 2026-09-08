export interface Principal {
  subject: string;
  name: string;
  role: 'SYSTEM_ADMIN' | 'HEAD_OFFICE' | 'CINEMA_MANAGER';
  cinemaId: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Cinema {
  id: string;
  code: string;
  name: string;
  status: string;
  updatedAt: string;
}
export interface Staff {
  managerId?: string;
  id: string;
  staffCode: string;
  name: string;
  cinemaId: string;
  status: string;
  updatedAt: string;
}
export interface Rating {
  value: number;
  label: string;
  english: string;
  icon: string;
  enabled: boolean;
}
export interface Reason {
  id: string;
  code: string;
  label: string;
  english: string;
  type: string;
  ratings: number[];
  required: boolean;
  status: string;
  order: number;
}
export interface FeedbackConfig {
  id: string;
  ratingType: string;
  ratingOptions: Rating[];
  reasons: Reason[];
  minimumFeedbackForRanking: number;
  consentVersion: string;
}
export interface Snapshot {
  id: string;
  code: string;
  name: string;
}
export type TransactionSource = 'QR_TICKET' | 'QR_SCAN' | 'MANUAL' | 'NONE';
export interface Feedback {
  transactionId?: string;
  transactionSource?: TransactionSource;
  transactionVerified?: boolean;
  id: string;
  staff: Snapshot;
  cinema: Snapshot;
  customer: { name: string; phone: string };
  rating: Rating;
  reasons: Reason[];
  comment: string;
  createdAt: string;
  metadata: { suspicious: boolean; ipHash: string };
  consent: { version: string; acceptedAt: string };
}
export interface QR {
  id?: string;
  staffId: string;
  publicToken?: string;
  url?: string;
  status: string;
  updatedAt?: string;
}
export interface Coaching {
  id: string;
  staffId: string;
  cinemaId: string;
  topic: string;
  action: string;
  note: string;
  status: string;
  followUpDate: string;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}
export interface Audit {
  id: string;
  actor: string;
  action: string;
  target: string;
  cinemaId: string;
  createdAt: string;
}
export interface Metric {
  _id: string;
  unit: Snapshot;
  cinema?: Snapshot;
  count: number;
  average: number;
  positive: number;
  neutral: number;
  negative: number;
}
export interface Dashboard {
  latestCoaching?: Coaching;
  beforeCoaching?: Metric[];
  afterCoaching?: Metric[];
  summary: Metric[];
  distribution: { _id: number; count: number }[];
  trend: Metric[];
  hours: { _id: number; count: number }[];
  reasons: { _id: string; label: string; english?: string; type: string; count: number }[];
  staff: Metric[];
  cinemas: Metric[];
  eligible: { count: number }[];
  minimumFeedbackForRanking: number;
}
export interface Ranking {
  top: Metric[];
  bottom: Metric[];
  ineligible: Metric[];
  minimumFeedbackForRanking: number;
}
export interface ImportRow {
  row: number;
  staffCode: string;
  name: string;
  cinemaCode: string;
  managerUsername: string;
  managerId: string;
  error: string;
  errorCode?: string;
}
export interface ImportResult {
  rows: ImportRow[];
  total: number;
  valid: number;
  invalid: number;
  imported: number;
  confirmed: boolean;
}
