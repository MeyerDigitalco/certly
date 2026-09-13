/**
 * Tidy a training type name on the way in.
 *
 * Names arrive from three places: typed by hand, read off a scanned
 * certificate, and pulled from an imported spreadsheet. The scanned ones come
 * back as the certificate prints them, which is usually shouting, so a
 * register ends up reading "ENGINEERING HAND TOOLS" next to "Supervise
 * Employees". That looks careless on screen and worse as a column heading in a
 * safety file pack handed to a client.
 *
 * Only all-capitals names are touched, and only when they contain a real word
 * rather than an acronym. "PPE" and "SHE Rep" are left exactly as they are,
 * because title-casing an acronym is a worse error than leaving one shouty
 * name alone. Whitespace is always tidied, because a trailing space is enough
 * to make a duplicate training type nobody can tell apart on screen.
 */

/**
 * Acronyms common on South African safety certificates. Kept upper case even
 * inside a name that is otherwise title-cased.
 */
const ACRONYMS = new Set([
  "SHE",
  "OHS",
  "HIRA",
  "PPE",
  "SANS",
  "MHSA",
  "SAQA",
  "ETQA",
  "NQF",
  "CPR",
  "LMI",
  "ECSA",
  "SHEQ",
  "COID",
  "COIDA",
  "MEWP",
  "LDV",
  "TMM",
  "DMR",
  "GSR",
  "ERT",
  "H2S",
  "LOTO",
  "SWP",
  "SOP",
  "AED",
  "IT",
  "HR",
  "ID",
]);

/** Words that stay lower case inside a title unless they lead it. */
const MINOR = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function titleCaseWord(word: string, isFirst: boolean): string {
  const bare = word.replace(/[^A-Za-z0-9]/g, "");
  if (bare.length > 0 && ACRONYMS.has(bare.toUpperCase())) {
    return word.toUpperCase();
  }

  const lower = word.toLowerCase();
  if (!isFirst && MINOR.has(lower)) return lower;

  // Preserve internal punctuation: "fire-fighting" becomes "Fire-Fighting".
  return lower.replace(
    /(^|[^A-Za-z0-9'])([a-z])/g,
    (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
  );
}

/**
 * True when a name is shouting rather than acronymic: entirely upper case and
 * containing at least one word of five letters or more that is not a known
 * acronym.
 */
export function looksLikeShouting(input: string): boolean {
  const value = collapseWhitespace(input);
  if (value.length === 0) return false;
  if (value !== value.toUpperCase()) return false;
  if (!/[A-Z]/.test(value)) return false;

  return value
    .split(/\s+/)
    .some(
      (word) =>
        word.replace(/[^A-Za-z]/g, "").length >= 5 &&
        !ACRONYMS.has(word.replace(/[^A-Za-z0-9]/g, "").toUpperCase()),
    );
}

export function normaliseTrainingTypeName(input: string): string {
  const value = collapseWhitespace(input);
  if (value.length === 0) return "";
  if (!looksLikeShouting(value)) return value;

  return value
    .split(" ")
    .map((word, i) => titleCaseWord(word, i === 0))
    .join(" ");
}
