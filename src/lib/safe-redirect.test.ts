import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeRedirectPath("/acme/hr")).toBe("/acme/hr");
    expect(safeRedirectPath("/acme/hr/employees?site=Impala")).toBe(
      "/acme/hr/employees?site=Impala",
    );
    expect(safeRedirectPath("/set-password?change=1")).toBe(
      "/set-password?change=1",
    );
  });

  it("falls back when nothing is supplied", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
    expect(safeRedirectPath("   ")).toBe("/");
  });

  it("refuses absolute URLs", () => {
    expect(safeRedirectPath("https://evil.example/steal")).toBe("/");
    expect(safeRedirectPath("http://evil.example")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath("data:text/html,<script>")).toBe("/");
  });

  it("refuses protocol-relative and backslash variants", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath("\\\\evil.example")).toBe("/");
  });

  it("refuses control characters browsers strip before parsing", () => {
    expect(safeRedirectPath("/\thttps://evil.example")).toBe("/");
    expect(safeRedirectPath("/\nhttps://evil.example")).toBe("/");
    expect(safeRedirectPath("/\rfoo")).toBe("/");
  });

  it("refuses absurdly long values", () => {
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBe("/");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeRedirectPath("https://evil.example", "")).toBe("");
    expect(safeRedirectPath(null, "/login")).toBe("/login");
  });
});
