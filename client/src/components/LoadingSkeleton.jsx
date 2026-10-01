export default function LoadingSkeleton({ rows = 3, className = "" }) {
  return (
    <div
      className={`space-y-3 ${className}`}
      aria-label="Loading content"
      role="status"
    >
      <span className="sr-only">Loading content…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-white/10 ${
            index === 0 ? "h-20" : "h-14"
          }`}
        />
      ))}
    </div>
  );
}
