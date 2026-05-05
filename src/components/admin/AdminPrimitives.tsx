import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
type AdminButtonSize = 'sm' | 'md' | 'lg';

const buttonVariantClasses: Record<AdminButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-[0_18px_38px_rgba(255,0,127,0.26)] hover:-translate-y-0.5 hover:bg-[#ff1f8f] focus-visible:ring-primary/35',
  secondary:
    'border border-admin-stroke bg-white text-admin-ink shadow-[0_16px_32px_rgba(36,22,29,0.08)] hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary focus-visible:ring-primary/25',
  ghost:
    'border border-transparent bg-admin-cardAlt/70 text-admin-muted hover:-translate-y-0.5 hover:border-admin-stroke hover:bg-white hover:text-admin-ink focus-visible:ring-primary/20',
  danger:
    'border border-admin-danger/25 bg-admin-dangerSoft text-admin-danger shadow-none hover:-translate-y-0.5 hover:border-admin-danger/40 hover:bg-[#f9dce3] focus-visible:ring-admin-danger/20',
  dangerGhost:
    'border border-admin-danger/25 bg-white text-admin-danger shadow-none hover:-translate-y-0.5 hover:border-admin-danger/45 hover:bg-admin-dangerSoft focus-visible:ring-admin-danger/20',
};

const buttonSizeClasses: Record<AdminButtonSize, string> = {
  sm: 'min-h-[40px] rounded-[16px] px-4 text-sm',
  md: 'min-h-[46px] rounded-[18px] px-5 text-[0.96rem]',
  lg: 'min-h-[52px] rounded-[20px] px-6 text-base',
};

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
};

export function AdminButton({
  children,
  className,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type AdminBadgeTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

const badgeToneClasses: Record<AdminBadgeTone, string> = {
  primary: 'border-primary/20 bg-primary/10 text-primary',
  neutral: 'border-admin-stroke bg-white text-admin-ink',
  success: 'border-admin-success/20 bg-admin-successSoft text-admin-success',
  warning: 'border-admin-warning/20 bg-admin-warningSoft text-admin-warning',
  danger: 'border-admin-danger/20 bg-admin-dangerSoft text-admin-danger',
};

type AdminBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: AdminBadgeTone;
};

export function AdminBadge({ children, className, tone = 'neutral', ...props }: AdminBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.18em]',
        badgeToneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

type AdminPageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  kicker: string;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function AdminPageHeader({ actions, className, kicker, subtitle, title }: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        'admin-page-header flex flex-col gap-5 border-b border-admin-stroke/70 pb-5 lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div className="max-w-3xl space-y-3">
        <p className="admin-page-kicker">{kicker}</p>
        <h1 className="admin-page-title font-serif leading-none text-admin-ink">{title}</h1>
        {subtitle ? <p className="admin-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </div>
  );
}

type AdminSectionCardTone = 'default' | 'accent' | 'warning' | 'success' | 'deep';

const sectionToneClasses: Record<AdminSectionCardTone, string> = {
  default: 'bg-white',
  accent: 'bg-[linear-gradient(135deg,rgba(255,0,127,0.08),rgba(255,255,255,0.98)_40%)]',
  warning: 'bg-[linear-gradient(135deg,rgba(255,206,120,0.24),rgba(255,255,255,0.99)_40%)]',
  success: 'bg-[linear-gradient(135deg,rgba(88,162,118,0.18),rgba(255,255,255,0.99)_40%)]',
  deep: 'bg-[linear-gradient(150deg,rgba(33,10,19,0.98),rgba(72,24,43,0.96))] text-white',
};

type AdminSectionCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  helper?: ReactNode;
  kicker?: string;
  title?: ReactNode;
  tone?: AdminSectionCardTone;
};

