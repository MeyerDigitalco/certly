export type UUID = string;

export type Role = "owner" | "admin" | "viewer";
export type Plan = "trial" | "standard";
export type SubscriptionStatus = "none" | "active" | "past_due" | "cancelled";

export interface Organisation {
  id: UUID;
  slug: string;
  name: string;
  logo_url: string | null;
  plan: Plan;
  trial_ends_at: string;
  due_soon_days: number;
  subscription_status: SubscriptionStatus;
  payfast_token: string | null;
  current_period_end: string | null;
  billing_email: string | null;
  billed_seats: number | null;
  billed_amount_cents: number | null;
  subscribed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingEvent {
  id: UUID;
  organisation_id: UUID;
  source: "payfast" | "manual";
  event_type: string;
  pf_payment_id: string | null;
  payfast_token: string | null;
  amount_cents: number | null;
  seats: number | null;
  status: string | null;
  raw: Record<string, unknown> | null;
  at: string;
}
export interface OrgMember {
  organisation_id: UUID;
  user_id: UUID;
  role: Role;
  created_at: string;
}
export interface Profile {
  id: UUID;
  full_name: string | null;
  created_at: string;
}
export type IdType = "sa_id" | "passport" | "work_permit" | "asylum" | "other";

export interface Employee {
  id: UUID;
  organisation_id: UUID;
  surname: string;
  names: string;
  id_number: string;
  id_type: IdType;
  id_country: string | null;
  id_expiry: string | null;
  id_file_path: string | null;
  id_certified_at: string | null;
  site: string | null;
  superior: string | null;
  designation: string | null;
  created_at: string;
  updated_at: string;
}
export type CompanyDocumentCategory =
  | "policy"
  | "registration"
  | "tax"
  | "coida"
  | "insurance"
  | "bbbee"
  | "organogram"
  | "appointment"
  | "procedure"
  | "other";

export interface CompanyDocument {
  id: UUID;
  organisation_id: UUID;
  category: CompanyDocumentCategory;
  title: string;
  file_path: string | null;
  issued_at: string | null;
  expires_at: string | null;
  sort_order: number;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingType {
  id: UUID;
  organisation_id: UUID;
  name: string;
  sort_order: number;
  active: boolean;
}
export interface TrainingTypeWithUsage extends TrainingType {
  certification_count: number;
}
export interface Certification {
  id: UUID;
  organisation_id: UUID;
  employee_id: UUID;
  training_type_id: UUID;
  training_date: string | null;
  expiry_date: string | null;
  cert_file_path: string | null;
  source: "manual" | "extracted";
  extraction_meta: Record<string, unknown> | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}
export interface ExtractionDraft {
  id: UUID;
  organisation_id: UUID;
  status: "pending" | "confirmed" | "discarded";
  file_name: string;
  storage_path: string;
  raw_model_output: Record<string, unknown> | null;
  employee_match_id: UUID | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}
export interface AuditLog {
  id: UUID;
  organisation_id: UUID;
  actor: UUID | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  row_id: UUID | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
}

export type CertStatus = "expired" | "due_soon" | "valid" | "no_expiry";

/**
 * One certification on an employee's detail page, flattened with the name
 * and display order of its training type.
 */
export interface EmployeeCertificationRow {
  id: UUID;
  organisation_id: UUID;
  employee_id: UUID;
  training_type_id: UUID;
  training_type_name: string;
  sort_order: number;
  training_date: string | null;
  expiry_date: string | null;
  cert_file_path: string | null;
  source: "manual" | "extracted";
}

/** A flattened register row: one certification joined to its employee. */
export interface RegisterRow {
  certification_id: UUID;
  employee_id: UUID;
  surname: string;
  names: string;
  id_number: string;
  id_type: IdType;
  site: string | null;
  superior: string | null;
  training_type: string;
  training_date: string | null;
  expiry_date: string | null;
  days_left: number | null;
  status: CertStatus;
}

export interface Database { public: { Tables: Record<string, never> } }
