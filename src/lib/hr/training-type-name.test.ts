import { describe, it, expect } from "vitest";
import {
  normaliseTrainingTypeName,
  looksLikeShouting,
  collapseWhitespace,
} from "./training-type-name";

describe("collapseWhitespace", () => {
  it("trims and collapses, because a trailing space makes an invisible duplicate", () => {
    expect(collapseWhitespace("  Fire  Fighting ")).toBe("Fire Fighting");
    expect(collapseWhitespace("Working\tat\nheights")).toBe(
      "Working at heights",
    );
  });
});

describe("looksLikeShouting", () => {
  it("recognises a certificate printed in capitals", () => {
    expect(looksLikeShouting("ENGINEERING HAND TOOLS")).toBe(true);
    expect(looksLikeShouting("FIRE FIGHTING")).toBe(true);
    expect(looksLikeShouting("WORKING AT HEIGHTS")).toBe(true);
  });

  it("does not treat an acronym as shouting", () => {
    expect(looksLikeShouting("PPE")).toBe(false);
    expect(looksLikeShouting("HIRA")).toBe(false);
    expect(looksLikeShouting("SHE REP")).toBe(false);
    expect(looksLikeShouting("CPR")).toBe(false);
  });

  it("leaves anything already mixed case alone", () => {
    expect(looksLikeShouting("Supervise Employees")).toBe(false);
    expect(looksLikeShouting("working at heights")).toBe(false);
  });

  it("does not throw on empty or symbol-only input", () => {
    expect(looksLikeShouting("")).toBe(false);
    expect(looksLikeShouting("   ")).toBe(false);
    expect(looksLikeShouting("123")).toBe(false);
  });
});

describe("normaliseTrainingTypeName", () => {
  it("calms down a shouted certificate name", () => {
    expect(normaliseTrainingTypeName("ENGINEERING HAND TOOLS")).toBe(
      "Engineering Hand Tools",
    );
    expect(normaliseTrainingTypeName("FIRE FIGHTING")).toBe("Fire Fighting");
    expect(normaliseTrainingTypeName("POWER TOOLS")).toBe("Power Tools");
  });

  it("keeps acronyms upper case inside a name it does title-case", () => {
    expect(normaliseTrainingTypeName("SHE REPRESENTATIVE TRAINING")).toBe(
      "SHE Representative Training",
    );
    expect(normaliseTrainingTypeName("HIRA FACILITATOR COURSE")).toBe(
      "HIRA Facilitator Course",
    );
    expect(normaliseTrainingTypeName("PPE AWARENESS")).toBe("PPE Awareness");
  });

  it("leaves a bare acronym exactly as it is", () => {
    expect(normaliseTrainingTypeName("PPE")).toBe("PPE");
    expect(normaliseTrainingTypeName("CPR")).toBe("CPR");
    expect(normaliseTrainingTypeName("SHE REP")).toBe("SHE REP");
  });

  it("lower-cases joining words but never the first one", () => {
    expect(normaliseTrainingTypeName("WORKING AT HEIGHTS")).toBe(
      "Working at Heights",
    );
    expect(normaliseTrainingTypeName("THE SAFETY OF MACHINES")).toBe(
      "The Safety of Machines",
    );
  });

  it("capitalises across a hyphen", () => {
    expect(normaliseTrainingTypeName("FIRE-FIGHTING REFRESHER")).toBe(
      "Fire-Fighting Refresher",
    );
  });

  it("never touches a name somebody typed themselves", () => {
    expect(normaliseTrainingTypeName("Supervise Employees")).toBe(
      "Supervise Employees",
    );
    expect(normaliseTrainingTypeName("first aid level 1")).toBe(
      "first aid level 1",
    );
    expect(normaliseTrainingTypeName("Working at Heights")).toBe(
      "Working at Heights",
    );
  });

  it("tidies whitespace whatever the case", () => {
    expect(normaliseTrainingTypeName("  Supervise   Employees  ")).toBe(
      "Supervise Employees",
    );
    expect(normaliseTrainingTypeName(" FIRE  FIGHTING ")).toBe("Fire Fighting");
  });

  it("returns empty for empty rather than throwing", () => {
    expect(normaliseTrainingTypeName("")).toBe("");
    expect(normaliseTrainingTypeName("   ")).toBe("");
  });

  it("is stable: normalising twice changes nothing", () => {
    for (const name of [
      "ENGINEERING HAND TOOLS",
      "SHE REPRESENTATIVE TRAINING",
      "PPE",
      "Supervise Employees",
    ]) {
      const once = normaliseTrainingTypeName(name);
      expect(normaliseTrainingTypeName(once)).toBe(once);
    }
  });
});
