"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/lib/supabase/server";
import { assertWritable } from "@/lib/billing/access";
import { envOr } from "@/lib/env-shape";
import type { IdType, TrainingType } from "@/lib/types/database";
import { validateSaId } from "@/lib/validation/sa-id";
import { isIdType } from "@/lib/validation/identification";
import {
  isDocumentKind,
  isIdentityKind,
  type DocumentKind,
} from "@/lib/hr/document-kinds";



const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_BYTES = 15 * 1024 * 1024;

const EXTRACTION_BUCKET = "certificate_extraction";
const EXTRACTION_PER_HOUR = 120;

const READABLE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export interface ExtractedCertificate {
  document_kind: DocumentKind;
  person_surname: string | null;
  person_names: string | null;
  id_number: string | null;
  id_type: IdType | null;
  id_country: string | null;
  training_type: string | null;
  training_date: string | null;
  expiry_date: string | null;
  issuer: string | null;
  certificate_number: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

export interface EmployeeCandidate {
  id: string;
  surname: string;
  names: string;
  id_number: string;
  reason: string;
}

export interface ExtractionDraft {
  extracted: ExtractedCertificate;
  employeeMatch: EmployeeCandidate | null;
  employeeCandidates: EmployeeCandidate[];
  trainingTypeMatch: { id: string; name: string } | null;
  warnings: string[];
}

export type ExtractionResult =
  | { ok: true; draft: ExtractionDraft }
  | { ok: false; error: string };

const TOOL = {
  name: "record_certificate",
  description:
    "Classify the document and record every field read off it. Use null for anything not clearly legible.",
  input_schema: {
    type: "object",
    properties: {
      document_kind: {
        type: "string",
        enum: [
          "training_certificate",
          "medical_certificate",
          "drivers_licence",
          "identity_document",
          "passport",
          "work_permit",
          "asylum_document",
          "other",
        ],
        description:
          "What kind of document this is. identity_document for a South African ID card or book, passport for a passport page, work_permit for a permit, training_certificate for competency or induction training, medical_certificate for a certificate of fitness.",
      },
      person_surname: {
        type: ["string", "null"],
        description: "Family name of the person the certificate belongs to.",
      },
      person_names: {
        type: ["string", "null"],
        description: "Given names or initials as printed.",
      },
      id_number: {
        type: ["string", "null"],
        description:
          "Identity, passport or permit number as printed, digits and letters only.",
      },
      id_type: {
        type: ["string", "null"],
        enum: ["sa_id", "passport", "work_permit", "asylum", "other", null],
        description:
          "sa_id for a 13 digit South African identity number, passport for a passport number, work_permit for a permit.",
      },
      id_country: {
        type: ["string", "null"],
        description: "Two letter country code of the issuing country, ZA, ZW, MZ, MW and so on.",
      },
      training_type: {
        type: ["string", "null"],
        description:
          "The training or competency the certificate is for, as printed, for example WORKING AT HEIGHTS or FIRST AID LEVEL 1.",
      },
      training_date: {
        type: ["string", "null"],
        description:
          "Date the training was completed or the certificate issued, as YYYY-MM-DD.",
      },
      expiry_date: {
        type: ["string", "null"],
        description: "Date the certificate expires or is valid until, as YYYY-MM-DD.",
      },
      issuer: {
        type: ["string", "null"],
        description: "Training provider or issuing body printed on the certificate.",
      },
      certificate_number: {
        type: ["string", "null"],
        description: "Certificate or serial number printed on the document.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "high when the document is a clearly legible certificate, low when it is a poor scan or may not be a certificate at all.",
      },
      notes: {
        type: ["string", "null"],
        description:
          "Anything a human checker should know, for example that the document is not a training certificate or that a date was ambiguous.",
      },
    },
    required: ["document_kind", "confidence"],
  },
} as const;

const PROMPT = `You are reading a scanned document belonging to a worker on a South African industrial or mining site. It could be a training or competency certificate, a certificate of medical fitness, a driving licence, a South African identity document, a passport page, or a work permit.

First decide what kind of document it is, then extract the fields into the record_certificate tool.

Rules that matter here:
- If the document is an identity document, passport, work permit or asylum document, put its number in id_number, its issuing country in id_country, the date it expires in expiry_date, and leave training_type and training_date null. A South African identity document does not expire, so leave expiry_date null for one.
- If the document is a training certificate, a medical certificate or a driving licence, fill training_type, training_date and expiry_date. Fill id_number only if the person's identity number is printed on the certificate itself.
- South African dates are usually written day first. 03/04/2026 means 3 April 2026, not 4 March. If a date is genuinely ambiguous, still give your best reading and say so in notes.
- Many certificates show an issue date and a validity period rather than an expiry date. If it says valid for 2 years from an issue date, calculate the expiry date.
- A South African identity number is exactly 13 digits. Anything else is a passport, permit or other document.
- Workers are commonly Zimbabwean, Mozambican, Malawian, Lesotho or Eswatini nationals on passports or work permits. Do not force a number into the South African format.
- Copy the training name as printed. Do not translate it or tidy it into a category.
- Never invent a value. If a field is not legible or not present, return null for it.
- If the document is none of these things, set document_kind to other, set confidence to low, and say what it actually looks like in notes.`;

function fileExt(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function normaliseName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

function textOrNull(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function scoreTrainingType(extracted: string, candidate: string): number {
  const a = normaliseName(extracted);
  const b = normaliseName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const aTokens = new Set(a.split(" "));
  const bTokens = b.split(" ");
  const shared = bTokens.filter((t) => aTokens.has(t)).length;
  if (shared === 0) return 0;
  return Math.round((shared / Math.max(aTokens.size, bTokens.length)) * 70);
}

async function assertMember(orgId: string): Promise<string | null> {
  if (!orgId) return "Missing workspace.";
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not signed in.";
  const { data: mem } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem || !["owner", "admin"].includes(mem.role)) {
    return "You do not have permission to add certifications in this workspace.";
  }

  const blocked = await assertWritable(orgId);
  if (blocked) return blocked;

  const { data: allowed, error } = await supabase.rpc("consume_rate_limit", {
    p_org: orgId,
    p_bucket: EXTRACTION_BUCKET,
    p_limit: EXTRACTION_PER_HOUR,
    p_window_seconds: 3600,
  });

  // A counter that cannot be read is not a reason to hand out a paid call.
  if (error) return "Could not check the reading limit. Try again shortly.";
  if (allowed === false) {
    return `This workspace has read ${EXTRACTION_PER_HOUR} certificates in the last hour, which is the limit. Add the rest by hand, or try again later.`;
  }

  return null;
}

/**
 * Read a certificate and return a draft for a human to confirm. Nothing is
 * written to the database here. The file is sent to the model, the result is
 * matched against this workspace's employees and training types, and the whole
 * thing comes back as a suggestion.
 */
export async function extractCertificate(
  orgId: string,
  formData: FormData,
): Promise<ExtractionResult> {
  const guard = await assertMember(orgId);
  if (guard) return { ok: false, error: guard };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Certificate reading is not configured. Add ANTHROPIC_API_KEY to the environment.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a certificate to read." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 15 MB." };
  }

  const ext = fileExt(file.name);
  const mediaType = READABLE_TYPES[ext];
  if (!mediaType) {
    return {
      ok: false,
      error:
        ext === "doc" || ext === "docx"
          ? "Word documents cannot be read. Upload the PDF or a photo of the certificate."
          : "Upload a PDF or a photo of the certificate.",
    };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const block =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  let payload: any;
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: envOr("CERTLY_EXTRACTION_MODEL", "claude-sonnet-5"),
        max_tokens: 1500,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 401) {
        return { ok: false, error: "The Anthropic API key was rejected." };
      }
      if (response.status === 429) {
        return { ok: false, error: "Rate limited by the model. Try again in a moment." };
      }
      return {
        ok: false,
        error: `The certificate could not be read (${response.status}). ${detail.slice(0, 160)}`,
      };
    }
    payload = await response.json();
  } catch {
    return { ok: false, error: "Could not reach the model. Check the connection and try again." };
  }

  const toolUse = (payload?.content ?? []).find((c: any) => c?.type === "tool_use");
  if (!toolUse?.input) {
    return { ok: false, error: "The model did not return a readable result. Try a clearer scan." };
  }
  const raw = toolUse.input as Record<string, unknown>;

  const warnings: string[] = [];
  let idNumber = textOrNull(raw.id_number, 30);
  if (idNumber) idNumber = idNumber.replace(/\s+/g, "").toUpperCase();

  let idType: IdType | null = isIdType(raw.id_type) ? raw.id_type : null;
  let idCountry = textOrNull(raw.id_country, 2);

  if (idNumber && /^\d{13}$/.test(idNumber)) {
    const saCheck = validateSaId(idNumber);
    if (saCheck.valid) {
      idType = "sa_id";
      idCountry = "ZA";
    } else {
      warnings.push(
        "The number read is 13 digits but fails the South African ID checksum. Check it against the document.",
      );
      if (!idType) idType = "other";
    }
  } else if (idNumber && idType === "sa_id") {
    warnings.push("The document was read as a South African ID but the number is not 13 digits.");
    idType = "passport";
  }

  const documentKind: DocumentKind = isDocumentKind(raw.document_kind)
    ? raw.document_kind
    : "other";

  if (documentKind === "passport" && !idType) idType = "passport";
  if (documentKind === "work_permit" && !idType) idType = "work_permit";
  if (documentKind === "asylum_document" && !idType) idType = "asylum";
  if (documentKind === "identity_document" && !idType) idType = "sa_id";

  const extracted: ExtractedCertificate = {
    document_kind: documentKind,
    person_surname: textOrNull(raw.person_surname, 120),
    person_names: textOrNull(raw.person_names, 120),
    id_number: idNumber,
    id_type: idType,
    id_country: idCountry ? idCountry.toUpperCase() : null,
    training_type: textOrNull(raw.training_type, 120),
    training_date: isoDate(raw.training_date),
    expiry_date: isoDate(raw.expiry_date),
    issuer: textOrNull(raw.issuer, 160),
    certificate_number: textOrNull(raw.certificate_number, 80),
    confidence:
      raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low",
    notes: textOrNull(raw.notes, 400),
  };

  const isIdentityDoc = isIdentityKind(documentKind);

  if (extracted.confidence === "low") {
    warnings.push("The model was not confident about this document. Check every field.");
  }
  if (documentKind === "other") {
    warnings.push(
      "This does not look like a certificate or an identity document. Check that you uploaded the right file.",
    );
  }
  if (isIdentityDoc && !extracted.id_number) {
    warnings.push("No document number was read. Type it in from the scan.");
  }
  if (isIdentityDoc && documentKind !== "identity_document" && !extracted.expiry_date) {
    warnings.push(
      "No expiry date was read off this document. A lapsed permit stops the person at the gate.",
    );
  }
  if (!isIdentityDoc && !extracted.expiry_date) {
    warnings.push("No expiry date was found. Leave it blank only if this training does not expire.");
  }
  if (
    extracted.training_date &&
    extracted.expiry_date &&
    extracted.expiry_date < extracted.training_date
  ) {
    warnings.push("The expiry date read is before the training date. One of them is wrong.");
  }

  const supabase: any = await createClient();
  const [employeeResult, typeResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, surname, names, id_number")
      .eq("organisation_id", orgId),
    supabase
      .from("training_types")
      .select("*")
      .eq("organisation_id", orgId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const employees = (employeeResult.data ?? []) as Array<{
    id: string;
    surname: string;
    names: string;
    id_number: string;
  }>;
  const types = (typeResult.data ?? []) as TrainingType[];

  let employeeMatch: EmployeeCandidate | null = null;
  const employeeCandidates: EmployeeCandidate[] = [];

  if (extracted.id_number) {
    const hit = employees.find(
      (e) => normaliseName(e.id_number) === normaliseName(extracted.id_number ?? ""),
    );
    if (hit) {
      employeeMatch = { ...hit, reason: "Identification number matches exactly." };
    }
  }

  if (!employeeMatch && extracted.person_surname) {
    const surname = normaliseName(extracted.person_surname);
    const names = normaliseName(extracted.person_names ?? "");
    for (const e of employees) {
      if (normaliseName(e.surname) !== surname) continue;
      const sameNames = names && normaliseName(e.names) === names;
      const candidate: EmployeeCandidate = {
        ...e,
        reason: sameNames ? "Surname and names match." : "Surname matches.",
      };
      if (sameNames && !employeeMatch) employeeMatch = candidate;
      else employeeCandidates.push(candidate);
    }
    if (employeeMatch && employeeMatch.reason !== "Identification number matches exactly.") {
      warnings.push(
        "Matched on name, not on identification number. Confirm this is the same person.",
      );
    }
  }

  let trainingTypeMatch: { id: string; name: string } | null = null;
  if (!isIdentityDoc && extracted.training_type) {
    let best = 0;
    for (const t of types) {
      const score = scoreTrainingType(extracted.training_type, t.name);
      if (score > best) {
        best = score;
        trainingTypeMatch = { id: t.id, name: t.name };
      }
    }
    if (best < 60) trainingTypeMatch = null;
    if (!trainingTypeMatch) {
      warnings.push(
        `No training type in this workspace matches "${extracted.training_type}". Pick one or add it.`,
      );
    }
  }

  return {
    ok: true,
    draft: {
      extracted,
      employeeMatch,
      employeeCandidates: employeeCandidates.slice(0, 5),
      trainingTypeMatch,
      warnings,
    },
  };
}
