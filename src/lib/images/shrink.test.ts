import { describe, it, expect } from "vitest";
import { isShrinkable, describeSize, MAX_EDGE } from "./shrink";
import { UPLOAD_LIMIT_BYTES } from "./limits";

function file(name: string, type: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("isShrinkable", () => {
  it("accepts the raster formats a camera produces", () => {
    expect(isShrinkable(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(isShrinkable(file("a.png", "image/png"))).toBe(true);
    expect(isShrinkable(file("a.webp", "image/webp"))).toBe(true);
  });

  it("leaves a PDF alone, because re-encoding a document is not ours to do", () => {
    expect(isShrinkable(file("a.pdf", "application/pdf"))).toBe(false);
  });

  it("leaves anything it does not recognise alone", () => {
    expect(isShrinkable(file("a.gif", "image/gif"))).toBe(false);
    expect(isShrinkable(file("a.heic", "image/heic"))).toBe(false);
    expect(isShrinkable(file("a.txt", ""))).toBe(false);
  });
});

describe("describeSize", () => {
  it("reads in megabytes once a file is big enough to matter", () => {
    expect(describeSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(describeSize(6 * 1024 * 1024)).toBe("6.0 MB");
  });

  it("reads in kilobytes below that", () => {
    expect(describeSize(512 * 1024)).toBe("512 KB");
    expect(describeSize(1024)).toBe("1 KB");
  });

  it("never says zero, which reads like nothing was chosen", () => {
    expect(describeSize(0)).toBe("1 KB");
    expect(describeSize(10)).toBe("1 KB");
  });
});

describe("the upload limit", () => {
  it("leaves room under the platform cap for multipart overhead", () => {
    // Vercel refuses a request body over roughly 4.5 MB whatever Next is
    // configured to allow, and multipart adds boundaries and headers on top
    // of the file. A file that passes this check must not be refused higher
    // up, where the person would get an error page instead of a sentence.
    expect(UPLOAD_LIMIT_BYTES).toBeLessThan(4 * 1024 * 1024);
  });

  it("is still large enough for a shrunk photograph", () => {
    // 2000px on the long edge at JPEG quality 0.85 lands well under a
    // megabyte, so the limit is never the binding constraint for a photo.
    expect(UPLOAD_LIMIT_BYTES).toBeGreaterThan(1024 * 1024);
    expect(MAX_EDGE).toBe(2000);
  });
});
