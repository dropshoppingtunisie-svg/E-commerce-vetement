
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Package,
  ShoppingBag,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Truck,
  MapPin,
  CreditCard,
  Receipt,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ShoppingCart,
  Tag,
  Wallet,
  Loader2,
  PackageCheck,
} from "lucide-react";

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/data/orders";

import { formatPrice, mockImage } from "@/lib/placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { OrderStatus, Order } from "@/types";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import OrderStatusTimeline from "@/components/store/OrderStatusTimeline";

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/compte/commandes")({
  component: AccountOrders,
});

// ============================================================
// HELPERS
// ============================================================

function formatOrderDate(date: string | null | undefined) {
  if (!date) return "Date indisponible";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date indisponible";
  }

  return parsedDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatOrderTime(date: string | null | undefined) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case "delivered":
      return CheckCircle2;

    case "cancelled":
      return AlertCircle;

    case "shipped":
      return Truck;

    case "confirmed":
      return PackageCheck;

    default:
      return Clock3;
  }
}

function getSafeNumber(value: unknown, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

// ============================================================
// STATUS BADGE
// ============================================================

function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const StatusIcon = getStatusIcon(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
        ORDER_STATUS_STYLES[status]
      )}
    >
      <StatusIcon className="h-3.5 w-3.5" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="h-5 w-5" />
        </div>

        <span className="text-xs font-medium text-muted-foreground">
          {description}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>

        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-5 py-16 text-center">
      <div className="relative mb-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <ShoppingBag className="h-9 w-9 text-primary" />
        </div>

        <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground">
          <Package className="h-4 w-4" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-foreground">
        Aucune commande pour le moment
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Vous n'avez pas encore passé de commande.
        Découvrez notre collection et trouvez vos prochains articles préférés.
      </p>

      <Button
        asChild
        variant="accent"
        className="mt-6 h-11 gap-2 rounded-xl px-5"
      >
        <Link to="/">
          <ShoppingCart className="h-4 w-4" />
          Commencer mes achats
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// ============================================================
// LOADING STATE
// ============================================================

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted" />

            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-44 rounded bg-muted" />
            </div>

            <div className="hidden space-y-2 sm:block">
              <div className="h-6 w-24 rounded-full bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ORDER ITEM
// ============================================================

