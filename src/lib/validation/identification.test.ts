import { describe, it, expect } from "vitest";
import { validateSaId } from "./sa-id";
import {
  validateIdentification,
  normaliseIdNumber,
  isIdType,
  idTypeLabel,
  countryLabel,
  ID_COUNTRIES,
} from "./identification";

/**
 * The check digits below were computed with an independent Luhn implementation,
 * not with the code under test, so a regression in sa-id.ts cannot pass by
 * agreeing with itself.
 */
const VALID_SA_IDS = [
  "8001015009087",
  "9204155494080",
  "0112301234087",
  "8506235119086",
];

describe("validateSaId", () => {
  it("accepts thirteen digits with a correct checksum", () => {
    for (const id of VALID_SA_IDS) {
      const result = validateSaId(id);
      expect(result.valid, `${id} should be valid: ${result.reason}`).toBe(true);
    }
  });

  it("rejects a wrong check digit", () => {
    const broken = "8001015009088";
    expect(validateSaId(broken)).toMatchObject({
      valid: false,
      reason: "Checksum failed",
    });
  });

  it("rejects anything that is not thirteen digits", () => {
    for (const bad of ["", "123", "80010150090870", "80010150090A7", "abc"]) {
      expect(validateSaId(bad).valid, `${bad} should be rejected`).toBe(false);
    }
  });

  it("rejects an impossible date of birth", () => {
    expect(validateSaId("8013015009087").valid).toBe(false);
    expect(validateSaId("8002305009087").valid).toBe(false);
  });

  it("ignores whitespace the way a typed ID arrives", () => {
    expect(validateSaId(" 800101 5009 087 ").valid).toBe(true);
  });

  it("reads gender and citizenship out of the number", () => {
    const male = validateSaId("8001015009087");
    expect(male.gender).toBe("male");
    expect(male.citizen).toBe(true);
    expect(male.dateOfBirth).toBe("1980-01-01");
  });
});

describe("normaliseIdNumber", () => {
  it("strips all whitespace from an SA ID", () => {
    expect(normaliseIdNumber("sa_id", " 800101 5009 087 ")).toBe(
      "8001015009087",
    );
  });

  it("upper-cases and collapses spaces in a foreign document number", () => {
    expect(normaliseIdNumber("passport", "  zn  123456  ")).toBe("ZN 123456");
    expect(normaliseIdNumber("work_permit", "wp/2024/0091")).toBe(
      "WP/2024/0091",
    );
  });
});

describe("validateIdentification", () => {
  it("requires a number", () => {
    expect(validateIdentification("sa_id", "   ").valid).toBe(false);
    expect(validateIdentification("passport", "").valid).toBe(false);
  });

  it("applies the SA checksum only to SA IDs", () => {
    expect(validateIdentification("sa_id", "1234567890123").valid).toBe(false);
    expect(validateIdentification("passport", "1234567890123").valid).toBe(true);
  });

  it("accepts the cross-border document numbers this workforce actually carries", () => {
    const numbers = [
      ["passport", "EN123456"],
      ["passport", "AN 998877"],
      ["work_permit", "WP/2026/00412"],
      ["asylum", "ZAF-1234567"],
      ["other", "MW0099123"],
    ] as const;
    for (const [type, number] of numbers) {
      const result = validateIdentification(type, number);
      expect(result.valid, `${number} should be valid: ${result.reason}`).toBe(
        true,
      );
    }
  });

  it("rejects document numbers that are too short, too long or full of punctuation", () => {
    expect(validateIdentification("passport", "AB1").valid).toBe(false);
    expect(validateIdentification("passport", "A".repeat(31)).valid).toBe(false);
    expect(validateIdentification("passport", "AB#123$456").valid).toBe(false);
  });

  it("explains an SA ID rather than only passing it", () => {
    const result = validateIdentification("sa_id", "8001015009087");
    expect(result.valid).toBe(true);
    expect(result.detail).toContain("1980-01-01");
    expect(result.detail).toContain("male");
  });
});

describe("identification lookups", () => {
  it("recognises every stored id type and nothing else", () => {
    for (const type of ["sa_id", "passport", "work_permit", "asylum", "other"]) {
      expect(isIdType(type)).toBe(true);
    }
    for (const bad of ["", "id", null, undefined, 7, {}]) {
      expect(isIdType(bad)).toBe(false);
    }
  });

  it("labels a type it does not know without throwing", () => {
    expect(idTypeLabel("sa_id")).toBe("South African ID");
    expect(idTypeLabel("nonsense")).toBe("Document");
  });

  it("falls back to the raw code for an unknown country", () => {
    expect(countryLabel("ZW")).toBe("Zimbabwe");
    expect(countryLabel("XX")).toBe("XX");
    expect(countryLabel(null)).toBe("");
  });

  it("lists the neighbouring countries this product exists for", () => {
    const codes = ID_COUNTRIES.map((c) => c.code);
    for (const code of ["ZA", "ZW", "MZ", "MW", "LS", "SZ"]) {
      expect(codes).toContain(code);
    }
  });
});
