import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import AdminHeaderMetrics from './AdminHeaderMetrics';
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

const HEADER_META = [
  {
    match: '/admin/pedidos',
    eyebrow: 'Fluxo Sweet Child',
    title: 'Pedidos em acompanhamento',
    description: 'Pendencias, aprovacoes e entregas organizadas em um unico ritmo visual.',
  },
  {
    match: '/admin/produtos',
    eyebrow: 'Catalogo Sweet Child',
    title: 'Produtos e categorias',
    description: 'Edite o catalogo com mais clareza, espaco e consistencia editorial.',
  },
  {
    match: '/admin/configurar',
    eyebrow: 'Regras do checkout',
    title: 'Configurar pedidos',
    description: 'Defina pedido minimo, cupons e descontos usados no fechamento do cliente.',
  },
  {
    match: '/admin/dashboard',
    eyebrow: 'Em desenvolvimento',
    title: 'Dashboard',
    description: 'Esta aba sera disponibilizada em breve.',
  },
  {
    match: '/admin/financeiro',
    eyebrow: 'Em desenvolvimento',
    title: 'Financeiro',
    description: 'Esta aba sera disponibilizada em breve.',
  },
  {
    match: '/admin/recibos',
    eyebrow: 'Em desenvolvimento',
    title: 'Recibos',
    description: 'Esta aba sera disponibilizada em breve.',
  },
  {
    match: '/admin',
    eyebrow: 'Em desenvolvimento',
    title: 'Dashboard',
    description: 'Esta aba sera disponibilizada em breve.',
  },
] as const;

const getMonthRange = (reference: Date) => {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export default function AdminHeader({ onOpenMobileMenu }: AdminHeaderProps) {
  const { withAuthRetry } = useAuth();
  const location = useLocation();
  const headerRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const [mobileCompact, setMobileCompact] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 980px)');
    const updateMobileCompact = () => {
      if (!mediaQuery.matches) {
        setMobileCompact(false);
        return;
      }
      setMobileCompact(window.scrollY > 18);
    };

    updateMobileCompact();
    window.addEventListener('scroll', updateMobileCompact, { passive: true });
    window.addEventListener('resize', updateMobileCompact);
    mediaQuery.addEventListener('change', updateMobileCompact);

    return () => {
      window.removeEventListener('scroll', updateMobileCompact);
      window.removeEventListener('resize', updateMobileCompact);
      mediaQuery.removeEventListener('change', updateMobileCompact);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const target = headerRef.current;
    if (!target) return;

    const updateHeight = () => {
      const nextHeight = Math.round(target.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--admin-header-height', `${nextHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(target);
    return () => {
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
    };
  }, []);

  const meta =
    HEADER_META.find((item) =>
      item.match === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.match)
    ) ?? HEADER_META[HEADER_META.length - 1];

  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const metricItems = [
    {
      label: 'Pendentes',
      value: loading ? '--' : formatCount(metrics.pending),
      helper: 'Aguardando aprovacao',
      tone: 'warning' as const,
    },
    {
      label: 'Em andamento',
      value: loading ? '--' : formatCount(metrics.inProgress),
      helper: 'Pedidos em producao',
      tone: 'primary' as const,
    },
    {
      label: 'Concluidos no mes',
      value: loading ? '--' : formatCount(metrics.finishedMonth),
      helper: 'Pedidos finalizados',
      tone: 'success' as const,
    },
    {
      label: 'Receita do mes',
      value: loading ? '--' : formatCurrency(metrics.totalSalesMonth),
      helper: `Atualizado em ${todayLabel}`,
      tone: 'primary' as const,
    },
  ];

  return (
    <header className={`admin-header${mobileCompact ? ' is-mobile-compact' : ''}`} ref={headerRef}>
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

        <div className="admin-header-mobile-brand" aria-label="Sweet Child">
          <img src="/logo.svg" alt="Sweet Child" />
        </div>

        <div className="admin-header-copy">
          <div className="admin-header-copy-inner">
            <p className="admin-header-kicker">{meta.eyebrow}</p>
            <div className="admin-header-title-row">
              <h1 className="admin-header-title">{meta.title}</h1>
              <span className="admin-header-date">{todayLabel}</span>
              <a
                className="admin-header-catalog-link"
                href="/"
              >
                <FaArrowUpRightFromSquare aria-hidden="true" />
                Ver catálogo
              </a>
            </div>
            <p className="admin-header-description">{meta.description}</p>
          </div>
        </div>

        <AdminHeaderMetrics items={metricItems} />
      </div>
    </header>
  );
}
