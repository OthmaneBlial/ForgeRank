import type { LucideIcon } from "lucide-react";

export function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {label}
      </div>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}
