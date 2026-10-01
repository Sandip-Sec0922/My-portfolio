// Turns an API error into one readable line, including per-field validation details.
export const errText = (e) => {
  const f = e.details?.map((d) => `${d.field}: ${d.message}`).join("; ");
  return `${e.message}${f ? ` (${f})` : ""}`;
};

export function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs">{hint}</p>}
    </div>
  );
}
