export function TagBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-100 bg-brand-50/70 px-3 py-1 text-xs font-medium text-brand-800">
      {children}
    </span>
  );
}