export function AdminSectionCard({
  actions,
  children,
  className,
  helper,
  kicker,
  title,
  tone = 'default',
  ...props
}: AdminSectionCardProps) {
  return (
    <section
      className={cn(
        'admin-section rounded-admin border border-admin-stroke/75 px-5 py-5 shadow-admin-card sm:px-6 sm:py-6',
        sectionToneClasses[tone],
        className
      )}
      {...props}
    >
      {kicker || title || actions ? (
        <header className="admin-section-header mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            {kicker ? <p className="admin-section-kicker">{kicker}</p> : null}
            {title ? <h2 className="admin-section-title">{title}</h2> : null}
            {helper ? <p className="admin-section-helper">{helper}</p> : null}
          </div>
          {actions ? <div className="admin-section-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type AdminStatCardProps = {
  helper?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  tone?: Exclude<AdminSectionCardTone, 'deep'>;
  value: ReactNode;
};

const statToneClasses: Record<Exclude<AdminSectionCardTone, 'deep'>, string> = {
  default: 'border-admin-stroke bg-white',
  accent: 'border-primary/20 bg-primary/5',
  warning: 'border-admin-warning/20 bg-admin-warningSoft',
  success: 'border-admin-success/20 bg-admin-successSoft',
};

export function AdminStatCard({
  helper,
  icon,
  label,
  tone = 'default',
  value,
}: AdminStatCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[148px] flex-col justify-between rounded-admin-sm border px-5 py-5 shadow-admin-soft',
        statToneClasses[tone]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-admin-muted">
          {label}
        </span>
        {icon ? (
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-primary shadow-[0_12px_24px_rgba(255,0,127,0.12)]">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="font-bebas text-[2.8rem] leading-none tracking-[0.03em] text-admin-ink">{value}</p>
        {helper ? <p className="text-sm leading-6 text-admin-muted">{helper}</p> : null}
      </div>
    </div>
  );
}

type AdminTableShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  kicker: string;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function AdminTableShell({
  actions,
  children,
  className,
  footer,
  kicker,
  subtitle,
  title,
}: AdminTableShellProps) {
  return (
    <section className={cn('admin-table-shell', className)}>
      <div className="admin-table-headerbar">
        <div className="space-y-1.5">
          <p className="admin-section-kicker">{kicker}</p>
          <h3 className="admin-table-title">{title}</h3>
          {subtitle ? <p className="admin-table-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-section-actions">{actions}</div> : null}
      </div>
      {children}
      {footer ? <div className="admin-table-footer">{footer}</div> : null}
    </section>
  );
}

type AdminFieldProps = HTMLAttributes<HTMLLabelElement> & {
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
};

export function AdminField({
  children,
  className,
  error,
  hint,
  label,
  ...props
}: AdminFieldProps) {
  return (
    <label className={cn('admin-field', className)} {...props}>
      <span>{label}</span>
      {children}
      {hint ? <small className="admin-helper-text">{hint}</small> : null}
      {error ? <small className="admin-field-error">{error}</small> : null}
    </label>
  );
}

type AdminInputProps = InputHTMLAttributes<HTMLInputElement>;

export function AdminInput({ className, ...props }: AdminInputProps) {
  return <input className={cn('admin-input', className)} {...props} />;
}

type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function AdminSelect({ className, ...props }: AdminSelectProps) {
  return <select className={cn('admin-select', className)} {...props} />;
}

type AdminTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AdminTextarea({ className, ...props }: AdminTextareaProps) {
  return <textarea className={cn('admin-textarea', className)} {...props} />;
}

type AdminModalBackdropProps = HTMLAttributes<HTMLDivElement> & {
  dark?: boolean;
  full?: boolean;
};

export function AdminModalBackdrop({
  children,
  className,
  dark = false,
  full = false,
  ...props
}: AdminModalBackdropProps) {
  return (
    <div
      className={cn(
        'admin-modal-backdrop',
        dark && 'admin-modal-backdrop-dark',
        full && 'admin-modal-backdrop-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type AdminModalSize = 'md' | 'lg' | 'xl';

const modalSizeClasses: Record<AdminModalSize, string> = {
  md: 'max-w-[740px]',
  lg: 'max-w-[980px]',
  xl: 'max-w-[1160px]',
};

type AdminModalProps = HTMLAttributes<HTMLDivElement> & {
  size?: AdminModalSize;
};

export function AdminModal({ children, className, size = 'lg', ...props }: AdminModalProps) {
  return (
    <div className={cn('admin-modal', modalSizeClasses[size], className)} {...props}>
      {children}
    </div>
  );
}

type AdminModalHeaderProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function AdminModalHeader({
  actions,
  className,
  subtitle,
  title,
  ...props
}: AdminModalHeaderProps) {
  return (
    <div className={cn('admin-modal-header', className)} {...props}>
      <div className="space-y-1.5">
        {subtitle ? <p className="admin-modal-subtitle">{subtitle}</p> : null}
        <h2 className="admin-modal-title">{title}</h2>
      </div>
      {actions ? <div className="admin-modal-header-actions">{actions}</div> : null}
    </div>
  );
}

export function AdminModalBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('admin-modal-body', className)} {...props}>
      {children}
    </div>
  );
}

export function AdminModalFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('admin-modal-footer', className)} {...props}>
      <div className="admin-footer-actions">{children}</div>
    </div>
  );
}

type AdminEmptyStateProps = {
  action?: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export function AdminEmptyState({
  action,
  compact = false,
  description,
  icon,
  title,
}: AdminEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-admin-sm border border-dashed border-admin-stroke bg-white/70 text-center',
        compact ? 'gap-3 px-5 py-6' : 'gap-4 px-6 py-10'
      )}
    >
      {icon ? (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-[-0.01em] text-admin-ink">{title}</p>
        {description ? <p className="max-w-xl text-sm leading-6 text-admin-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type AdminSkeletonVariant = 'line' | 'pill' | 'button' | 'block';

const skeletonClasses: Record<AdminSkeletonVariant, string> = {
  line: 'admin-skeleton-line h-3.5 w-full rounded-full',
  pill: 'admin-skeleton-pill h-7 w-24 rounded-full',
  button: 'admin-skeleton-button h-10 w-28 rounded-[16px]',
  block: 'admin-skeleton-block h-14 w-full rounded-admin-xs',
};

type AdminSkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: AdminSkeletonVariant;
};

export function AdminSkeleton({ className, variant = 'line', ...props }: AdminSkeletonProps) {
  return <span className={cn(skeletonClasses[variant], className)} {...props} />;
}

type AdminToastVariant = 'info' | 'success' | 'warning' | 'error';

const toastVariantClasses: Record<AdminToastVariant, string> = {
  info: 'admin-toast-info',
  success: 'admin-toast-success',
  warning: 'admin-toast-warning',
  error: 'admin-toast-error',
};

type AdminToastItem = {
  id: string;
  message: string;
  variant?: AdminToastVariant;
};

type AdminToastStackProps = {
  onDismiss: (id: string) => void;
  toasts: AdminToastItem[];
};

export function AdminToastStack({ onDismiss, toasts }: AdminToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="admin-toast-stack" role="region" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('admin-toast', toastVariantClasses[toast.variant ?? 'info'])}
          role={toast.variant === 'error' ? 'alert' : 'status'}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="admin-toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Fechar notificacao"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
