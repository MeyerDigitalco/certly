export type DocumentKind =
  | "training_certificate"
  | "medical_certificate"
  | "drivers_licence"
  | "identity_document"
  | "passport"
  | "work_permit"
  | "asylum_document"
  | "other";

export const DOCUMENT_KINDS: DocumentKind[] = [
  "training_certificate",
  "medical_certificate",
  "drivers_licence",
  "identity_document",
  "passport",
  "work_permit",
  "asylum_document",
  "other",
];

export const IDENTITY_KINDS: DocumentKind[] = [
  "identity_document",
  "passport",
  "work_permit",
  "asylum_document",
];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  training_certificate: "Training certificate",
  medical_certificate: "Medical certificate",
  drivers_licence: "Driving licence",
  identity_document: "Identity document",
  passport: "Passport",
  work_permit: "Work permit",
  asylum_document: "Asylum document",
  other: "Unrecognised document",
};

export function isDocumentKind(value: unknown): value is DocumentKind {
  return (
    typeof value === "string" && DOCUMENT_KINDS.includes(value as DocumentKind)
  );
}

export function isIdentityKind(kind: DocumentKind): boolean {
  return IDENTITY_KINDS.includes(kind);
}
