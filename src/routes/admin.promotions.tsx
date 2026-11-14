import { createFileRoute } from "@tanstack/react-router";
import React, { Fragment, useMemo , useCallback, useEffect, useRef, useState } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  Power,
  Search,
  RefreshCw,
  Tag,
  TicketPercent,
  TrendingUp,
  CalendarDays,
  Package,
  CheckCircle2,
  XCircle,
  Clock3,
  Percent,
  Wallet,
  Hash,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Layers3,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import type { Database } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import SortArrow from "@/components/ui/sort-arrow";

import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// ============================================================
// TYPES
// ============================================================

type PromoRow = Database["public"]["Tables"]["promotions"]["Row"];
type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];

type PromoWithScope = PromoRow & {
  applies_to_all?: boolean | null;
};

type ProductItem = {
  id: string;
  name: string;
  sku?: string;
};

type PromoValidation = {
  type?: string;
  value?: string;
  product?: string;
};

type CouponValidation = {
  code?: string;
  type?: string;
  value?: string;
};

type DateFilter =
  | "all"
  | "current"
  | "upcoming"
  | "ended"
  | "undated";

type StatusFilter = "all" | "active" | "inactive";

const ALL_PRODUCTS_VALUE = "__all_products__";

const PROMO_PAGE_SIZE = 10;
const COUPON_PAGE_SIZE = 10;

// ============================================================
// DEFAULT VALUES
// ============================================================

const emptyPromo: Partial<PromoRow> = {
  discount_type: "percentage",
  discount_value: 10,
  product_id: "",
  variant_id: null,
  starts_at: new Date().toISOString().slice(0, 10),
  ends_at: "",
  is_active: true,
};

const emptyCoupon: Partial<CouponRow> = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: 0,
  starts_at: new Date().toISOString().slice(0, 10),
  expires_at: "",
  max_uses: 100,
  max_uses_per_user: 1,
  used_count: 0,
  is_active: true,
};

// ============================================================
// HELPERS
// ============================================================

const getToday = () => new Date().toISOString().slice(0, 10);

const formatDateInput = (value?: string | null) =>
  value ? value.slice(0, 10) : "";

const formatPromoDate = (value?: string | null) => {
  if (!value) return "—";

  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");

  return year && month && day
    ? `${day}/${month}/${year}`
    : date;
};

const formatDiscount = (
  type?: string | null,
  value?: number | null,
) => {
  if (type === "free_shipping") {
    return "Livraison gratuite";
  }

  if (type === "percentage") {
    return `-${value ?? 0}%`;
  }

  return `-${value ?? 0} DT`;
};

const getDateStatus = (
  startsAt?: string | null,
  endsAt?: string | null,
) => {
  const today = getToday();

  if (startsAt && startsAt.slice(0, 10) > today) {
    return {
      label: "À venir",
      className:
        "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      icon: Clock3,
    };
  }

  if (endsAt && endsAt.slice(0, 10) < today) {
    return {
      label: "Terminée",
      className:
        "bg-muted text-muted-foreground border-border",
      icon: CalendarDays,
    };
  }

  return {
    label: "En cours",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    icon: CheckCircle2,
  };
};

