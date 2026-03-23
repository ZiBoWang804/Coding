export function TagBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">{children}</span>;
}
