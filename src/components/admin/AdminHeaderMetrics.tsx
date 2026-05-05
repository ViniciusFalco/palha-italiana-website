type AdminHeaderMetricItem = {
  helper?: string;
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'neutral';
  value: string;
};

type AdminHeaderMetricsProps = {
  items: AdminHeaderMetricItem[];
};

const toneClasses: Record<NonNullable<AdminHeaderMetricItem['tone']>, string> = {
  primary: 'is-primary',
  success: 'is-success',
  warning: 'is-warning',
  neutral: 'is-neutral',
};

export default function AdminHeaderMetrics({ items }: AdminHeaderMetricsProps) {
  return (
    <div className="admin-header-metrics">
      {items.map((item, index) => (
        <div key={item.label} className={`header-card${index > 0 ? ' has-divider' : ''}`}>
          <span className="header-card-label">{item.label}</span>
          <span className={`header-card-value ${toneClasses[item.tone ?? 'primary']}`}>{item.value}</span>
          {item.helper ? <span className="header-card-helper">{item.helper}</span> : null}
        </div>
      ))}
    </div>
  );
}
