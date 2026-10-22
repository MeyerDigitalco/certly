"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password field with a show and hide control.
 *
 * Hiding what you type helps nobody filling in a form on a phone at a gate,
 * and a mistyped password they cannot see is the most common reason a person
 * gives up on a sign-in. The toggle starts hidden, never persists, and is
 * marked aria-pressed so a screen reader announces the state rather than
 * just the icon.
 */
export default function PasswordInput({
  name,
  autoComplete,
  required,
  invalid,
  placeholder,
  minLength,
}: {
  name: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();

  return (
    <div className="relative mt-1">
      <input
        id={id}
        type={shown ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`w-full border rounded-md p-3 pr-12 focus:outline-none focus:border-[var(--brand-red)] ${
          invalid ? "border-red-400" : "border-[var(--brand-line)]"
        }`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-controls={id}
        aria-label={shown ? "Hide password" : "Show password"}
        title={shown ? "Hide password" : "Show password"}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-[var(--brand-slate)] hover:text-[var(--brand-ink)] transition"
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
