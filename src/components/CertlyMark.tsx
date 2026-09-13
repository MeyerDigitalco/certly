export function CertlyMark({
  size = 24,
  red = "#DC2626",
  fold = "#991B1B",
  className,
}: {
  size?: number;
  red?: string;
  fold?: string;
  className?: string;
}) {
  const height = size;
  const width = Math.round((size * 26) / 32);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 26 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 0h13l9 9v19a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z"
        fill={red}
      />
      <path d="M17 0l9 9h-9V0Z" fill={fold} />
      <path
        d="M17.9 10.07A5.9 5.9 0 1 0 17.9 16.33"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="butt"
        fill="none"
      />
      <rect x="5.2" y="22.6" width="11.6" height="2.7" rx="1.35" fill="#fff" />
      <rect x="5.2" y="26.2" width="7.8" height="2.7" rx="1.35" fill="#fff" />
    </svg>
  );
}

export function CertlyLogo({
  size = 26,
  className,
  wordClassName,
  href,
}: {
  size?: number;
  className?: string;
  wordClassName?: string;
  href?: string;
}) {
  const content = (
    <>
      <CertlyMark size={size} />
      <span
        className={wordClassName}
        style={{
          fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif",
          fontSize: size * 1.05,
          lineHeight: 1,
          letterSpacing: "0.01em",
          textTransform: "uppercase",
        }}
      >
        Certly
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32, textDecoration: "none" }}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}
    >
      {content}
    </span>
  );
}
