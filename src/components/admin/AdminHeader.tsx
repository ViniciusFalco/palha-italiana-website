import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { supabase } from '../../lib/supabase';

type AdminHeaderProps = {
  onOpenMobileMenu?: () => void;
};

type HeaderMetrics = {
  pending: number;
  inProgress: number;
  finishedMonth: number;
  totalSalesMonth: number;
};

const METRICS_EVENT = 'admin-metrics-refresh';
const countFormatter = new Intl.NumberFormat('pt-BR');
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCount = (value: number) => countFormatter.format(value);
const formatCurrency = (cents: number) => currencyFormatter.format(cents / 100);

const getMonthRange = (reference: Date) => {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export default function AdminHeader({ onOpenMobileMenu }: AdminHeaderProps) {
  const { withAuthRetry } = useAuth();
  const headerRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<HeaderMetrics>({
    pending: 0,
    inProgress: 0,
    finishedMonth: 0,
    totalSalesMonth: 0,
  });

  const loadMetrics = useCallback(
    async (options?: { silent?: boolean }) => {
      if (loadingRef.current) return;
      const silent = options?.silent ?? false;

      if (!silent && !hasLoadedRef.current) {
        setLoading(true);
      }

      loadingRef.current = true;
      try {
        const { startISO, endISO } = getMonthRange(new Date());
        const [pendingResult, progressResult, finishedResult] = await Promise.all([
          withAuthRetry(
            () => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            { label: 'metrics-pending' }
          ),
          withAuthRetry(
            () => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
            { label: 'metrics-in-progress' }
          ),
          withAuthRetry(
            () =>
              supabase
                .from('orders')
                .select('total_cents', { count: 'exact' })
                .eq('status', 'finished')
                .gte('created_at', startISO)
                .lt('created_at', endISO),
            { label: 'metrics-finished-month' }
          ),
        ]);

        if (pendingResult.error || progressResult.error || finishedResult.error) {
          if (import.meta.env.DEV) {
            console.error('Erro ao carregar métricas do header', {
              pending: pendingResult.error,
              inProgress: progressResult.error,
              finished: finishedResult.error,
            });
          }
          return;
        }

        const finishedRows = (finishedResult.data ?? []) as Array<{ total_cents?: number | null }>;
        const totalSalesMonth = finishedRows.reduce((sum, row) => sum + (row.total_cents ?? 0), 0);

        setMetrics({
          pending: pendingResult.count ?? 0,
          inProgress: progressResult.count ?? 0,
          finishedMonth: finishedResult.count ?? finishedRows.length,
          totalSalesMonth,
        });
        hasLoadedRef.current = true;
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [withAuthRetry]
  );

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRefresh = () => {
      void loadMetrics({ silent: true });
    };
    window.addEventListener(METRICS_EVENT, handleRefresh);
    return () => window.removeEventListener(METRICS_EVENT, handleRefresh);
  }, [loadMetrics]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const target = headerRef.current;
    if (!target) return;

    const updateHeight = () => {
      const nextHeight = Math.round(target.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--admin-header-height', `${nextHeight}px`);
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const pendingValue = useMemo(() => (loading ? '--' : formatCount(metrics.pending)), [loading, metrics.pending]);
  const inProgressValue = useMemo(
    () => (loading ? '--' : formatCount(metrics.inProgress)),
    [loading, metrics.inProgress]
  );
  const finishedValue = useMemo(
    () => (loading ? '--' : formatCount(metrics.finishedMonth)),
    [loading, metrics.finishedMonth]
  );
  const totalSalesValue = useMemo(
    () => (loading ? '--' : formatCurrency(metrics.totalSalesMonth)),
    [loading, metrics.totalSalesMonth]
  );

  return (
    <header className="admin-header" ref={headerRef}>
      <div className="admin-header-inner">
        <button
          type="button"
          className="admin-menu-toggle"
          aria-label="Abrir menu de navegação"
          onClick={onOpenMobileMenu}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="admin-header-metrics">
          <div className="header-card">
            <span className="header-card-label">Pedidos pendentes</span>
            <span className="header-card-value">{pendingValue}</span>
          </div>
          <div className="header-card">
            <span className="header-card-label">Pedidos em andamento</span>
            <span className="header-card-value">{inProgressValue}</span>
          </div>
          <div className="header-card">
            <span className="header-card-label">Pedidos concluídos no mês</span>
            <span className="header-card-value">{finishedValue}</span>
          </div>
          <div className="header-card">
            <span className="header-card-label">Total de vendas no mês</span>
            <span className="header-card-value">{totalSalesValue}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
