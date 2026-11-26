export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--primary)" />
      <path d="M18 44V20m10 24V28m10 16V22m10 22V32" stroke="var(--primary-foreground)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
