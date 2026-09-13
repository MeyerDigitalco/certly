import { validateSaId } from "@/lib/validation/sa-id";

export type IdType = "sa_id" | "passport" | "work_permit" | "asylum" | "other";

export const ID_TYPES: Array<{ value: IdType; label: string; hint: string }> = [
  {
    value: "sa_id",
    label: "South African ID",
    hint: "13 digits. The checksum is verified on save.",
  },
  {
    value: "passport",
    label: "Passport",
    hint: "As printed in the passport. Record the passport expiry date too.",
  },
  {
    value: "work_permit",
    label: "Work permit",
    hint: "Permit number. The permit expiry date is a gate blocker, record it.",
  },
  {
    value: "asylum",
    label: "Asylum or refugee document",
    hint: "Document number, plus its expiry date.",
  },
  { value: "other", label: "Other document", hint: "Any other identifying document." },
];

export const ID_COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "ZA", label: "South Africa" },
  { code: "ZW", label: "Zimbabwe" },
  { code: "MZ", label: "Mozambique" },
  { code: "MW", label: "Malawi" },
  { code: "LS", label: "Lesotho" },
  { code: "SZ", label: "Eswatini" },
  { code: "BW", label: "Botswana" },
  { code: "NA", label: "Namibia" },
  { code: "ZM", label: "Zambia" },
  { code: "TZ", label: "Tanzania" },
  { code: "CD", label: "DR Congo" },
  { code: "NG", label: "Nigeria" },
  { code: "GH", label: "Ghana" },
  { code: "ET", label: "Ethiopia" },
  { code: "KE", label: "Kenya" },
  { code: "IN", label: "India" },
  { code: "PK", label: "Pakistan" },
  { code: "BD", label: "Bangladesh" },
  { code: "CN", label: "China" },
  { code: "GB", label: "United Kingdom" },
  { code: "OTHER", label: "Other" },
];

export interface IdCheck {
  valid: boolean;
  reason: string;
  detail?: string;
}

export function isIdType(value: unknown): value is IdType {
  return (
    value === "sa_id" ||
    value === "passport" ||
    value === "work_permit" ||
    value === "asylum" ||
    value === "other"
  );
}

export function idTypeLabel(type: string): string {
  return ID_TYPES.find((t) => t.value === type)?.label ?? "Document";
}

export function countryLabel(code: string | null): string {
  if (!code) return "";
  return ID_COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

export function normaliseIdNumber(type: IdType, input: string): string {
  const raw = (input ?? "").trim();
  if (type === "sa_id") return raw.replace(/\s+/g, "");
  return raw.replace(/\s+/g, " ").toUpperCase();
}

export function validateIdentification(type: IdType, input: string): IdCheck {
  const value = normaliseIdNumber(type, input);

  if (value.length === 0) {
    return { valid: false, reason: "An identification number is required." };
  }

  if (type === "sa_id") {
    const result = validateSaId(value);
    if (!result.valid) {
      return { valid: false, reason: result.reason };
    }
    return {
      valid: true,
      reason: "",
      detail: `Born ${result.dateOfBirth}, ${result.gender === "male" ? "male" : "female"}, ${
        result.citizen ? "citizen" : "permanent resident"
      }.`,
    };
  }

  if (value.length < 5) {
    return { valid: false, reason: "That number looks too short to be a document number." };
  }
  if (value.length > 30) {
    return { valid: false, reason: "That number is too long." };
  }
  if (!/^[A-Z0-9][A-Z0-9 \-/]*$/.test(value)) {
    return {
      valid: false,
      reason: "Use letters, digits, spaces, hyphens and slashes only.",
    };
  }
  return { valid: true, reason: "" };
}
