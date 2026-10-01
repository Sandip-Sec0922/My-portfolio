const LABEL = {
  built: "Built",
  done: "Done",
  "in-progress": "In progress",
  planned: "Planned",
};

// The text label always shows, so status never depends on colour alone (WCAG 1.4.1).
export default function StatusBadge({ status }) {
  const look = {
    planned: "border-dashed !bg-transparent",
    "in-progress":
      "!border-amber-500/40 !bg-amber-500/10 !text-amber-800 dark:!text-amber-200",
    built:
      "!border-teal-700/20 !bg-teal-500/10 !text-teal-800 dark:!border-teal-300/20 dark:!text-teal-200",
    done:
      "!border-teal-700/20 !bg-teal-500/10 !text-teal-800 dark:!border-teal-300/20 dark:!text-teal-200",
  }[status] || "";
  return (
    <span className={`tag whitespace-nowrap ${look}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABEL[status] || status}
    </span>
  );
}