const matchesDateFilter = (
  startsAt: string | null,
  endsAt: string | null,
  filter: DateFilter,
) => {
  const today = getToday();
  const start = startsAt?.slice(0, 10);
  const end = endsAt?.slice(0, 10);

  switch (filter) {
    case "undated":
      return !start && !end;

    case "current":
      return !!start && start <= today && (!end || end >= today);

    case "upcoming":
      return !!start && start > today;

    case "ended":
      return !!end && end < today;

    default:
      return true;
  }
};

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  active,
}: {
  active: boolean | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-red-500"
        }`}
      />

      {active ? "Actif" : "Inactif"}
    </span>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>

      <h3 className="text-base font-semibold text-foreground">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ============================================================
// PAGINATION
// ============================================================

function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Affichage{" "}
        <span className="font-semibold text-foreground">
          {start}–{end}
        </span>{" "}
        sur{" "}
        <span className="font-semibold text-foreground">
          {total}
        </span>{" "}
        résultat{total > 1 ? "s" : ""}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onPageChange(Math.max(1, page - 1));
              }}
              aria-disabled={page === 1}
              className={
                page === 1
                  ? "pointer-events-none opacity-40"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {Array.from(
            { length: totalPages },
            (_, index) => index + 1,
          )
            .filter(
              (number) =>
                number === 1 ||
                number === totalPages ||
                Math.abs(number - page) <= 1,
            )
            .map((number, index, array) => (
              <Fragment key={number}>
                {index > 0 && array[index - 1]! < number - 1 && (
                  <PaginationItem>
                    <span className="px-2 text-muted-foreground">
                      …
                    </span>
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={number === page}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(number);
                    }}
                  >
                    {number}
                  </PaginationLink>
                </PaginationItem>
              </Fragment>
            ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onPageChange(Math.min(totalPages, page + 1));
              }}
              aria-disabled={page === totalPages}
              className={
                page === totalPages
                  ? "pointer-events-none opacity-40"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
});

// ============================================================
// MAIN COMPONENT
// ============================================================

function AdminPromotions() {
  // ----------------------------------------------------------
  // DATA
  // ----------------------------------------------------------

  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [couponList, setCouponList] = useState<CouponRow[]>([]);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------------
  // DIALOGS
  // ----------------------------------------------------------

  const [promoDraft, setPromoDraft] =
    useState<Partial<PromoRow> | null>(null);

  const [couponDraft, setCouponDraft] =
    useState<Partial<CouponRow> | null>(null);

  const [promoConflict, setPromoConflict] = useState<{
    existing: PromoRow;
    draft: Partial<PromoRow>;
    payload: any;
  } | null>(null);

  const [confirmDeletePromoId, setConfirmDeletePromoId] =
    useState<string | null>(null);

  const [confirmDeleteCouponId, setConfirmDeleteCouponId] =
    useState<string | null>(null);

  const [confirmDeletePromoIds, setConfirmDeletePromoIds] =
    useState<string[]>([]);

  const [confirmDeleteCouponIds, setConfirmDeleteCouponIds] =
    useState<string[]>([]);

  const [promoStatusConfirm, setPromoStatusConfirm] =
    useState<PromoRow | null>(null);

  const [couponStatusConfirm, setCouponStatusConfirm] =
    useState<CouponRow | null>(null);

  // ----------------------------------------------------------
  // OPERATIONS
  // ----------------------------------------------------------

  const [isSavingPromo, setIsSavingPromo] = useState(false);
  const [isReplacingPromo, setIsReplacingPromo] = useState(false);
  const [isDeletingPromo, setIsDeletingPromo] = useState(false);
  const [isDeletingCoupon, setIsDeletingCoupon] = useState(false);

  const [isUpdatingPromoStatus, setIsUpdatingPromoStatus] =
    useState(false);

  const [isUpdatingCouponStatus, setIsUpdatingCouponStatus] =
    useState(false);

  const [isSavingCoupon, setIsSavingCoupon] = useState(false);

  // ----------------------------------------------------------
  // SELECTION
  // ----------------------------------------------------------

  const [selectedPromoIds, setSelectedPromoIds] =
    useState<string[]>([]);

  const [selectedCouponIds, setSelectedCouponIds] =
    useState<string[]>([]);

  // ----------------------------------------------------------
  // SEARCH AND FILTERS
  // ----------------------------------------------------------

  const [promoSearch, setPromoSearch] = useState("");
  const [promoProductSearch, setPromoProductSearch] = useState("");

  const [promoStatusFilter, setPromoStatusFilter] =
    useState<StatusFilter>("all");

  const [promoDateFilter, setPromoDateFilter] =
    useState<DateFilter>("all");

  const [couponStatusFilter, setCouponStatusFilter] =
    useState<StatusFilter>("all");

  const [couponDateFilter, setCouponDateFilter] =
    useState<DateFilter>("all");

  // ----------------------------------------------------------
  // SORTING
  // ----------------------------------------------------------

  const [promoSort, setPromoSort] =
    useState<"asc" | "desc" | null>(null);

  const [couponSortKey, setCouponSortKey] =
    useState<"value" | "minimum" | "usage">("value");

  const [couponSortDirection, setCouponSortDirection] =
    useState<"asc" | "desc" | null>(null);

  // ----------------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------------

  const [promoPage, setPromoPage] = useState(1);
  const [couponPage, setCouponPage] = useState(1);

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  const [promoValidation, setPromoValidation] =
    useState<PromoValidation>({});

  const [couponValidation, setCouponValidation] =
    useState<CouponValidation>({});

  const promoTypeRef = useRef<HTMLButtonElement>(null);
  const promoValueRef = useRef<HTMLInputElement>(null);
  const promoProductRef = useRef<HTMLButtonElement>(null);

  const couponCodeRef = useRef<HTMLInputElement>(null);
  const couponTypeRef = useRef<HTMLButtonElement>(null);
  const couponValueRef = useRef<HTMLInputElement>(null);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        { data: promoData, error: promoError },
        { data: couponData, error: couponError },
        { data: productData, error: productError },
      ] = await Promise.all([
        supabase
          .from("promotions")
          .select("*")
          .order("starts_at", { ascending: true }),

        supabase
          .from("coupons")
          .select("*")
          .order("starts_at", { ascending: true }),

        supabase
          .from("products")
          .select("id,name,sku,slug")
          .order("created_at", { ascending: false }),
      ]);

      if (promoError) throw promoError;
      if (couponError) throw couponError;
      if (productError) throw productError;

      const today = getToday();

      const expiredPromoIds = (promoData ?? [])
        .filter(
          (promo: PromoRow) =>
            promo.is_active &&
            promo.ends_at &&
            promo.ends_at.slice(0, 10) < today,
        )
        .map((promo: PromoRow) => promo.id);

      if (expiredPromoIds.length > 0) {
        const { error } = await supabase
          .from("promotions")
          .update({ is_active: false })
          .in("id", expiredPromoIds);

        if (error) throw error;
      }

      setPromos(
        (promoData ?? []).map((promo: PromoRow) =>
          expiredPromoIds.includes(promo.id)
            ? { ...promo, is_active: false }
            : promo,
        ),
      );

      setCouponList(couponData ?? []);

      setProductsList(
        (productData ?? []).map((product: any) => ({
          id: product.id,
          name: product.name ?? product.slug ?? product.id,
          sku: product.sku ?? undefined,
        })),
      );
    } catch (error) {
      console.error("load promotions/coupons", error);

      toast.error(
        "Impossible de charger les promotions et les coupons.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ==========================================================
  // PRODUCT HELPERS
  // ==========================================================

  const getProductLabel = useCallback(
    (id?: string | null) => {
      if (!id) return "Tout le catalogue";

      const product = productsList.find((item) => item.id === id);

      return product?.sku ?? product?.name ?? id.slice(0, 8);
    },
    [productsList],
  );

  const isGlobalPromo = (promo: PromoRow) =>
    Boolean((promo as PromoWithScope).applies_to_all);

  const getPromoScopeLabel = (promo: PromoRow) =>
    isGlobalPromo(promo)
      ? "Tous les produits"
      : getProductLabel(promo.product_id);

  const filteredPromoProducts = useMemo(() => {
    const query = promoProductSearch.trim().toLowerCase();

    return productsList
      .filter(
        (product) =>
          !query ||
          product.name.toLowerCase().includes(query) ||
          (product.sku ?? "").toLowerCase().includes(query),
      )
      .slice(0, 30);
  }, [productsList, promoProductSearch]);

  // ==========================================================
  // PROMOTION FILTERING
  // ==========================================================

  const filteredPromos = useMemo(() => {
    const query = promoSearch.trim().toLowerCase();

    return promos.filter((promo) => {
      const product = productsList.find(
        (item) => item.id === promo.product_id,
      );

      const searchValues = [
        product?.name,
        product?.sku,
        getProductLabel(promo.product_id),
      ];

      const matchesSearch =
        !query ||
        searchValues.some((value) =>
          value?.toLowerCase().includes(query),
        );

      const matchesStatus =
        promoStatusFilter === "all" ||
        (promoStatusFilter === "active" && promo.is_active) ||
        (promoStatusFilter === "inactive" && !promo.is_active);

      const matchesDate = matchesDateFilter(
        promo.starts_at,
        promo.ends_at,
        promoDateFilter,
      );

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [
    promos,
    productsList,
    promoSearch,
    promoStatusFilter,
    promoDateFilter,
    getProductLabel,
  ]);

  const sortedPromos = useMemo(() => {
    if (!promoSort) return filteredPromos;

    return [...filteredPromos].sort((a, b) =>
      promoSort === "asc"
        ? Number(a.discount_value) - Number(b.discount_value)
        : Number(b.discount_value) - Number(a.discount_value),
    );
  }, [filteredPromos, promoSort]);

  const promoTotalPages = Math.max(
    1,
    Math.ceil(sortedPromos.length / PROMO_PAGE_SIZE),
  );

  const paginatedPromos = useMemo(
    () =>
      sortedPromos.slice(
        (promoPage - 1) * PROMO_PAGE_SIZE,
        promoPage * PROMO_PAGE_SIZE,
      ),
    [sortedPromos, promoPage],
  );

  const allFilteredPromosSelected =
    sortedPromos.length > 0 &&
    sortedPromos.every((promo) =>
      selectedPromoIds.includes(promo.id),
    );

  // ==========================================================
  // COUPON FILTERING
  // ==========================================================

  const filteredCoupons = useMemo(
    () =>
      couponList.filter((coupon) => {
        const matchesStatus =
          couponStatusFilter === "all" ||
          (couponStatusFilter === "active" && coupon.is_active) ||
          (couponStatusFilter === "inactive" && !coupon.is_active);

        const matchesDate = matchesDateFilter(
          coupon.starts_at,
          coupon.expires_at,
          couponDateFilter,
        );

        return matchesStatus && matchesDate;
      }),
    [couponList, couponStatusFilter, couponDateFilter],
  );

  const sortedCoupons = useMemo(() => {
    if (!couponSortDirection) return filteredCoupons;

    return [...filteredCoupons].sort((a, b) => {
      const getValue = (coupon: CouponRow) => {
        switch (couponSortKey) {
          case "minimum":
            return Number(coupon.min_order_amount ?? 0);

          case "usage":
            return Number(coupon.used_count ?? 0);

          default:
            return Number(coupon.discount_value ?? 0);
        }
      };

      return couponSortDirection === "asc"
        ? getValue(a) - getValue(b)
        : getValue(b) - getValue(a);
    });
  }, [filteredCoupons, couponSortDirection, couponSortKey]);

  const couponTotalPages = Math.max(
    1,
    Math.ceil(sortedCoupons.length / COUPON_PAGE_SIZE),
  );

  const paginatedCoupons = useMemo(
    () =>
      sortedCoupons.slice(
        (couponPage - 1) * COUPON_PAGE_SIZE,
        couponPage * COUPON_PAGE_SIZE,
      ),
    [sortedCoupons, couponPage],
  );

  const allFilteredCouponsSelected =
    sortedCoupons.length > 0 &&
    sortedCoupons.every((coupon) =>
      selectedCouponIds.includes(coupon.id),
    );

  const selectedPromos = promos.filter((promo) =>
    confirmDeletePromoIds.includes(promo.id),
  );

  const selectedCoupons = couponList.filter((coupon) =>
    confirmDeleteCouponIds.includes(coupon.id),
  );

  // ==========================================================
  // PAGINATION RESET
  // ==========================================================

  useEffect(() => {
    setPromoPage(1);
  }, [
    promoSearch,
    promoStatusFilter,
    promoDateFilter,
    promoSort,
  ]);

  useEffect(() => {
    if (promoPage > promoTotalPages) {
      setPromoPage(promoTotalPages);
    }
  }, [promoPage, promoTotalPages]);

  useEffect(() => {
    setCouponPage(1);
  }, [
    couponStatusFilter,
    couponDateFilter,
    couponSortKey,
    couponSortDirection,
  ]);

  useEffect(() => {
    if (couponPage > couponTotalPages) {
      setCouponPage(couponTotalPages);
    }
  }, [couponPage, couponTotalPages]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const promoStats = useMemo(() => {
    const active = promos.filter((promo) => promo.is_active).length;

    const upcoming = promos.filter(
      (promo) =>
        promo.starts_at &&
        promo.starts_at.slice(0, 10) > getToday(),
    ).length;

    return {
      total: promos.length,
      active,
      inactive: promos.length - active,
      upcoming,
    };
  }, [promos]);

  const couponStats = useMemo(() => {
    const active = couponList.filter(
      (coupon) => coupon.is_active,
    ).length;

    const totalUsage = couponList.reduce(
      (sum, coupon) => sum + Number(coupon.used_count ?? 0),
      0,
    );

    return {
      total: couponList.length,
      active,
      inactive: couponList.length - active,
      usage: totalUsage,
    };
  }, [couponList]);

  // ==========================================================
  // SAVE PROMOTION
  // ==========================================================

  const savePromo = async () => {
    if (!promoDraft || isSavingPromo) return;

    if (!promoDraft.discount_type) {
      setPromoValidation({
        type: "Sélectionnez un type de remise.",
      });

      promoTypeRef.current?.focus();
      return;
    }

    const discountValue = Number(promoDraft.discount_value);

    if (
      promoDraft.discount_type !== "free_shipping" &&
      (!Number.isFinite(discountValue) || discountValue <= 0)
    ) {
      setPromoValidation({
        value: "Saisissez une valeur supérieure à zéro.",
      });

      promoValueRef.current?.focus();
      return;
    }

    if (
      promoDraft.discount_type === "percentage" &&
      discountValue > 100
    ) {
      setPromoValidation({
        value: "Le pourcentage ne peut pas dépasser 100%.",
      });

      promoValueRef.current?.focus();
      return;
    }

    const appliesToAllProducts =
      promoDraft.product_id === ALL_PRODUCTS_VALUE;

    const productId = appliesToAllProducts
      ? productsList[0]?.id
      : promoDraft.product_id;

    if (!productId) {
      setPromoValidation({
        product: "Sélectionnez un produit.",
      });

      promoProductRef.current?.focus();
      return;
    }

    setPromoValidation({});
    setIsSavingPromo(true);

    try {
      const payload: any = {
        discount_type: promoDraft.discount_type,
        discount_value:
          promoDraft.discount_type === "free_shipping"
            ? 0
            : discountValue,
        product_id: productId,
        variant_id: null,
        applies_to_all: appliesToAllProducts,
        starts_at: promoDraft.starts_at || null,
        ends_at: promoDraft.ends_at || null,
        is_active: promoDraft.is_active ?? true,
      };

      const targetProductIds = appliesToAllProducts
        ? productsList.map((product) => product.id)
        : [productId];

      if (targetProductIds.length === 0) {
        toast.error("Aucun produit disponible.");
        return;
      }

      const existingPromo = promos.find(
        (promo) =>
          promo.id !== promoDraft.id &&
          promo.product_id !== null &&
          targetProductIds.includes(promo.product_id),
      );

      const rowsPayload = targetProductIds.map((targetId) => ({
        ...payload,
        product_id: targetId,
      }));

      if (existingPromo) {
        setPromoConflict({
          existing: existingPromo,
          draft: promoDraft,
          payload: {
            ...payload,
            rowsPayload,
          },
        });

        return;
      }

      if (promoDraft.id) {
        // Pour une promotion globale, mettre à jour toutes les lignes
        // existantes qui lui appartiennent.
        if (isGlobalPromo(promoDraft as PromoRow) || appliesToAllProducts) {
          const existingIds = promos
            .filter(
              (promo) =>
                promo.id === promoDraft.id ||
                (isGlobalPromo(promo) &&
                  promo.product_id !== null &&
                  promos.some(
                    (item) =>
                      item.id === promoDraft.id &&
                      item.product_id === promo.product_id,
                  )),
            )
            .map((promo) => promo.id);

          const ids = Array.from(new Set(existingIds));

          const { error } = await supabase
            .from("promotions")
            .update(payload)
            .in("id", ids);

          if (error) throw error;

          setPromos((previous) =>
            previous.map((promo) =>
              ids.includes(promo.id)
                ? { ...promo, ...payload } as PromoRow
                : promo,
            ),
          );
        } else {
          const { error } = await supabase
            .from("promotions")
            .update(payload)
            .eq("id", promoDraft.id);

          if (error) throw error;

          setPromos((previous) =>
            previous.map((promo) =>
              promo.id === promoDraft.id
                ? { ...promo, ...payload } as PromoRow
                : promo,
            ),
          );
        }

        toast.success("Promotion mise à jour.");
      } else {
        const { data, error } = await supabase
          .from("promotions")
          .insert(rowsPayload)
          .select();

        if (error) throw error;

        if (data?.length) {
          setPromos((previous) => [
            ...previous,
            ...(data as PromoRow[]),
          ]);
        }

        toast.success(
          appliesToAllProducts
            ? "Promotion appliquée à tous les produits."
            : "Promotion créée.",
        );
      }

      setPromoDraft(null);
    } catch (error) {
      console.error("savePromo", error);
      toast.error("Erreur lors de l'enregistrement de la promotion.");
    } finally {
      setIsSavingPromo(false);
    }
  };

  // ==========================================================
  // REPLACE CONFLICTING PROMOTION
  // ==========================================================

  const replaceConflictingPromo = async () => {
    if (!promoConflict || isReplacingPromo) return;

    setIsReplacingPromo(true);

    try {
      const rowsPayload =
        promoConflict.payload.rowsPayload ??
        [promoConflict.payload];

      const targetProductIds = rowsPayload.map(
        (row: any) => row.product_id,
      );

      const existingIds = promos
        .filter(
          (promo) =>
            targetProductIds.includes(promo.product_id),
        )
        .map((promo) => promo.id);

      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("promotions")
          .delete()
          .in("id", existingIds);

        if (deleteError) throw deleteError;
      }

      const { data, error } = await supabase
        .from("promotions")
        .insert(rowsPayload)
        .select();

      if (error) throw error;

      setPromos((previous) => [
        ...previous.filter(
          (promo) => !existingIds.includes(promo.id),
        ),
        ...(data as PromoRow[] ?? []),
      ]);

      setPromoConflict(null);
      setPromoDraft(null);

      toast.success(
        "L'ancienne promotion a été remplacée.",
      );
    } catch (error) {
      console.error("replace promotion", error);
      toast.error(
        "Impossible de remplacer l'ancienne promotion.",
      );
    } finally {
      setIsReplacingPromo(false);
    }
  };

  // ==========================================================
  // DELETE PROMOTION
  // ==========================================================

  const handleDeletePromo = async (id: string) => {
    if (!id || isDeletingPromo) return;

    setIsDeletingPromo(true);

    try {
      const { error } = await supabase
        .from("promotions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPromos((previous) =>
        previous.filter((promo) => promo.id !== id),
      );

      setSelectedPromoIds((previous) =>
        previous.filter((selectedId) => selectedId !== id),
      );

      toast.success("Promotion supprimée.");
    } catch (error) {
      console.error("delete promo", error);
      toast.error("Impossible de supprimer la promotion.");
    } finally {
      setIsDeletingPromo(false);
      setConfirmDeletePromoId(null);
    }
  };

  // ==========================================================
  // BULK DELETE PROMOTIONS
  // ==========================================================

  const handleDeleteSelectedPromos = async () => {
    if (
      confirmDeletePromoIds.length === 0 ||
      isDeletingPromo
    ) {
      return;
    }

    setIsDeletingPromo(true);

    try {
      const ids = [...confirmDeletePromoIds];

      const { error } = await supabase
        .from("promotions")
        .delete()
        .in("id", ids);

      if (error) throw error;

      const deletedIds = new Set(ids);

      setPromos((previous) =>
        previous.filter((promo) => !deletedIds.has(promo.id)),
      );

      setSelectedPromoIds((previous) =>
        previous.filter((id) => !deletedIds.has(id)),
      );

      toast.success(
        `${ids.length} promotion${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}.`,
      );

      setConfirmDeletePromoIds([]);
    } catch (error) {
      console.error("delete selected promos", error);
      toast.error(
        "Impossible de supprimer les promotions sélectionnées.",
      );
    } finally {
      setIsDeletingPromo(false);
    }
  };

  // ==========================================================
  // TOGGLE PROMOTION STATUS
  // ==========================================================

  const togglePromoStatus = async (promo: PromoRow) => {
    if (isUpdatingPromoStatus) return false;

    const nextStatus = !promo.is_active;

    setIsUpdatingPromoStatus(true);

    setPromos((previous) =>
      previous.map((item) =>
        item.id === promo.id
          ? { ...item, is_active: nextStatus }
          : item,
      ),
    );

    try {
      const { error } = await supabase
        .from("promotions")
        .update({ is_active: nextStatus })
        .eq("id", promo.id);

      if (error) throw error;

      toast.success(
        nextStatus
          ? "Promotion activée."
          : "Promotion désactivée.",
      );

      return true;
    } catch (error) {
      console.error("toggle promo status", error);

      setPromos((previous) =>
        previous.map((item) =>
          item.id === promo.id
            ? { ...item, is_active: promo.is_active }
            : item,
        ),
      );

      toast.error(
        "Impossible de modifier le statut de la promotion.",
      );

      return false;
    } finally {
      setIsUpdatingPromoStatus(false);
    }
  };

  // ==========================================================
  // SAVE COUPON
  // ==========================================================

  const saveCoupon = async () => {
    if (!couponDraft || isSavingCoupon) return;

    if (!couponDraft.code?.trim()) {
      setCouponValidation({
        code: "Le code est obligatoire.",
      });

      couponCodeRef.current?.focus();
      return;
    }

    if (!couponDraft.discount_type) {
      setCouponValidation({
        type: "Le type est obligatoire.",
      });

      couponTypeRef.current?.focus();
      return;
    }

    const discountValue = Number(couponDraft.discount_value);

    if (
      couponDraft.discount_type !== "free_shipping" &&
      (!Number.isFinite(discountValue) || discountValue <= 0)
    ) {
      setCouponValidation({
        value: "La valeur doit être supérieure à zéro.",
      });

      couponValueRef.current?.focus();
      return;
    }

    if (
      couponDraft.discount_type === "percentage" &&
      discountValue > 100
    ) {
      setCouponValidation({
        value: "Le pourcentage ne peut pas dépasser 100%.",
      });

      couponValueRef.current?.focus();
      return;
    }

    setCouponValidation({});
    setIsSavingCoupon(true);

    try {
      const payload: any = {
        code: couponDraft.code.trim().toUpperCase(),
        discount_type: couponDraft.discount_type,
        discount_value:
          couponDraft.discount_type === "free_shipping"
            ? 0
            : discountValue,
        min_order_amount: couponDraft.min_order_amount ?? 0,
        starts_at: couponDraft.starts_at || null,
        expires_at: couponDraft.expires_at || null,
        max_uses: couponDraft.max_uses ?? null,
        max_uses_per_user:
          couponDraft.max_uses_per_user ?? null,
        used_count: couponDraft.used_count ?? 0,
        is_active: couponDraft.is_active ?? true,
      };

      if (couponDraft.id) {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", couponDraft.id);

        if (error) throw error;

        setCouponList((previous) =>
          previous.map((coupon) =>
            coupon.id === couponDraft.id
              ? { ...coupon, ...payload } as CouponRow
              : coupon,
          ),
        );

        toast.success("Coupon mis à jour.");
      } else {
        const { data, error } = await supabase
          .from("coupons")
          .insert(payload)
          .select()
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCouponList((previous) => [
            ...previous,
            data as CouponRow,
          ]);
        }

        toast.success("Coupon créé.");
      }

      setCouponDraft(null);
    } catch (error: any) {
      console.error("saveCoupon", error);

      if (error?.code === "23505") {
        toast.error("Ce code coupon existe déjà.");
      } else {
        toast.error(
          "Erreur lors de l'enregistrement du coupon.",
        );
      }
    } finally {
      setIsSavingCoupon(false);
    }
  };

  // ==========================================================
  // DELETE COUPON
  // ==========================================================

  const handleDeleteCoupon = async (id: string) => {
    if (!id || isDeletingCoupon) return;

    setIsDeletingCoupon(true);

    try {
      const { count, error: usageError } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", id);

      if (usageError) throw usageError;

      if ((count ?? 0) > 0) {
        const { error } = await supabase
          .from("coupons")
          .update({ is_active: false })
          .eq("id", id);

        if (error) throw error;

        setCouponList((previous) =>
          previous.map((coupon) =>
            coupon.id === id
              ? { ...coupon, is_active: false }
              : coupon,
          ),
        );

        toast.success(
          "Coupon utilisé : il a été désactivé et conservé pour l'historique des commandes.",
        );
      } else {
        const { error } = await supabase
          .from("coupons")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setCouponList((previous) =>
          previous.filter((coupon) => coupon.id !== id),
        );

        setSelectedCouponIds((previous) =>
          previous.filter((selectedId) => selectedId !== id),
        );

        toast.success("Coupon supprimé.");
      }
    } catch (error) {
      console.error("delete coupon", error);
      toast.error("Impossible de supprimer le coupon.");
    } finally {
      setIsDeletingCoupon(false);
      setConfirmDeleteCouponId(null);
    }
  };

  // ==========================================================
  // BULK DELETE COUPONS
  // ==========================================================

  const handleDeleteSelectedCoupons = async () => {
    if (
      confirmDeleteCouponIds.length === 0 ||
      isDeletingCoupon
    ) {
      return;
    }

    setIsDeletingCoupon(true);

    try {
      const ids = [...confirmDeleteCouponIds];

      const { data: usedOrders, error: usageError } =
        await supabase
          .from("orders")
          .select("coupon_id")
          .in("coupon_id", ids);

      if (usageError) throw usageError;

      const usedIds = new Set(
        (usedOrders ?? [])
          .map((order) => order.coupon_id)
          .filter((id): id is string => id !== null),
      );

      const unusedIds = ids.filter(
        (id) => !usedIds.has(id),
      );

      if (unusedIds.length > 0) {
        const { error } = await supabase
          .from("coupons")
          .delete()
          .in("id", unusedIds);

        if (error) throw error;
      }

      if (usedIds.size > 0) {
        const { error } = await supabase
          .from("coupons")
          .update({ is_active: false })
          .in("id", [...usedIds]);

        if (error) throw error;
      }

      const deletedIds = new Set(unusedIds);

      setCouponList((previous) =>
        previous
          .filter((coupon) => !deletedIds.has(coupon.id))
          .map((coupon) =>
            usedIds.has(coupon.id)
              ? { ...coupon, is_active: false }
              : coupon,
          ),
      );

      setSelectedCouponIds((previous) =>
        previous.filter((id) => !deletedIds.has(id)),
      );

      toast.success(
        `${unusedIds.length} coupon${unusedIds.length > 1 ? "s" : ""} supprimé${unusedIds.length > 1 ? "s" : ""} et ${usedIds.size} conservé${usedIds.size > 1 ? "s" : ""} puis désactivé${usedIds.size > 1 ? "s" : ""}.`,
      );

      setConfirmDeleteCouponIds([]);
    } catch (error) {
      console.error("delete selected coupons", error);
      toast.error(
        "Impossible de supprimer les coupons sélectionnés.",
      );
    } finally {
      setIsDeletingCoupon(false);
    }
  };

  // ==========================================================
  // TOGGLE COUPON STATUS
  // ==========================================================

  const toggleCouponStatus = async (coupon: CouponRow) => {
    if (isUpdatingCouponStatus) return false;

    const nextStatus = !coupon.is_active;

    setIsUpdatingCouponStatus(true);

    setCouponList((previous) =>
      previous.map((item) =>
        item.id === coupon.id
          ? { ...item, is_active: nextStatus }
          : item,
      ),
    );

    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: nextStatus })
        .eq("id", coupon.id);

      if (error) throw error;

      toast.success(
        nextStatus ? "Coupon activé." : "Coupon désactivé.",
      );

      return true;
    } catch (error) {
      console.error("toggle coupon status", error);

      setCouponList((previous) =>
        previous.map((item) =>
          item.id === coupon.id
            ? { ...item, is_active: coupon.is_active }
            : item,
        ),
      );

      toast.error(
        "Impossible de modifier le statut du coupon.",
      );

      return false;
    } finally {
      setIsUpdatingCouponStatus(false);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-w-0 space-y-6 pb-8">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketPercent className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Promotions & coupons
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Gérez vos remises catalogue et vos codes promotionnels.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-2 self-start sm:self-auto"
          onClick={() => void loadData(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          Actualiser
        </Button>
      </div>

      {/* ======================================================
          GLOBAL STATISTICS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total promotions"
          value={promoStats.total}
          description="Promotions enregistrées"
          icon={Tag}
          iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />

        <StatCard
          title="Promotions actives"
          value={promoStats.active}
          description="Promotions activées"
          icon={TrendingUp}
          iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />

        <StatCard
          title="Total coupons"
          value={couponStats.total}
          description="Codes promotionnels"
          icon={TicketPercent}
          iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />

        <StatCard
          title="Utilisations coupons"
          value={couponStats.usage}
          description="Nombre total d'utilisations"
          icon={Sparkles}
          iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ======================================================
          MAIN TABS
      ====================================================== */}

      <Tabs defaultValue="promotions" className="space-y-5">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted p-1 sm:w-auto">
            <TabsTrigger
              value="promotions"
              className="gap-2 rounded-lg px-5"
            >
              <Tag className="h-4 w-4" />
              Promotions
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-xs">
                {promos.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="coupons"
              className="gap-2 rounded-lg px-5"
            >
              <TicketPercent className="h-4 w-4" />
              Coupons
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-xs">
                {couponList.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ====================================================
            PROMOTIONS TAB
        ==================================================== */}

        <TabsContent value="promotions" className="mt-0 space-y-5">

          {/* PROMOTION SUB-STATS */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Actives
                </p>
                <p className="text-lg font-bold">
                  {promoStats.active}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Clock3 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  À venir
                </p>
                <p className="text-lg font-bold">
                  {promoStats.upcoming}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Inactives
                </p>
                <p className="text-lg font-bold">
                  {promoStats.inactive}
                </p>
              </div>
            </div>
          </div>

          {/* PROMOTION TOOLBAR */}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_170px_170px]">
                <div className="relative sm:col-span-2 xl:col-span-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={promoSearch}
                    onChange={(event) =>
                      setPromoSearch(event.target.value)
                    }
                    placeholder="Rechercher un produit..."
                    className="h-10 pl-9 pr-9"
                  />

                  {promoSearch && (
                    <button
                      type="button"
                      onClick={() => setPromoSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Select
                  value={promoStatusFilter}
                  onValueChange={(value) =>
                    setPromoStatusFilter(value as StatusFilter)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Tous les statuts
                    </SelectItem>
                    <SelectItem value="active">
                      Actives
                    </SelectItem>
                    <SelectItem value="inactive">
                      Inactives
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={promoDateFilter}
                  onValueChange={(value) =>
                    setPromoDateFilter(value as DateFilter)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Période" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Toutes les dates
                    </SelectItem>
                    <SelectItem value="current">
                      En cours
                    </SelectItem>
                    <SelectItem value="upcoming">
                      À venir
                    </SelectItem>
                    <SelectItem value="ended">
                      Terminées
                    </SelectItem>
                    <SelectItem value="undated">
                      Sans date
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="accent"
                className="h-10 gap-2 shadow-sm"
                onClick={() => {
                  setPromoDraft({ ...emptyPromo });
                  setPromoProductSearch("");
                  setPromoValidation({});
                }}
              >
                <Plus className="h-4 w-4" />
                Nouvelle promotion
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {sortedPromos.length} résultat
                {sortedPromos.length > 1 ? "s" : ""} trouvé
                {sortedPromos.length > 1 ? "s" : ""}
              </p>

              {(promoSearch ||
                promoStatusFilter !== "all" ||
                promoDateFilter !== "all") && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    setPromoSearch("");
                    setPromoStatusFilter("all");
                    setPromoDateFilter("all");
                  }}
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>

          {/* BULK ACTION */}

          {selectedPromoIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <CheckCircle2 className="h-4 w-4" />
                </div>

                <span className="font-semibold">
                  {selectedPromoIds.length} promotion
                  {selectedPromoIds.length > 1 ? "s" : ""} sélectionnée
                  {selectedPromoIds.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedPromoIds([])}
                >
                  Annuler
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  onClick={() =>
                    setConfirmDeletePromoIds(selectedPromoIds)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer la sélection
                </Button>
              </div>
            </div>
          )}

          {/* PROMOTION TABLE */}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-foreground">
                  Liste des promotions
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Consultez et gérez vos remises produits.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                <Layers3 className="h-3.5 w-3.5" />
                {promos.length} promotions
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 pl-5">
                      <Checkbox
                        aria-label="Sélectionner toutes les promotions filtrées"
                        checked={allFilteredPromosSelected}
                        onCheckedChange={(checked) => {
                          setSelectedPromoIds((current) => {
                            if (checked) {
                              return Array.from(
                                new Set([
                                  ...current,
                                  ...sortedPromos.map(
                                    (promo) => promo.id,
                                  ),
                                ]),
                              );
                            }

                            const filteredIds = new Set(
                              sortedPromos.map((promo) => promo.id),
                            );

                            return current.filter(
                              (id) => !filteredIds.has(id),
                            );
                          });
                        }}
                      />
                    </TableHead>

                    <TableHead className="min-w-[220px]">
                      Produit
                    </TableHead>

                    <TableHead className="min-w-[110px]">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 font-medium"
                        onClick={() =>
                          setPromoSort((current) =>
                            current === "asc" ? "desc" : "asc",
                          )
                        }
                      >
                        Remise
                        <SortArrow
                          dir={promoSort}
                          ariaLabel="Trier par remise"
                        />
                      </button>
                    </TableHead>

                    <TableHead className="min-w-[115px]">
                      Période
                    </TableHead>

                    <TableHead className="min-w-[180px]">
                      Validité
                    </TableHead>

                    <TableHead className="min-w-[110px]">
                      Statut
                    </TableHead>

                    <TableHead className="w-[110px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16">
                        <div className="flex justify-center">
                          <Spinner showLabel />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedPromos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          title="Aucune promotion trouvée"
                          description="Aucune promotion ne correspond aux filtres sélectionnés."
                          icon={Tag}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPromos.map((promo) => {
                      const dateStatus = getDateStatus(
                        promo.starts_at,
                        promo.ends_at,
                      );

                      return (
                        <TableRow
                          key={promo.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="pl-5">
                            <Checkbox
                              aria-label={`Sélectionner ${getProductLabel(promo.product_id)}`}
                              checked={selectedPromoIds.includes(
                                promo.id,
                              )}
                              onCheckedChange={(checked) => {
                                setSelectedPromoIds((current) =>
                                  checked
                                    ? [...current, promo.id]
                                    : current.filter(
                                        (id) => id !== promo.id,
                                      ),
                                );
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Package className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {getPromoScopeLabel(promo)}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {isGlobalPromo(promo)
                                    ? "Promotion globale"
                                    : "Promotion produit"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-bold text-primary">
                              {formatDiscount(
                                promo.discount_type,
                                promo.discount_value,
                              )}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${dateStatus.className}`}
                            >
                              <dateStatus.icon className="h-3.5 w-3.5" />
                              {dateStatus.label}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium text-foreground">
                                {formatPromoDate(promo.starts_at)}
                              </p>

                              <p className="text-muted-foreground">
                                au {formatPromoDate(promo.ends_at)}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <StatusBadge active={promo.is_active} />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Modifier"
                                aria-label="Modifier la promotion"
                                onClick={() => {
                                  setPromoDraft({
                                    ...promo,
                                    product_id: isGlobalPromo(promo)
                                      ? ALL_PRODUCTS_VALUE
                                      : promo.product_id,
                                  });

                                  setPromoProductSearch("");
                                  setPromoValidation({});
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${
                                  promo.is_active
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-muted-foreground"
                                }`}
                                title={
                                  promo.is_active
                                    ? "Désactiver"
                                    : "Activer"
                                }
                                aria-label={
                                  promo.is_active
                                    ? "Désactiver la promotion"
                                    : "Activer la promotion"
                                }
                                onClick={() =>
                                  setPromoStatusConfirm(promo)
                                }
                              >
                                <Power className="h-4 w-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Supprimer"
                                aria-label="Supprimer la promotion"
                                onClick={() =>
                                  setConfirmDeletePromoId(promo.id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && (
              <TablePagination
                page={promoPage}
                totalPages={promoTotalPages}
                total={sortedPromos.length}
                pageSize={PROMO_PAGE_SIZE}
                onPageChange={setPromoPage}
              />
            )}
          </div>
        </TabsContent>

        {/* ====================================================
            COUPONS TAB
        ==================================================== */}

        <TabsContent value="coupons" className="mt-0 space-y-5">

          {/* COUPON SUB-STATS */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Coupons actifs
                </p>
                <p className="text-lg font-bold">
                  {couponStats.active}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Coupons inactifs
                </p>
                <p className="text-lg font-bold">
                  {couponStats.inactive}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Hash className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Utilisations
                </p>
                <p className="text-lg font-bold">
                  {couponStats.usage}
                </p>
              </div>
            </div>
          </div>

          {/* COUPON TOOLBAR */}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[170px_170px]">
                <Select
                  value={couponStatusFilter}
                  onValueChange={(value) =>
                    setCouponStatusFilter(value as StatusFilter)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Tous les statuts
                    </SelectItem>
                    <SelectItem value="active">
                      Actifs
                    </SelectItem>
                    <SelectItem value="inactive">
                      Inactifs
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={couponDateFilter}
                  onValueChange={(value) =>
                    setCouponDateFilter(value as DateFilter)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Période" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Toutes les dates
                    </SelectItem>
                    <SelectItem value="current">
                      En cours
                    </SelectItem>
                    <SelectItem value="upcoming">
                      À venir
                    </SelectItem>
                    <SelectItem value="ended">
                      Terminés
                    </SelectItem>
                    <SelectItem value="undated">
                      Sans date
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="accent"
                className="h-10 gap-2 shadow-sm"
                onClick={() => {
                  setCouponDraft({ ...emptyCoupon });
                  setCouponValidation({});
                }}
              >
                <Plus className="h-4 w-4" />
                Nouveau coupon
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {sortedCoupons.length} résultat
                {sortedCoupons.length > 1 ? "s" : ""} trouvé
                {sortedCoupons.length > 1 ? "s" : ""}
              </p>

              {(couponStatusFilter !== "all" ||
                couponDateFilter !== "all") && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    setCouponStatusFilter("all");
                    setCouponDateFilter("all");
                  }}
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>

          {/* COUPON BULK ACTION */}

          {selectedCouponIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <CheckCircle2 className="h-4 w-4" />
                </div>

                <span className="font-semibold">
                  {selectedCouponIds.length} coupon
                  {selectedCouponIds.length > 1 ? "s" : ""} sélectionné
                  {selectedCouponIds.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCouponIds([])}
                >
                  Annuler
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  onClick={() =>
                    setConfirmDeleteCouponIds(selectedCouponIds)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer la sélection
                </Button>
              </div>
            </div>
          )}

          {/* COUPON TABLE */}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-foreground">
                  Liste des coupons
                </h2>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Consultez les codes promo et leur utilisation.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                <TicketPercent className="h-3.5 w-3.5" />
                {couponList.length} coupons
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 pl-5">
                      <Checkbox
                        aria-label="Sélectionner tous les coupons filtrés"
                        checked={allFilteredCouponsSelected}
                        onCheckedChange={(checked) => {
                          setSelectedCouponIds((current) => {
                            if (checked) {
                              return Array.from(
                                new Set([
                                  ...current,
                                  ...sortedCoupons.map(
                                    (coupon) => coupon.id,
                                  ),
                                ]),
                              );
                            }

                            const filteredIds = new Set(
                              sortedCoupons.map((coupon) => coupon.id),
                            );

                            return current.filter(
                              (id) => !filteredIds.has(id),
                            );
                          });
                        }}
                      />
                    </TableHead>

                    <TableHead className="min-w-[160px]">
                      Code
                    </TableHead>

                    {(
                      ["value", "minimum", "usage"] as const
                    ).map((key) => {
                      const labels = {
                        value: "Valeur",
                        minimum: "Minimum",
                        usage: "Utilisations",
                      };

                      const active =
                        couponSortKey === key &&
                        couponSortDirection !== null;

                      return (
                        <TableHead key={key} className="min-w-[115px]">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 font-medium"
                            onClick={() => {
                              setCouponSortKey(key);

                              setCouponSortDirection((current) =>
                                couponSortKey === key
                                  ? current === "asc"
                                    ? "desc"
                                    : "asc"
                                  : "asc",
                              );
                            }}
                          >
                            {labels[key]}

                            <SortArrow
                              dir={
                                active
                                  ? couponSortDirection
                                  : null
                              }
                              ariaLabel={`Trier par ${labels[key]}`}
                            />
                          </button>
                        </TableHead>
                      );
                    })}

                    <TableHead className="min-w-[175px]">
                      Validité
                    </TableHead>

                    <TableHead className="min-w-[115px]">
                      Période
                    </TableHead>

                    <TableHead className="min-w-[105px]">
                      Statut
                    </TableHead>

                    <TableHead className="w-[110px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16">
                        <div className="flex justify-center">
                          <Spinner showLabel />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedCoupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState
                          title="Aucun coupon trouvé"
                          description="Aucun coupon ne correspond aux filtres sélectionnés."
                          icon={TicketPercent}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCoupons.map((coupon) => {
                      const dateStatus = getDateStatus(
                        coupon.starts_at,
                        coupon.expires_at,
                      );

                      return (
                        <TableRow
                          key={coupon.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="pl-5">
                            <Checkbox
                              aria-label={`Sélectionner le coupon ${coupon.code}`}
                              checked={selectedCouponIds.includes(
                                coupon.id,
                              )}
                              onCheckedChange={(checked) => {
                                setSelectedCouponIds((current) =>
                                  checked
                                    ? [...current, coupon.id]
                                    : current.filter(
                                        (id) => id !== coupon.id,
                                      ),
                                );
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                                <TicketPercent className="h-4 w-4" />
                              </div>

                              <span className="font-mono text-sm font-bold tracking-wide text-foreground">
                                {coupon.code}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="inline-flex rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-bold text-primary">
                              {formatDiscount(
                                coupon.discount_type,
                                coupon.discount_value,
                              )}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-sm font-medium text-foreground">
                              {Number(
                                coupon.min_order_amount ?? 0,
                              ).toFixed(2)}{" "}
                              DT
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {coupon.used_count ?? 0}
                              </span>

                              <span className="text-xs text-muted-foreground">
                                / {coupon.max_uses ?? "∞"}
                              </span>
                            </div>

                            {coupon.max_uses &&
                              coupon.max_uses > 0 && (
                                <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        ((coupon.used_count ?? 0) /
                                          coupon.max_uses) *
                                          100,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              )}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium text-foreground">
                                {formatPromoDate(coupon.starts_at)}
                              </p>

                              <p className="text-muted-foreground">
                                au {formatPromoDate(coupon.expires_at)}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${dateStatus.className}`}
                            >
                              <dateStatus.icon className="h-3.5 w-3.5" />
                              {dateStatus.label}
                            </span>
                          </TableCell>

                          <TableCell>
                            <StatusBadge active={coupon.is_active} />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Modifier"
                                aria-label="Modifier le coupon"
                                onClick={() => {
                                  setCouponDraft({ ...coupon });
                                  setCouponValidation({});
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${
                                  coupon.is_active
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-muted-foreground"
                                }`}
                                title={
                                  coupon.is_active
                                    ? "Désactiver"
                                    : "Activer"
                                }
                                aria-label={
                                  coupon.is_active
                                    ? "Désactiver le coupon"
                                    : "Activer le coupon"
                                }
                                onClick={() =>
                                  setCouponStatusConfirm(coupon)
                                }
                              >
                                <Power className="h-4 w-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Supprimer"
                                aria-label="Supprimer le coupon"
                                onClick={() =>
                                  setConfirmDeleteCouponId(coupon.id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && (
              <TablePagination
                page={couponPage}
                totalPages={couponTotalPages}
                total={sortedCoupons.length}
                pageSize={COUPON_PAGE_SIZE}
                onPageChange={setCouponPage}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ======================================================
          PROMOTION FORM DIALOG
      ====================================================== */}

      <Dialog
        open={promoDraft !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingPromo) {
            setPromoDraft(null);
            setPromoValidation({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>

            <DialogTitle className="text-xl">
              {promoDraft?.id
                ? "Modifier la promotion"
                : "Nouvelle promotion"}
            </DialogTitle>

            <p className="text-sm text-muted-foreground">
              Configurez la remise et sa période de validité.
            </p>
          </DialogHeader>

          {promoDraft && (
            <div className="grid gap-5 py-3 sm:grid-cols-2">

              <div className="space-y-2">
                <Label>Type de remise *</Label>

                <Select
                  value={promoDraft.discount_type ?? "percentage"}
                  onValueChange={(value) =>
                    setPromoDraft({
                      ...promoDraft,
                      discount_type: value,
                    })
                  }
                >
                  <SelectTrigger
                    ref={promoTypeRef}
                    aria-invalid={Boolean(promoValidation.type)}
                    className={
                      promoValidation.type
                        ? "border-destructive"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Type de remise" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="percentage">
                      Pourcentage
                    </SelectItem>

                    <SelectItem value="fixed">
                      Montant fixe
                    </SelectItem>

                    <SelectItem value="free_shipping">
                      Livraison gratuite
                    </SelectItem>
                  </SelectContent>
                </Select>

                {promoValidation.type && (
                  <p className="text-xs text-destructive">
                    {promoValidation.type}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Valeur{" "}
                  {promoDraft.discount_type === "percentage"
                    ? "(%)"
                    : "(DT)"}{" "}
                  {promoDraft.discount_type !== "free_shipping" &&
                    "*"}
                </Label>

                <Input
                  ref={promoValueRef}
                  type="number"
                  min="0"
                  max={
                    promoDraft.discount_type === "percentage"
                      ? 100
                      : undefined
                  }
                  disabled={
                    promoDraft.discount_type === "free_shipping"
                  }
                  value={promoDraft.discount_value ?? 0}
                  aria-invalid={Boolean(promoValidation.value)}
                  className={
                    promoValidation.value
                      ? "border-destructive"
                      : ""
                  }
                  onChange={(event) => {
                    setPromoDraft({
                      ...promoDraft,
                      discount_value: Number(event.target.value),
                    });

                    setPromoValidation(({
                      value: _value,
                      ...rest
                    }) => rest);
                  }}
                />

                {promoValidation.value && (
                  <p className="text-xs text-destructive">
                    {promoValidation.value}
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Produit concerné *</Label>

                <Select
                  value={
                    promoDraft.product_id === null
                      ? ALL_PRODUCTS_VALUE
                      : promoDraft.product_id ?? ""
                  }
                  onValueChange={(value) => {
                    setPromoDraft({
                      ...promoDraft,
                      product_id: value,
                    });

                    setPromoValidation(({
                      product: _product,
                      ...rest
                    }) => rest);
                  }}
                >
                  <SelectTrigger
                    ref={promoProductRef}
                    aria-invalid={Boolean(promoValidation.product)}
                    className={
                      promoValidation.product
                        ? "border-destructive"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>

                  <SelectContent>
                    <div
                      className="p-2"
                      onKeyDown={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <Input
                        value={promoProductSearch}
                        onChange={(event) =>
                          setPromoProductSearch(event.target.value)
                        }
                        placeholder="Rechercher un produit ou SKU..."
                        aria-label="Rechercher un produit"
                      />
                    </div>

                    <SelectItem value={ALL_PRODUCTS_VALUE}>
                      <span className="flex items-center gap-2">
                        <Layers3 className="h-4 w-4" />
                        Tous les produits
                      </span>
                    </SelectItem>

                    {filteredPromoProducts.map((product) => (
                      <SelectItem
                        key={product.id}
                        value={product.id}
                      >
                        {product.sku
                          ? `${product.sku} — ${product.name}`
                          : product.name}
                      </SelectItem>
                    ))}

                    {filteredPromoProducts.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Aucun produit trouvé.
                      </div>
                    )}
                  </SelectContent>
                </Select>

                {promoValidation.product && (
                  <p className="text-xs text-destructive">
                    {promoValidation.product}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Choisissez un produit précis ou appliquez la remise à tout le catalogue.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date de début</Label>

                <Input
                  type="date"
                  value={formatDateInput(promoDraft.starts_at)}
                  onChange={(event) =>
                    setPromoDraft({
                      ...promoDraft,
                      starts_at: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>

                <Input
                  type="date"
                  min={formatDateInput(promoDraft.starts_at)}
                  value={formatDateInput(promoDraft.ends_at)}
                  onChange={(event) =>
                    setPromoDraft({
                      ...promoDraft,
                      ends_at: event.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Power className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Promotion active
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Autoriser l'application de cette remise.
                    </p>
                  </div>
                </div>

                <Switch
                  checked={!!promoDraft.is_active}
                  onCheckedChange={(value) =>
                    setPromoDraft({
                      ...promoDraft,
                      is_active: value,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setPromoDraft(null)}
              disabled={isSavingPromo}
            >
              Annuler
            </Button>

            <Button
              variant="accent"
              onClick={savePromo}
              disabled={isSavingPromo}
              className="gap-2"
            >
              {isSavingPromo ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          COUPON FORM DIALOG
      ====================================================== */}

      <Dialog
        open={couponDraft !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingCoupon) {
            setCouponDraft(null);
            setCouponValidation({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
              <TicketPercent className="h-5 w-5" />
            </div>

            <DialogTitle className="text-xl">
              {couponDraft?.id
                ? "Modifier le coupon"
                : "Nouveau coupon"}
            </DialogTitle>

            <p className="text-sm text-muted-foreground">
              Définissez les paramètres du code promotionnel.
            </p>
          </DialogHeader>

          {couponDraft && (
            <div className="grid gap-5 py-3 sm:grid-cols-2">

              <div className="space-y-2">
                <Label>Code promotionnel *</Label>

                <Input
                  ref={couponCodeRef}
                  value={couponDraft.code ?? ""}
                  placeholder="EXEMPLE2026"
                  className={`font-mono uppercase ${
                    couponValidation.code
                      ? "border-destructive"
                      : ""
                  }`}
                  aria-invalid={Boolean(couponValidation.code)}
                  onChange={(event) => {
                    setCouponDraft({
                      ...couponDraft,
                      code: event.target.value.toUpperCase(),
                    });

                    setCouponValidation(({
                      code: _code,
                      ...rest
                    }) => rest);
                  }}
                />

                {couponValidation.code && (
                  <p className="text-xs text-destructive">
                    {couponValidation.code}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type de remise *</Label>

                <Select
                  value={couponDraft.discount_type ?? "percentage"}
                  onValueChange={(value) => {
                    setCouponDraft({
                      ...couponDraft,
                      discount_type: value,
                    });

                    setCouponValidation(({
                      type: _type,
                      ...rest
                    }) => rest);
                  }}
                >
                  <SelectTrigger
                    ref={couponTypeRef}
                    aria-invalid={Boolean(couponValidation.type)}
                    className={
                      couponValidation.type
                        ? "border-destructive"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Type de remise" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="percentage">
                      Pourcentage
                    </SelectItem>

                    <SelectItem value="fixed">
                      Montant fixe
                    </SelectItem>

                    <SelectItem value="free_shipping">
                      Livraison gratuite
                    </SelectItem>
                  </SelectContent>
                </Select>

                {couponValidation.type && (
                  <p className="text-xs text-destructive">
                    {couponValidation.type}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Valeur{" "}
                  {couponDraft.discount_type === "percentage"
                    ? "(%)"
                    : "(DT)"}
                </Label>

                <Input
                  ref={couponValueRef}
                  type="number"
                  min="0"
                  max={
                    couponDraft.discount_type === "percentage"
                      ? 100
                      : undefined
                  }
                  disabled={
                    couponDraft.discount_type === "free_shipping"
                  }
                  value={couponDraft.discount_value ?? 0}
                  className={
                    couponValidation.value
                      ? "border-destructive"
                      : ""
                  }
                  aria-invalid={Boolean(couponValidation.value)}
                  onChange={(event) => {
                    setCouponDraft({
                      ...couponDraft,
                      discount_value: Number(event.target.value),
                    });

                    setCouponValidation(({
                      value: _value,
                      ...rest
                    }) => rest);
                  }}
                />

                {couponValidation.value && (
                  <p className="text-xs text-destructive">
                    {couponValidation.value}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Montant minimum (DT)</Label>

                <Input
                  type="number"
                  min="0"
                  value={couponDraft.min_order_amount ?? 0}
                  onChange={(event) =>
                    setCouponDraft({
                      ...couponDraft,
                      min_order_amount: Number(event.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Date de début</Label>

                <Input
                  type="date"
                  value={formatDateInput(couponDraft.starts_at)}
                  onChange={(event) =>
                    setCouponDraft({
                      ...couponDraft,
                      starts_at: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Date d'expiration</Label>

                <Input
                  type="date"
                  min={formatDateInput(couponDraft.starts_at)}
                  value={formatDateInput(couponDraft.expires_at)}
                  onChange={(event) =>
                    setCouponDraft({
                      ...couponDraft,
                      expires_at: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Limite totale d'utilisation</Label>

                <Input
                  type="number"
                  min="0"
                  placeholder="Illimitée"
                  value={couponDraft.max_uses ?? ""}
                  onChange={(event) =>
                    setCouponDraft({
                      ...couponDraft,
                      max_uses:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />

                <p className="text-xs text-muted-foreground">
                  Laisser vide pour une utilisation illimitée.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Limite par utilisateur</Label>

                <Input
                  type="number"
                  min="1"
                  value={couponDraft.max_uses_per_user ?? 1}
                  onChange={(event) =>
                    setCouponDraft({
                      ...couponDraft,
                      max_uses_per_user: Number(event.target.value),
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Power className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Coupon actif
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Autoriser l'utilisation de ce code.
                    </p>
                  </div>
                </div>

                <Switch
                  checked={!!couponDraft.is_active}
                  onCheckedChange={(value) =>
                    setCouponDraft({
                      ...couponDraft,
                      is_active: value,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setCouponDraft(null)}
              disabled={isSavingCoupon}
            >
              Annuler
            </Button>

            <Button
              variant="accent"
              onClick={saveCoupon}
              disabled={isSavingCoupon}
              className="gap-2"
            >
              {isSavingCoupon ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          PROMOTION STATUS CONFIRMATION
      ====================================================== */}

      <Dialog
        open={Boolean(promoStatusConfirm)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingPromoStatus) {
            setPromoStatusConfirm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Power className="h-5 w-5" />
            </div>

            <DialogTitle>
              {promoStatusConfirm?.is_active
                ? "Désactiver la promotion"
                : "Activer la promotion"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Vous allez{" "}
              {promoStatusConfirm?.is_active
                ? "désactiver"
                : "activer"}{" "}
              la promotion de{" "}
              <strong className="text-foreground">
                {promoStatusConfirm
                  ? getPromoScopeLabel(promoStatusConfirm)
                  : ""}
              </strong>
              .
            </p>

            {promoStatusConfirm && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Remise
                </p>

                <p className="mt-1 text-lg font-bold text-primary">
                  {formatDiscount(
                    promoStatusConfirm.discount_type,
                    promoStatusConfirm.discount_value,
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoStatusConfirm(null)}
              disabled={isUpdatingPromoStatus}
            >
              Annuler
            </Button>

            <Button
              variant="accent"
              disabled={isUpdatingPromoStatus}
              onClick={async () => {
                if (!promoStatusConfirm) return;

                const changed = await togglePromoStatus(
                  promoStatusConfirm,
                );

                if (changed) {
                  setPromoStatusConfirm(null);
                }
              }}
            >
              {isUpdatingPromoStatus ? (
                <Spinner className="h-4 w-4" />
              ) : promoStatusConfirm?.is_active ? (
                "Désactiver"
              ) : (
                "Activer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          COUPON STATUS CONFIRMATION
      ====================================================== */}

      <Dialog
        open={Boolean(couponStatusConfirm)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingCouponStatus) {
            setCouponStatusConfirm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Power className="h-5 w-5" />
            </div>

            <DialogTitle>
              {couponStatusConfirm?.is_active
                ? "Désactiver le coupon"
                : "Activer le coupon"}
            </DialogTitle>
          </DialogHeader>

          {couponStatusConfirm && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Vous allez{" "}
                {couponStatusConfirm.is_active
                  ? "désactiver"
                  : "activer"}{" "}
                le coupon{" "}
                <strong className="font-mono text-foreground">
                  {couponStatusConfirm.code}
                </strong>
                .
              </p>

              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Valeur de la remise
                </p>

                <p className="mt-1 text-lg font-bold text-primary">
                  {formatDiscount(
                    couponStatusConfirm.discount_type,
                    couponStatusConfirm.discount_value,
                  )}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCouponStatusConfirm(null)}
              disabled={isUpdatingCouponStatus}
            >
              Annuler
            </Button>

            <Button
              variant="accent"
              disabled={isUpdatingCouponStatus}
              onClick={async () => {
                if (!couponStatusConfirm) return;

                const changed = await toggleCouponStatus(
                  couponStatusConfirm,
                );

                if (changed) {
                  setCouponStatusConfirm(null);
                }
              }}
            >
              {isUpdatingCouponStatus ? (
                <Spinner className="h-4 w-4" />
              ) : couponStatusConfirm?.is_active ? (
                "Désactiver"
              ) : (
                "Activer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          DELETE PROMOTION CONFIRMATION
      ====================================================== */}

      <Dialog
        open={Boolean(confirmDeletePromoId)}
        onOpenChange={(open) => {
          if (!open && !isDeletingPromo) {
            setConfirmDeletePromoId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>

            <DialogTitle>
              Supprimer la promotion
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Voulez-vous vraiment supprimer cette promotion ? Cette action est irréversible.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeletePromoId(null)}
              disabled={isDeletingPromo}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeletePromoId) {
                  void handleDeletePromo(confirmDeletePromoId);
                }
              }}
              disabled={isDeletingPromo}
            >
              {isDeletingPromo ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          BULK DELETE PROMOTIONS
      ====================================================== */}

      <Dialog
        open={confirmDeletePromoIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !isDeletingPromo) {
            setConfirmDeletePromoIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <DialogTitle>
              Supprimer les promotions sélectionnées
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Vous allez supprimer définitivement{" "}
              <strong className="text-foreground">
                {confirmDeletePromoIds.length} promotion
                {confirmDeletePromoIds.length > 1 ? "s" : ""}
              </strong>
              .
            </p>

            <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
              {selectedPromos.length > 0 ? (
                <ul className="space-y-2">
                  {selectedPromos.map((promo) => (
                    <li
                      key={promo.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="truncate font-medium text-foreground">
                        {getPromoScopeLabel(promo)}
                      </span>

                      <span className="shrink-0 font-semibold text-primary">
                        {formatDiscount(
                          promo.discount_type,
                          promo.discount_value,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  Aucune promotion sélectionnée.
                </p>
              )}
            </div>

            <p className="font-medium text-destructive">
              Cette action est irréversible.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeletePromoIds([])}
              disabled={isDeletingPromo}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={() => void handleDeleteSelectedPromos()}
              disabled={
                isDeletingPromo ||
                confirmDeletePromoIds.length === 0
              }
            >
              {isDeletingPromo ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          DELETE COUPON CONFIRMATION
      ====================================================== */}

      <Dialog
        open={Boolean(confirmDeleteCouponId)}
        onOpenChange={(open) => {
          if (!open && !isDeletingCoupon) {
            setConfirmDeleteCouponId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>

            <DialogTitle>
              Supprimer le coupon
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Si ce coupon a déjà été utilisé dans une commande, il sera automatiquement désactivé et conservé pour préserver l'historique.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteCouponId(null)}
              disabled={isDeletingCoupon}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteCouponId) {
                  void handleDeleteCoupon(confirmDeleteCouponId);
                }
              }}
              disabled={isDeletingCoupon}
            >
              {isDeletingCoupon ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          BULK DELETE COUPONS
      ====================================================== */}

      <Dialog
        open={confirmDeleteCouponIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !isDeletingCoupon) {
            setConfirmDeleteCouponIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <DialogTitle>
              Supprimer les coupons sélectionnés
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Vous allez traiter{" "}
              <strong className="text-foreground">
                {confirmDeleteCouponIds.length} coupon
                {confirmDeleteCouponIds.length > 1 ? "s" : ""}
              </strong>
              .
            </p>

            <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
              {selectedCoupons.length > 0 ? (
                <ul className="space-y-2">
                  {selectedCoupons.map((coupon) => (
                    <li
                      key={coupon.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="truncate font-mono font-semibold text-foreground">
                        {coupon.code}
                      </span>

                      <span className="shrink-0 font-semibold text-primary">
                        {formatDiscount(
                          coupon.discount_type,
                          coupon.discount_value,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  Aucun coupon sélectionné.
                </p>
              )}
            </div>

            <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              <p>
                Les coupons déjà utilisés seront conservés et désactivés afin de préserver l'historique des commandes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteCouponIds([])}
              disabled={isDeletingCoupon}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={() =>
                void handleDeleteSelectedCoupons()
              }
              disabled={
                isDeletingCoupon ||
                confirmDeleteCouponIds.length === 0
              }
            >
              {isDeletingCoupon ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}