function OrderProductItem({
  item,
}: {
  item: Order["items"][number];
}) {
  return (
    <div className="flex items-center gap-3 py-3 sm:gap-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        <img
          src={item.image ?? undefined}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {item.name}
        </p>

        {item.variant_label && (
          <p className="mt-1 text-xs text-muted-foreground">
            {item.variant_label}
          </p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          Quantité : {item.quantity}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-foreground">
          {formatPrice(item.unit_price * item.quantity)}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {formatPrice(item.unit_price)} / unité
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ORDER SUMMARY
// ============================================================

function OrderSummary({
  order,
}: {
  order: Order;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" />

        <h3 className="text-sm font-bold text-foreground">
          Récapitulatif de la commande
        </h3>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Sous-total
          </dt>

          <dd className="font-medium text-foreground">
            {formatPrice(order.subtotal)}
          </dd>
        </div>

        {order.discount > 0 && (
          <div className="flex items-center justify-between gap-3 text-accent-strong">
            <dt className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Remise
            </dt>

            <dd className="font-semibold">
              -{formatPrice(order.discount)}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Livraison
          </dt>

          <dd className="font-medium text-foreground">
            {formatPrice(order.shipping)}
          </dd>
        </div>

        {order.governorate && (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Gouvernorat
            </dt>

            <dd className="font-medium text-foreground">
              {order.governorate}
            </dd>
          </div>
        )}
      </dl>

      <div className="my-4 border-t border-border/70" />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">
            Total
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Paiement à la livraison
          </p>
        </div>

        <p className="text-xl font-extrabold tracking-tight text-primary">
          {formatPrice(order.total)}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ORDER CARD
// ============================================================

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const StatusIcon = getStatusIcon(order.status);

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300",
        expanded
          ? "border-primary/25 shadow-md"
          : "border-border/70 hover:border-primary/20 hover:shadow-md"
      )}
    >
      {/* ORDER HEADER */}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-col gap-4 p-4 text-left transition-colors hover:bg-muted/20 sm:p-5"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                expanded
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Package className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground sm:text-base">
                Commande #{order.reference}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatOrderDate(order.created_at)}
                </span>

                <span className="hidden sm:inline">·</span>

                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatOrderTime(order.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden shrink-0 sm:block">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {order.items.length} article{order.items.length > 1 ? "s" : ""}
            </span>

            <span className="h-1 w-1 rounded-full bg-border" />

            <span className="text-base font-extrabold tracking-tight text-foreground">
              {formatPrice(order.total)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="sm:hidden">
              <OrderStatusBadge status={order.status} />
            </div>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </div>
        </div>
      </button>

      {/* ORDER DETAILS */}

      {expanded && (
        <div className="border-t border-border/70 px-4 py-5 sm:px-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

            {/* PRODUCTS */}

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Articles commandés
                </h3>

                <span className="text-xs text-muted-foreground">
                  {order.items.length} produit{order.items.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-border/70">
                {order.items.map((item) => (
                  <OrderProductItem
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>

              {/* PAYMENT METHOD */}

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Mode de paiement
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {order.payment_method === "cod"
                      ? "Paiement à la livraison"
                      : String(order.payment_method)}
                  </p>
                </div>
              </div>
            </div>

            {/* SUMMARY */}

            <div className="space-y-5">
              <OrderSummary order={order} />
            </div>
          </div>

          {/* TRACKING */}

          <div className="mt-6 border-t border-border/70 pt-5">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />

              <h3 className="text-sm font-bold text-foreground">
                Suivi de la commande
              </h3>
            </div>

            <OrderStatusTimeline orderId={order.id} />
          </div>
        </div>
      )}
    </li>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function AccountOrders() {
  const { profile, loading: authLoading } = useAuth();

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------------

  const totalOrders = myOrders.length;

  const totalSpent = useMemo(
    () =>
      myOrders.reduce(
        (total, order) => total + getSafeNumber(order.total),
        0
      ),
    [myOrders]
  );

  const activeOrders = useMemo(
    () =>
      myOrders.filter(
        (order) =>
          !["delivered", "cancelled"].includes(order.status)
      ).length,
    [myOrders]
  );

  // ----------------------------------------------------------
  // LOAD ORDERS
  // ----------------------------------------------------------

  const loadOrders = async (isRefresh = false) => {
    if (!profile) {
      setMyOrders([]);
      setLoadingOrders(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingOrders(true);
    }

    setLoadError(false);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `id, order_number, status, payment_method, subtotal, discount_amount, shipping_amount, total, shipping_address, created_at, order_items(*, products(product_images(url, is_main, position)))`
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Order[] = (data ?? []).map((r: any) => ({
        id: r.id,
        reference: r.order_number,
        customer_name:
          (profile.first_name || "") +
          (profile.last_name ? ` ${profile.last_name}` : ""),
        customer_phone: r.shipping_address?.phone ?? "",
        status: r.status as OrderStatus,
        payment_method: r.payment_method ?? "cod",
        subtotal: getSafeNumber(r.subtotal),
        shipping: getSafeNumber(r.shipping_amount),
        discount: getSafeNumber(r.discount_amount),
        total: getSafeNumber(r.total),
        governorate: r.shipping_address?.governorate ?? "",
        created_at: r.created_at,

        items: (r.order_items ?? []).map((item: any) => {
          const images = (
            item.products?.product_images ?? []
          )
            .slice()
            .sort(
              (a: any, b: any) =>
                Number(b.is_main) - Number(a.is_main) ||
                (a.position ?? 0) - (b.position ?? 0)
            );

          return {
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            name: item.product_name,
            variant_label: item.variant_label ?? null,
            image:
              images[0]?.url ??
              mockImage(item.product_name ?? "Produit"),
            unit_price: getSafeNumber(item.unit_price),
            quantity: getSafeNumber(item.quantity, 1) || 1,
          };
        }),
      }));

      setMyOrders(mapped);

      setOpenId((previous) => {
        if (previous && mapped.some((order) => order.id === previous)) {
          return previous;
        }

        return mapped[0]?.id ?? null;
      });
    } catch (error) {
      console.error("fetch orders error:", error);
      setLoadError(true);

      if (!isRefresh) {
        setMyOrders([]);
      }

      // Feedback for the user
      if (isRefresh) {
        toast.error("Impossible d'actualiser vos commandes.");
      }
    } finally {
      setLoadingOrders(false);
      setRefreshing(false);
    }
  };

  // ----------------------------------------------------------
  // INITIAL LOAD
  // ----------------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    let mounted = true;

    async function load() {
      if (!profile) {
        setMyOrders([]);
        setLoadingOrders(false);
        return;
      }

      setLoadingOrders(true);
      setLoadError(false);

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            `id, order_number, status, payment_method, subtotal, discount_amount, shipping_amount, total, shipping_address, created_at, order_items(*, products(product_images(url, is_main, position)))`
          )
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!mounted) return;

        const mapped: Order[] = (data ?? []).map((r: any) => ({
          id: r.id,
          reference: r.order_number,
          customer_name:
            (profile.first_name || "") +
            (profile.last_name ? ` ${profile.last_name}` : ""),
          customer_phone: r.shipping_address?.phone ?? "",
          status: r.status as OrderStatus,
          payment_method: r.payment_method ?? "cod",
          subtotal: getSafeNumber(r.subtotal),
          shipping: getSafeNumber(r.shipping_amount),
          discount: getSafeNumber(r.discount_amount),
          total: getSafeNumber(r.total),
          governorate: r.shipping_address?.governorate ?? "",
          created_at: r.created_at,

          items: (r.order_items ?? []).map((item: any) => {
            const images = (
              item.products?.product_images ?? []
            )
              .slice()
              .sort(
                (a: any, b: any) =>
                  Number(b.is_main) - Number(a.is_main) ||
                  (a.position ?? 0) - (b.position ?? 0)
              );

            return {
              id: item.id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              name: item.product_name,
              variant_label: item.variant_label ?? null,
              image:
                images[0]?.url ??
                mockImage(item.product_name ?? "Produit"),
              unit_price: getSafeNumber(item.unit_price),
              quantity: getSafeNumber(item.quantity, 1) || 1,
            };
          }),
        }));

        setMyOrders(mapped);
        setOpenId(mapped[0]?.id ?? null);
      } catch (error) {
        console.error("fetch orders error:", error);

        if (mounted) {
          setLoadError(true);
          setMyOrders([]);
        }
      } finally {
        if (mounted) {
          setLoadingOrders(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [profile?.id, authLoading]);

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="space-y-7 pb-8">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Mes commandes
              </h1>

              {!loadingOrders && !authLoading && (
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {totalOrders} commande{totalOrders > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Consultez votre historique et suivez vos achats.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadOrders(true)}
          disabled={loadingOrders || refreshing || authLoading}
          className="h-10 gap-2 rounded-xl"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}

          Actualiser
        </Button>
      </div>

      {/* STATS */}

      {!loadingOrders && !loadError && myOrders.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={ShoppingBag}
            label="Total des commandes"
            value={totalOrders}
            description="Historique"
          />

          <StatCard
            icon={Wallet}
            label="Montant total des achats"
            value={formatPrice(totalSpent)}
            description="Toutes commandes"
          />

          <StatCard
            icon={Truck}
            label="Commandes en cours"
            value={activeOrders}
            description="À suivre"
          />
        </div>
      )}

      {/* INFORMATION BANNER */}

      {!loadingOrders && myOrders.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageCheck className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Suivez vos commandes en temps réel
            </p>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Cliquez sur une commande pour consulter les articles,
              le récapitulatif de paiement et les étapes de livraison.
            </p>
          </div>
        </div>
      )}

      {/* ORDERS CONTENT */}

      {loadingOrders || authLoading ? (
        <OrdersSkeleton />
      ) : loadError ? (
        <div className="rounded-2xl border border-destructive/20 bg-card px-5 py-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-8 w-8" />
          </div>

          <h3 className="mt-4 text-lg font-bold text-foreground">
            Impossible de charger vos commandes
          </h3>

          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Une erreur est survenue lors de la récupération de votre historique.
            Veuillez réessayer.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadOrders()}
            className="mt-5 gap-2 rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
        </div>
      ) : myOrders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Historique de vos achats
              </h2>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Vos commandes les plus récentes apparaissent en premier.
              </p>
            </div>

            <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <Package className="h-3.5 w-3.5" />
              {totalOrders} résultat{totalOrders > 1 ? "s" : ""}
            </span>
          </div>

          <ul className="space-y-4">
            {myOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                expanded={openId === order.id}
                onToggle={() =>
                  setOpenId((previous) =>
                    previous === order.id ? null : order.id
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
