export type UUID = string;

export type Role = "owner" | "admin" | "viewer";
export type Plan = "trial" | "starter" | "growth" | "scale" | "enterprise";

export interface Organisation {
  id: UUID;
  slug: string;
  name: string;
  logo_url: string | null;
  plan: Plan;
  trial_ends_at: string;
  due_soon_days: number;
  created_at: string;
  updated_at: string;
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
export interface Employee {
  id: UUID;
  organisation_id: UUID;
  surname: string;
  names: string;
  sa_id: string;
  site: string | null;
  superior: string | null;
  designation: string | null;
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
  sa_id: string;
  site: string | null;
  superior: string | null;
  training_type: string;
  training_date: string | null;
  expiry_date: string | null;
  days_left: number | null;
  status: CertStatus;
}

export interface Database { public: { Tables: Record<string, never> } }
