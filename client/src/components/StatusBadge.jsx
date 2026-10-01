const LABEL = {
  built: "Built",
  done: "Done",
  "in-progress": "In progress",
  planned: "Planned",
};

// The text label always shows, so status never depends on colour alone (WCAG 1.4.1).
export default function StatusBadge({ status }) {
  const look =
    status === "planned"
      ? "border border-dashed border-slate-500 bg-transparent"
      : status === "in-progress"
        ? "border border-cyan-700 bg-transparent dark:border-cyan-300"
        : "bg-cyan-700 text-white dark:bg-cyan-300 dark:text-slate-950";
  return <span className={`tag ${look}`}>{LABEL[status] || status}</span>;
}
