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
  default_retirement_age: number;
  seta: string | null;
  sdl_number: string | null;
  ee_reference: string | null;
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

export type TerminationReason =
  | "deceased"
  | "retirement"
  | "medical_incapacity"
  | "fixed_term_end"
  | "retrenchment"
  | "resignation"
  | "dismissal"
  | "abscondment";

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
  date_of_birth: string | null;
  engaged_at: string | null;
  retirement_age: number | null;
  approved_retirement_date: string | null;
  terminated_at: string | null;
  termination_reason: TerminationReason | null;
  termination_notes: string | null;
  gender: Gender | null;
  population_group: PopulationGroup | null;
  disability: boolean | null;
  occupational_level: OccupationalLevel | null;
  ofo_code: string | null;
  ee_declared_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Gender = "male" | "female";

export type PopulationGroup = "african" | "coloured" | "indian" | "white";

export type OccupationalLevel =
  | "top_management"
  | "senior_management"
  | "professionally_qualified"
  | "skilled_technical"
  | "semi_skilled"
  | "unskilled";

export type TrainingCategory =
  | "short_course"
  | "skills_programme"
  | "learnership"
  | "apprenticeship"
  | "internship"
  | "bursary"
  | "induction"
  | "other";

export interface TrainingPlan {
  id: UUID;
  organisation_id: UUID;
  training_type_id: UUID;
  seta_year: number;
  site: string;
  planned_count: number;
  planned_cost_cents: number | null;
  notes: string | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export type AbsenceReason =
  | "annual_leave"
  | "sick_leave"
  | "family_responsibility"
  | "study_leave"
  | "unpaid_leave"
  | "absent_without_leave"
  | "injury_on_duty"
  | "other";

export interface Absence {
  id: UUID;
  organisation_id: UUID;
  employee_id: UUID;
  starts_on: string;
  ends_on: string;
  reason: AbsenceReason;
  half_day: boolean;
  notes: string | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface LabourPlan {
  id: UUID;
  organisation_id: UUID;
  site: string;
  designation: string;
  planned: number;
  effective_from: string;
  notes: string | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export type OnboardingStatus =
  | "screening"
  | "medical"
  | "teba"
  | "training"
  | "ready"
  | "engaged"
  | "unfit"
  | "withdrawn";

export type MedicalStatus = "fit" | "unfit" | "pending";

export interface OnboardingCandidate {
  id: UUID;
  organisation_id: UUID;
  surname: string;
  names: string;
  id_number: string | null;
  id_type: IdType;
  designation: string;
  site: string;
  status: OnboardingStatus;
  screening_booked_at: string | null;
  screened_at: string | null;
  medical_booked_at: string | null;
  medical_at: string | null;
  rfac_at: string | null;
  medical_status: MedicalStatus | null;
  medical_review_at: string | null;
  teba_done: boolean;
  training_booked: boolean;
  training_start_at: string | null;
  expected_passout_at: string | null;
  employee_id: UUID | null;
  notes: string | null;
  created_by: UUID | null;
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
  category: TrainingCategory;
  hours: number | null;
  cost_cents: number | null;
  provider: string | null;
  nqf_level: number | null;
  accredited: boolean;
  counts_for_atr: boolean;
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
