
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  CalendarDays,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ShoppingCart,
  ChartNoAxesCombined,
  Clock3,
  MapPin,
  CircleDollarSign,
  CalendarRange,
  Activity,
} from "lucide-react";

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/data/orders";

import { formatPrice } from "@/lib/placeholder";
import Spinner from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type MonthlySale = {
  month: string;
  total: number;
};

type BestSellerSale = {
  month: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  image_url: string | null;
  quantity: number;
  revenue: number;
};

type BestSellerChartRow = {
  product: string;
  productName: string;
  imageUrl: string;
  quantity: number;
};

type LowStockProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  image_url: string | null;
};

type RecentOrder = {
  id: string;
  reference: string;
  status: string;
  total: number;
  created_at: string | null;
  customer_name: string;
  governorate: string | null;
};

type Kpis = {
  customers: number;
  orders: number;
  revenue: number;
  average_basket: number;
  customers_delta_percent: number | null;
  orders_delta_percent: number | null;
  revenue_delta_percent: number | null;
  average_basket_delta_percent: number | null;
};

const PERIODS = [
  { days: 7, label: "7 derniers jours" },
  { days: 30, label: "30 derniers jours" },
  { days: 180, label: "6 derniers mois" },
  { days: 365, label: "12 derniers mois" },
] as const;

type PeriodSelection = number | "custom";

const today = () => new Date().toISOString().slice(0, 10);

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const formatOrderDate = (value: string | null) => {
  if (!value) return "Date non renseignée";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date non renseignée";
  }

  return `${date.toLocaleDateString("fr-FR")} à ${date.toLocaleTimeString(
    "fr-FR",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )}`;
};

function BestSellerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BestSellerChartRow }>;
}) {
  const row = payload?.[0]?.payload;

  if (!active || !row) return null;

  return (
    <div className="flex max-w-xs items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xl">
      {row.imageUrl ? (
        <img
          src={row.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-foreground">
          {row.productName}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          SKU : {row.product}
        </p>

        <p className="mt-1 font-semibold text-primary">
          Vendus : {row.quantity} article{row.quantity > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

function DeltaIndicator({
  value,
}: {
  value: number | null;
}) {
  if (value === null) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        Pas de comparaison disponible
      </span>
    );
  }

  const positive = value >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
        positive
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-red-500/10 text-red-600"
      }`}
    >
      {positive ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}

      {positive ? "+" : ""}
      {value.toFixed(2).replace(".", ",")}%
    </span>
  );
}

function AdminDashboard() {
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const [listsLoading, setListsLoading] = useState(true);

  const [kpis, setKpis] = useState<Kpis>({
    customers: 0,
    orders: 0,
    revenue: 0,
    average_basket: 0,
    customers_delta_percent: null,
    orders_delta_percent: null,
    revenue_delta_percent: null,
    average_basket_delta_percent: null,
  });

  const [kpisLoading, setKpisLoading] = useState(true);

  const [salesByMonth, setSalesByMonth] = useState<MonthlySale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  const [bestSellerData, setBestSellerData] = useState<
    Record<string, number | string>[]
  >([]);

  const [bestSellerNames, setBestSellerNames] = useState<string[]>([]);
  const [bestSellerLoading, setBestSellerLoading] = useState(true);

  const [periodSelection, setPeriodSelection] =
    useState<PeriodSelection>(180);

  const [customStart, setCustomStart] = useState(() => daysAgo(6));
  const [customEnd, setCustomEnd] = useState(today);

  const periodDays =
    periodSelection === "custom"
      ? Math.max(
          1,
          Math.round(
            (new Date(`${customEnd}T00:00:00`).getTime() -
              new Date(`${customStart}T00:00:00`).getTime()) /
              86_400_000
          ) + 1
        )
      : periodSelection;

  const periodEndDate =
    periodSelection === "custom" ? customEnd : today();

  const loadKpis = async (days = periodDays) => {
    setKpisLoading(true);

    const { data, error } = await supabase.rpc(
      "get_admin_dashboard_kpis",
      {
        p_days: days,
        p_end_date: periodEndDate,
      }
    );

    if (error) {
      console.error("load dashboard KPIs", error);
    } else if (data) {
      setKpis({
        customers: Number(data.customers ?? 0),
        orders: Number(data.orders ?? 0),
        revenue: Number(data.revenue ?? 0),
        average_basket: Number(data.average_basket ?? 0),
        customers_delta_percent: data.customers_delta_percent,
        orders_delta_percent: data.orders_delta_percent,
        revenue_delta_percent: data.revenue_delta_percent,
        average_basket_delta_percent: data.average_basket_delta_percent,
      });
    }

    setKpisLoading(false);
  };

  const loadMonthlySales = async (days = periodDays) => {
    setSalesLoading(true);

    const { data, error } = await supabase.rpc(
      "get_admin_monthly_sales",
      {
        p_days: days,
        p_end_date: periodEndDate,
      }
    );

    if (error) {
      console.error("load dashboard monthly sales", error);
    } else {
      setSalesByMonth(
        (data ?? []).map((item) => ({
          month: new Date(
            `${item.month}${item.month.length === 7 ? "-01" : ""}T00:00:00`
          ).toLocaleDateString(
            "fr-FR",
            item.month.length === 7
              ? { month: "short" }
              : { day: "2-digit", month: "2-digit" }
          ),
          total: Number(item.total ?? 0),
        }))
      );
    }

    setSalesLoading(false);
  };

  const loadBestSellers = async (days = periodDays) => {
    setBestSellerLoading(true);

    const { data, error } = await supabase.rpc(
      "get_admin_best_sellers",
      {
        p_days: days,
        p_end_date: periodEndDate,
        p_limit: 8,
      }
    );

    if (error) {
      console.error("load dashboard best sellers", error);
      setBestSellerData([]);
      setBestSellerNames([]);
    } else {
      const rows = (data ?? []) as BestSellerSale[];

      const products = new Map<
        string,
        {
          label: string;
          productName: string;
          imageUrl: string | null;
          quantity: number;
        }
      >();

      rows.forEach((item) => {
        const key = `${item.product_id ?? item.product_name}:${
          item.variant_id ?? item.sku ?? ""
        }`;

        const label = item.sku || "Sans SKU";
        const current = products.get(key);

        products.set(key, {
          label,
          productName: item.product_name,
          imageUrl: item.image_url,
          quantity:
            (current?.quantity ?? 0) + Number(item.quantity ?? 0),
        });
      });

      const bestSellers = [...products.values()].sort(
        (a, b) => b.quantity - a.quantity
      );

      setBestSellerNames(bestSellers.map((item) => item.label));

      setBestSellerData(
        bestSellers.map((item) => ({
          product: item.label,
          productName: item.productName,
          imageUrl: item.imageUrl ?? "",
          quantity: item.quantity,
        }))
      );
    }

    setBestSellerLoading(false);
  };

  const loadDashboardLists = async () => {
    setListsLoading(true);

    const [stockResult, ordersResult] = await Promise.all([
      supabase.rpc("get_admin_low_stock_products", {
        p_limit: 5,
      }),
      supabase.rpc("get_admin_recent_orders", {
        p_limit: 5,
      }),
    ]);

    if (stockResult.error) {
      console.error("load low stock products", stockResult.error);
    } else {
      setLowStock(
        (Array.isArray(stockResult.data)
          ? stockResult.data
          : []) as LowStockProduct[]
      );
    }

    if (ordersResult.error) {
      console.error("load recent orders", ordersResult.error);
    } else {
      setRecentOrders(
        (Array.isArray(ordersResult.data)
          ? ordersResult.data
          : []) as RecentOrder[]
      );
    }

    setListsLoading(false);
  };

  useEffect(() => {
    loadKpis(periodDays);
    loadMonthlySales(periodDays);
    loadBestSellers(periodDays);
    loadDashboardLists();

    const channel = supabase.channel("admin-dashboard-kpis") as any;

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadKpis(periodDays);
          loadMonthlySales(periodDays);
          loadBestSellers(periodDays);
          loadDashboardLists();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        loadKpis
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        loadDashboardLists
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [periodDays, periodEndDate]);

  const cards = [
    {
      label: "Chiffre d'affaires",
      value: formatPrice(kpis.revenue),
      icon: Wallet,
      delta: kpis.revenue_delta_percent,
      description: "Revenus sur la période",
      iconStyle: "bg-blue-500/10 text-blue-600",
    },
    {
      label: "Commandes livrées",
      value: String(kpis.orders),
      icon: ShoppingBag,
      delta: kpis.orders_delta_percent,
      description: "Commandes enregistrées",
      iconStyle: "bg-violet-500/10 text-violet-600",
    },
    {
      label: "Clients",
      value: String(kpis.customers),
      icon: Users,
      delta: kpis.customers_delta_percent,
      description: "Clients sur la période",
      iconStyle: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: "Panier moyen",
      value: formatPrice(kpis.average_basket),
      icon: TrendingUp,
      delta: kpis.average_basket_delta_percent,
      description: "Valeur moyenne par commande",
      iconStyle: "bg-amber-500/10 text-amber-600",
    },
  ];

  return (
    <div className="min-h-full space-y-7 pb-8">

      {/* HEADER */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ChartNoAxesCombined className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Dashboard
              </h1>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Temps réel
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Suivez les performances et l'activité de votre boutique.
            </p>
          </div>
        </div>

        {/* PERIOD FILTER */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarRange className="h-4 w-4" />
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Période d'analyse
              </p>

              <p className="text-sm font-semibold">
                {periodSelection === "custom"
                  ? "Personnalisée"
                  : PERIODS.find((p) => p.days === periodSelection)?.label}
              </p>
            </div>
          </div>

          <select
            value={periodSelection}
            onChange={(event) =>
              setPeriodSelection(
                event.target.value === "custom"
                  ? "custom"
                  : Number(event.target.value)
              )
            }
            className="h-10 min-w-[175px] rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none transition-colors focus:border-primary"
            aria-label="Filtrer le dashboard par période"
          >
            {PERIODS.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}

            <option value="custom">Période personnalisée</option>
          </select>
        </div>
      </div>

      {/* CUSTOM DATES */}
      {periodSelection === "custom" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Période personnalisée
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Du
              </span>

              <input
                type="date"
                value={customStart}
                max={customEnd || today()}
                onChange={(event) => setCustomStart(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Au
              </span>

              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={today()}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(
          ({
            label,
            value,
            icon: Icon,
            delta,
            description,
            iconStyle,
          }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {label}
                  </p>

                  <div className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                    {kpisLoading ? (
                      <Spinner className="h-7 w-7" />
                    ) : (
                      value
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <DeltaIndicator value={delta} />

                <span className="text-[11px] text-muted-foreground">
                  vs période précédente
                </span>
              </div>
            </div>
          )
        )}
      </div>

      {/* SALES + LOW STOCK */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">

        {/* SALES CHART */}
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" />
                </div>

                <h2 className="text-base font-bold">
                  Évolution des ventes
                </h2>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Chiffre d'affaires sur la période sélectionnée
              </p>
            </div>

            <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {salesByMonth.length} période(s)
            </span>
          </div>

          <div className="mt-5 h-[280px] w-full">
            {salesLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner className="h-7 w-7" />
              </div>
            ) : salesByMonth.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ChartNoAxesCombined className="h-10 w-10 text-muted-foreground/40" />

                <p className="mt-3 text-sm font-semibold">
                  Aucune donnée disponible
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Les ventes apparaîtront ici dès qu'elles seront enregistrées.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={salesByMonth}
                  margin={{
                    top: 10,
                    right: 15,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="var(--border)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: "var(--muted-foreground)" }}
                    dy={10}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={65}
                    tick={{ fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("fr-FR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(value)
                    }
                  />

                  <Tooltip
                    cursor={{
                      stroke: "var(--border)",
                      strokeDasharray: "4 4",
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
                    }}
                    labelStyle={{
                      color: "var(--foreground)",
                      fontWeight: 600,
                    }}
                    formatter={(value) => formatPrice(Number(value))}
                  />

                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Chiffre d'affaires"
                    stroke="var(--accent-strong)"
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: "var(--accent-strong)",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 3,
                      stroke: "var(--card)",
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* LOW STOCK */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>

                <h2 className="text-base font-bold">
                  Stock faible
                </h2>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Produits nécessitant votre attention
              </p>
            </div>

            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-amber-500/10 px-2 text-sm font-bold text-amber-600">
              {lowStock.length}
            </span>
          </div>

          {listsLoading ? (
            <div className="flex min-h-[210px] items-center justify-center">
              <Spinner className="h-7 w-7" />
            </div>
          ) : lowStock.length === 0 ? (
            <div className="flex min-h-[210px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Package className="h-6 w-6" />
              </div>

              <p className="mt-3 text-sm font-semibold">
                Tout est en ordre !
              </p>

              <p className="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">
                Tous vos stocks sont confortables pour le moment.
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-2">
              {lowStock.map((product) => (
                <li key={product.id}>
                  <Link
                    to="/admin/produits"
                    search={{ produit: product.id }}
                    className="flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {product.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        SKU : {product.sku || "Non défini"}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                        product.stock_quantity === 0
                          ? "bg-red-500/10 text-red-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {product.stock_quantity} unité(s)
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/admin/produits"
            className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-4 text-sm font-semibold text-primary transition-colors hover:opacity-75"
          >
            Gérer les produits
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      {/* BEST SELLERS */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <TrendingUp className="h-4 w-4" />
              </div>

              <h2 className="text-base font-bold">
                Meilleures ventes
              </h2>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Classement des produits selon les quantités vendues
            </p>
          </div>

          <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Top 8 produits
          </span>
        </div>

        <div className="mt-5 h-[310px] w-full">
          {bestSellerLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-7 w-7" />
            </div>
          ) : bestSellerNames.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />

              <p className="mt-3 text-sm font-semibold">
                Aucune vente disponible
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Aucune vente livrée sur cette période.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bestSellerData}
                margin={{
                  top: 10,
                  bottom: 50,
                  left: 0,
                  right: 15,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="var(--border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="product"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  tick={{ fill: "var(--muted-foreground)" }}
                  dy={10}
                />

                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={35}
                  tick={{ fill: "var(--muted-foreground)" }}
                />

                <Tooltip
                  cursor={{ fill: "var(--surface)" }}
                  content={<BestSellerTooltip />}
                />

                <Bar
                  dataKey="quantity"
                  name="Vendus"
                  fill="var(--accent-strong)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* RECENT ORDERS */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <ShoppingBag className="h-4 w-4" />
              </div>

              <h2 className="text-base font-bold">
                Dernières commandes
              </h2>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Les cinq commandes les plus récentes
            </p>
          </div>

          <Link
            to="/admin/commandes"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Toutes les commandes
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {listsLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner className="h-7 w-7" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />

            <p className="mt-3 text-sm font-semibold">
              Aucune commande récente
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Les commandes apparaîtront ici dès leur enregistrement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Commande
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Client
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Statut
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => {
                  const status =
                    order.status as keyof typeof ORDER_STATUS_LABELS;

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold text-foreground">
                          {order.reference}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium">
                            {order.customer_name}
                          </p>

                          {order.governorate && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {order.governorate}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          {formatOrderDate(order.created_at)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            ORDER_STATUS_STYLES[status] ??
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[status] ?? order.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="font-bold">
                          {formatPrice(order.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
