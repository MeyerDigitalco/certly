/**
 * Make a photograph small enough to send.
 *
 * A certificate photographed on a modern phone is three to eight megabytes.
 * Server actions cap the request body, and the hosting platform caps it again
 * at four and a half megabytes whatever the framework is told, so a photo
 * straight off a camera is refused before any of our code runs. The person
 * sees a broken screen and has no idea the file was simply too big.
 *
 * Downscaling in the browser removes the problem rather than negotiating with
 * it. Two thousand pixels on the long edge is far more than enough to read a
 * printed certificate, and it turns a six megabyte photo into roughly half a
 * megabyte, which also makes the upload quicker on site and costs less to
 * read.
 *
 * Only raster images are touched. A PDF is returned exactly as it arrived,
 * because re-encoding a document is not ours to do.
 */

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.85;

export function isShrinkable(file: File): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type);
}

export async function shrinkImage(
  file: File,
  maxEdge: number = MAX_EDGE,
): Promise<File> {
  if (!isShrinkable(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);

    if (longest <= maxEdge) {
      bitmap.close();
      return file;
    }

    const scale = maxEdge / longest;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    // If anything went wrong, or the result is somehow no smaller, keep the
    // original. A failed optimisation must never lose the person's file.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renameToJpeg(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function renameToJpeg(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "scan"}.jpg`;
}

/** Human readable size, for telling someone why their file was refused. */
export function describeSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Shrink the file a form is about to send, and refuse one that is still too
 * big with a sentence rather than an error page.
 *
 * Mutates the FormData in place, so a caller that built it from a form
 * element keeps every other field untouched.
 */
export async function prepareUpload(
  form: FormData,
  field: string,
  limitBytes: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const chosen = form.get(field);
  if (!(chosen instanceof File) || chosen.size === 0) return { ok: true };

  const sending = await shrinkImage(chosen);
  if (sending !== chosen) form.set(field, sending);

  if (sending.size > limitBytes) {
    return {
      ok: false,
      error: `That file is ${describeSize(sending.size)}, which is over the ${describeSize(limitBytes)} limit. Photograph the document instead of scanning it, or save the PDF at a lower quality.`,
    };
  }
  return { ok: true };
}
