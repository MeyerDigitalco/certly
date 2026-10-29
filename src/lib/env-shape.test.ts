import { describe, it, expect, afterEach } from "vitest";
import { describeEnv, envShape } from "./env-shape";

const NAME = "CERTLY_TEST_SHAPE_VAR";
const OTHER = "CERTLY_TEST_SHAPE_OTHER";

afterEach(() => {
  delete process.env[NAME];
  delete process.env[OTHER];
});

describe("envShape", () => {
  it("tells an unset variable from one set to nothing", () => {
    // This is the whole point. In a hosting dashboard these look identical,
    // and from inside the app they used to be indistinguishable too.
    delete process.env[NAME];
    expect(envShape(NAME)).toBe("absent");

    process.env[NAME] = "";
    expect(envShape(NAME)).toBe("blank");
  });

  it("reports whitespace-only values as blank, with the length", () => {
    process.env[NAME] = "   ";
    expect(envShape(NAME)).toBe("blank (3 characters of whitespace)");
  });

  it("reports a length for a real value", () => {
    process.env[NAME] = "abcdef";
    expect(envShape(NAME)).toBe("6 characters");
  });

  it("flags padding, which is what a dashboard paste adds", () => {
    process.env[NAME] = " abcdef\n";
    expect(envShape(NAME)).toBe("6 characters (plus 2 of whitespace)");
  });

  it("never includes the value itself", () => {
    process.env[NAME] = "super-secret-token";
    expect(envShape(NAME)).not.toContain("super");
    expect(envShape(NAME)).not.toContain("token");
  });
});

describe("describeEnv", () => {
  it("names each variable alongside its shape", () => {
    process.env[NAME] = "abcdef";
    process.env[OTHER] = "";
    expect(describeEnv([NAME, OTHER])).toBe(
      `${NAME}=6 characters ${OTHER}=blank`,
    );
  });

  it("handles an empty list", () => {
    expect(describeEnv([])).toBe("");
  });
});
