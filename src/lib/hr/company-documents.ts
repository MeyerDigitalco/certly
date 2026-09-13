import type { CompanyDocumentCategory } from "@/lib/types/database";

export const COMPANY_DOCUMENT_CATEGORIES: Array<{
  value: CompanyDocumentCategory;
  label: string;
  hint: string;
}> = [
  {
    value: "policy",
    label: "Health and safety policy",
    hint: "Signed by the chief executive officer, usually reviewed annually.",
  },
  {
    value: "registration",
    label: "Company registration",
    hint: "CIPC registration certificate.",
  },
  { value: "tax", label: "Tax clearance", hint: "SARS pin or clearance certificate." },
  {
    value: "coida",
    label: "COIDA letter of good standing",
    hint: "Compensation Fund letter. Expires, so record the date.",
  },
  {
    value: "insurance",
    label: "Public liability cover",
    hint: "Schedule or certificate of insurance. Expires.",
  },
  { value: "bbbee", label: "BBBEE certificate", hint: "Affidavit or verification certificate." },
  { value: "organogram", label: "Organogram", hint: "Company and site team structure." },
  {
    value: "appointment",
    label: "Statutory appointment",
    hint: "Section 16.2, 8.1, 8.2, 17 and similar. Written and signed by you.",
  },
  {
    value: "procedure",
    label: "Procedure or method statement",
    hint: "Safe work procedures, method statements, emergency plans.",
  },
  { value: "other", label: "Other", hint: "Anything else a client asks for." },
];

export function companyCategoryLabel(value: string): string {
  return (
    COMPANY_DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ??
    "Document"
  );
}

export function isCompanyCategory(
  value: unknown,
): value is CompanyDocumentCategory {
  return (
    typeof value === "string" &&
    COMPANY_DOCUMENT_CATEGORIES.some((c) => c.value === value)
  );
}
