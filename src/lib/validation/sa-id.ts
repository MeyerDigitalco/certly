export interface SaIdResult {
  valid: boolean;
  reason: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  citizen?: boolean;
}
function luhn(id: string): boolean {
  const digits = id.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits[i];
    sum += i % 2 === 0 ? d : (d * 2 > 9 ? d * 2 - 9 : d * 2);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}
export function validateSaId(input: string): SaIdResult {
  const id = (input ?? "").replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: "Must be 13 digits" };
  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  const century = yy <= new Date().getFullYear() % 100 ? 2000 : 1900;
  const year = century + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() + 1 !== mm || dob.getUTCDate() !== dd) {
    return { valid: false, reason: "Invalid date of birth in ID" };
  }
  if (!luhn(id)) return { valid: false, reason: "Checksum failed" };
  const gender = parseInt(id.slice(6, 10), 10) >= 5000 ? "male" : "female";
  const citizen = id[10] === "0";
  return {
    valid: true, reason: "",
    dateOfBirth: dob.toISOString().slice(0, 10),
    gender, citizen,
  };
}
