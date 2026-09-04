"use client";

import { useState, useTransition } from "react";
import { signUp } from "./actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ field?: string; message: string } | null>(
    null,
  );
  const [company, setCompany] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(company);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("slug", effectiveSlug);
    startTransition(async () => {
      const res = await signUp(form);
      if (res && !res.ok) setError({ message: res.error, field: res.field });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error.message}
        </div>
      ) : null}

      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Company name
        </label>
        <input
          type="text"
          name="company"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
            error?.field === "company"
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Workspace URL
        </label>
        <div className="mt-1 flex items-center border rounded-md overflow-hidden border-[var(--brand-line)] focus-within:border-[var(--brand-red)]">
          <span className="pl-3 pr-1 text-sm text-[var(--brand-slate)] font-mono">
            certly.co.za/
          </span>
          <input
            type="text"
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            className="flex-1 p-3 font-mono text-sm focus:outline-none"
          />
        </div>
        {error?.field === "slug" ? (
          <p className="mt-1 text-xs text-red-600">{error.message}</p>
        ) : (
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            3 to 50 letters, numbers or hyphens.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Your email
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
            error?.field === "email"
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Password
        </label>
        <input
          type="password"
          name="password"
          required
          autoComplete="new-password"
          className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
            error?.field === "password"
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        />
        <p className="mt-1 text-xs text-[var(--brand-slate)]">
          At least 8 characters. You are the workspace owner.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
      >
        {pending ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}
