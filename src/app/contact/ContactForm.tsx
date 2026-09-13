"use client";

import { useState } from "react";
import { SITE, whatsappLink } from "@/lib/site";

const SIZES = ["Under 20", "20 to 50", "50 to 150", "150 to 500", "Over 500"];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [size, setSize] = useState(SIZES[1]);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const ready = name.trim().length > 0 && company.trim().length > 0;

  const composed = [
    "Certly enquiry",
    "",
    `Name: ${name.trim()}`,
    `Company: ${company.trim()}`,
    `People on register: ${size}`,
    phone.trim() ? `Contact number: ${phone.trim()}` : null,
    "",
    message.trim() || "No message.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) return;
    window.open(whatsappLink(composed), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={onSubmit} className="cform">
      <div className="cf-row">
        <label className="cf-field">
          <span className="cf-lab">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="cf-field">
          <span className="cf-lab">Company</span>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            autoComplete="organization"
          />
        </label>
      </div>

      <div className="cf-row">
        <label className="cf-field">
          <span className="cf-lab">People on your register</span>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="cf-field">
          <span className="cf-lab">Contact number, optional</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </label>
      </div>

      <label className="cf-field">
        <span className="cf-lab">What do you need</span>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Which mines or clients do you submit safety files to?"
        />
      </label>

      <div className="cf-preview">
        <div className="cf-preview-h">Message that will open in WhatsApp</div>
        <pre>{composed}</pre>
      </div>

      <div className="hero-actions">
        <button type="submit" className="btn btn-lg" disabled={!ready}>
          Open in WhatsApp
        </button>
        <a
          className="btn btn-o btn-lg"
          href={`mailto:${SITE.email}?subject=${encodeURIComponent("Certly enquiry")}&body=${encodeURIComponent(composed)}`}
        >
          Send by email instead
        </a>
      </div>

      <p className="cf-note">
        Nothing is stored on this page. Pressing the button opens WhatsApp with
        the message above already written, and you send it yourself.
      </p>
    </form>
  );
}
