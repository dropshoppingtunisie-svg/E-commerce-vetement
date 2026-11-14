
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  CheckCircle2,
  Clock3,
  Eye,
  Trash2,
  XCircle,
  Search,
  RefreshCw,
  Star,
  MessageSquare,
  Users,
  Package,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { takeAdminFocus } from "@/lib/admin-focus";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import Spinner from "@/components/ui/spinner";
import SortArrow from "@/components/ui/sort-arrow";

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/admin/avis")({
  validateSearch: (search: Record<string, unknown>): { review?: string } =>
    typeof search["review"] === "string"
      ? { review: search["review"] }
      : {},
  component: AdminAvis,
});

// ============================================================
// TYPES
// ============================================================

type ReviewStatus = boolean | null;

type ReviewRow = {
  id: string;

  product?: {
    id: string;
    name?: string | null;
    sku?: string | null;
  } | null;

  profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;

  rating: number;
  comment?: string | null;
  is_approved?: ReviewStatus;
  created_at?: string | null;
};

type StatusDecision = {
  id: string;
  status: ReviewStatus | undefined;
};

type StatusFilter = "all" | "approved" | "pending" | "rejected";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE_OPTIONS = ["10", "20", "50"];

const STATUS_LABELS = {
  approved: "Approuvé",
  pending: "En attente",
  rejected: "Rejeté",
};

// ============================================================
// HELPERS
// ============================================================

function getReviewStatus(status: ReviewStatus | undefined) {
  if (status === true) return "approved";
  if (status === false) return "rejected";
  return "pending";
}

function getStatusLabel(status: ReviewStatus | undefined) {
  return STATUS_LABELS[getReviewStatus(status)];
}

function formatReviewDate(date?: string | null) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  return format(parsedDate, "dd/MM/yyyy à HH:mm", {
    locale: fr,
  });
}

function getUserName(review: ReviewRow) {
  const firstName = review.profile?.first_name?.trim() ?? "";
  const lastName = review.profile?.last_name?.trim() ?? "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || review.profile?.email || "Utilisateur inconnu";
}

function getProductName(review: ReviewRow) {
  return (
    review.product?.name ||
    review.product?.sku ||
    "Produit inconnu"
  );
}

function truncateText(
  value?: string | null,
  maxLength = 85
) {
  const text = value?.trim() ?? "";

  if (!text) return "Aucun commentaire";

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}...`;
}

function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "dots")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: (number | "dots")[] = [1];

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("dots");

  for (let page = start; page <= end; page++) {
    pages.push(page);
  }

  if (end < totalPages - 1) pages.push("dots");

  pages.push(totalPages);

  return pages;
}

// ============================================================
// STATUS BADGE
// ============================================================

function ReviewStatusBadge({
  status,
}: {
  status: ReviewStatus | undefined;
}) {
  const currentStatus = getReviewStatus(status);

  const styles = {
    approved:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400",
    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
    rejected:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
  };

  const icons = {
    approved: <CheckCircle2 className="h-3.5 w-3.5" />,
    pending: <Clock3 className="h-3.5 w-3.5" />,
    rejected: <XCircle className="h-3.5 w-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[currentStatus]}`}
    >
      {icons[currentStatus]}
      {STATUS_LABELS[currentStatus]}
    </span>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  iconClassName,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  description: string;
  iconClassName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function AdminAvis() {
  // ----------------------------------------------------------
  // STATES
  // ----------------------------------------------------------

  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");

  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);

  const [reviewDetails, setReviewDetails] =
    useState<ReviewRow | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] =
    useState<string | null>(null);

  const [confirmDeleteIds, setConfirmDeleteIds] =
    useState<string[]>([]);

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [deletingReviewId, setDeletingReviewId] =
    useState<string | null>(null);

  const [updatingReviewId, setUpdatingReviewId] =
    useState<string | null>(null);

  const [statusDecision, setStatusDecision] =
    useState<StatusDecision | null>(null);

  const [updatingStatusAction, setUpdatingStatusAction] =
    useState<"approve" | "reject" | "pending" | null>(null);

  const { review: focusReviewId } = Route.useSearch();

  const [relayFocus, setRelayFocus] =
    useState<Record<string, string> | null>(null);

  const navigate = useNavigate();

  // ----------------------------------------------------------
  // LOAD REVIEWS
  // ----------------------------------------------------------

  const loadReviews = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          product:products(id,name,sku),
          profile:profiles(id,first_name,last_name,email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []).map((item: any): ReviewRow => {
        const profile =
          item.profile &&
          typeof item.profile === "object" &&
          !("message" in item.profile)
            ? item.profile
            : null;

        const product =
          item.product &&
          typeof item.product === "object" &&
          !("message" in item.product)
            ? item.product
            : null;

        return {
          id: item.id,
          rating: Number(item.rating ?? 0),
          comment: item.comment ?? null,
          is_approved: item.is_approved ?? null,
          created_at: item.created_at ?? null,
          product,
          profile,
        };
      });

      setReviews(rows);
      setSelectedReviewIds([]);

      if (showRefresh) {
        toast.success("Les avis ont été actualisés.");
      }
    } catch (error) {
      console.error("load reviews:", error);
      toast.error("Impossible de charger les avis.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("reviews")
          .select(`
            *,
            product:products(id,name,sku),
            profile:profiles(id,first_name,last_name,email)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!mounted) return;

        const rows = (data ?? []).map((item: any): ReviewRow => {
          const profile =
            item.profile &&
            typeof item.profile === "object" &&
            !("message" in item.profile)
              ? item.profile
              : null;

          const product =
            item.product &&
            typeof item.product === "object" &&
            !("message" in item.product)
              ? item.product
              : null;

          return {
            id: item.id,
            rating: Number(item.rating ?? 0),
            comment: item.comment ?? null,
            is_approved: item.is_approved ?? null,
            created_at: item.created_at ?? null,
            product,
            profile,
          };
        });

        setReviews(rows);
      } catch (error) {
        console.error("load reviews:", error);
        toast.error("Impossible de charger les avis.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // ----------------------------------------------------------
  // NOTIFICATION FOCUS
  // ----------------------------------------------------------

  useEffect(() => {
    setRelayFocus(takeAdminFocus("/admin/avis"));
  }, []);

  useEffect(() => {
    const wantedId = focusReviewId ?? relayFocus?.["review"];

    if (!wantedId || loading) return;

    const target = reviews.find((review) => review.id === wantedId);

    if (!target) {
      if (reviews.length > 0) {
        toast.error("L'avis demandé est introuvable.");
        setRelayFocus(null);

        if (focusReviewId) {
          navigate({
            to: "/admin/avis",
            search: {},
            replace: true,
          });
        }
      }

      return;
    }

    setReviewDetails(target);
    setRelayFocus(null);

    if (focusReviewId) {
      navigate({
        to: "/admin/avis",
        search: {},
        replace: true,
      });
    }
  }, [focusReviewId, relayFocus, reviews, loading, navigate]);

  // ----------------------------------------------------------
  // FILTERS AND SEARCH
  // ----------------------------------------------------------

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    let result = [...reviews];

    if (search) {
      result = result.filter((review) => {
        const productName =
          review.product?.name?.toLowerCase() ?? "";

        const productSku =
          review.product?.sku?.toLowerCase() ?? "";

        const email =
          review.profile?.email?.toLowerCase() ?? "";

        const firstName =
          review.profile?.first_name?.toLowerCase() ?? "";

        const lastName =
          review.profile?.last_name?.toLowerCase() ?? "";

        const comment =
          review.comment?.toLowerCase() ?? "";

        const fullName = `${firstName} ${lastName}`;

        return (
          productName.includes(search) ||
          productSku.includes(search) ||
          email.includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search) ||
          fullName.includes(search) ||
          comment.includes(search)
        );
      });
    }

    if (statusFilter === "approved") {
      result = result.filter(
        (review) => review.is_approved === true
      );
    } else if (statusFilter === "rejected") {
      result = result.filter(
        (review) => review.is_approved === false
      );
    } else if (statusFilter === "pending") {
      result = result.filter(
        (review) =>
          review.is_approved === null ||
          review.is_approved === undefined
      );
    }

    result.sort((a, b) => {
      return sortDir === "desc"
        ? b.rating - a.rating
        : a.rating - b.rating;
    });

    return result;
  }, [reviews, query, statusFilter, sortDir]);

  // ----------------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------------

  const statistics = useMemo(() => {
    const approved = reviews.filter(
      (review) => review.is_approved === true
    ).length;

    const rejected = reviews.filter(
      (review) => review.is_approved === false
    ).length;

    const pending = reviews.filter(
      (review) =>
        review.is_approved === null ||
        review.is_approved === undefined
    ).length;

    return {
      total: reviews.length,
      approved,
      rejected,
      pending,
    };
  }, [reviews]);

  // ----------------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------------

  const numericPageSize = Number(pageSize);

  const totalPages = Math.max(
    1,
    Math.ceil(visible.length / numericPageSize)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const pageStart =
    visible.length === 0
      ? 0
      : (safeCurrentPage - 1) * numericPageSize + 1;

  const pageEnd = Math.min(
    safeCurrentPage * numericPageSize,
    visible.length
  );

  const pageReviews = visible.slice(
    (safeCurrentPage - 1) * numericPageSize,
    safeCurrentPage * numericPageSize
  );

  const pageNumbers = getPageNumbers(
    safeCurrentPage,
    totalPages
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedReviewIds([]);
  }, [query, statusFilter, pageSize, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ----------------------------------------------------------
  // SELECTION
  // ----------------------------------------------------------

  const allPageSelected =
    pageReviews.length > 0 &&
    pageReviews.every((review) =>
      selectedReviewIds.includes(review.id)
    );

  const toggleReviewSelection = (
    id: string,
    checked: boolean
  ) => {
    setSelectedReviewIds((previous) =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter((reviewId) => reviewId !== id)
    );
  };

  const toggleAllPageReviews = (checked: boolean) => {
    const pageIds = pageReviews.map((review) => review.id);

    if (checked) {
      setSelectedReviewIds((previous) => [
        ...new Set([...previous, ...pageIds]),
      ]);
    } else {
      const pageIdSet = new Set(pageIds);

      setSelectedReviewIds((previous) =>
        previous.filter((id) => !pageIdSet.has(id))
      );
    }
  };

  // ----------------------------------------------------------
  // UPDATE REVIEW STATUS
  // ----------------------------------------------------------

  const updateReviewStatus = async (
    id: string,
    nextStatus: ReviewStatus
  ): Promise<boolean> => {
    setUpdatingReviewId(id);

    try {
      const { error } = await supabase
        .from("reviews")
        .update({ is_approved: nextStatus })
        .eq("id", id);

      if (error) throw error;

      setReviews((previous) =>
        previous.map((review) =>
          review.id === id
            ? { ...review, is_approved: nextStatus }
            : review
        )
      );

      setReviewDetails((previous) =>
        previous?.id === id
          ? { ...previous, is_approved: nextStatus }
          : previous
      );

      toast.success(
        nextStatus === true
          ? "Avis approuvé."
          : nextStatus === false
            ? "Avis rejeté."
            : "Avis remis en attente."
      );

      return true;
    } catch (error) {
      console.error("update review status:", error);
      toast.error("Impossible de modifier le statut de l'avis.");
      return false;
    } finally {
      setUpdatingReviewId(null);
    }
  };

  const applyStatusDecision = async (
    nextStatus: ReviewStatus
  ) => {
    if (!statusDecision) return;

    setUpdatingStatusAction(
      nextStatus === true
        ? "approve"
        : nextStatus === false
          ? "reject"
          : "pending"
    );

    const success = await updateReviewStatus(
      statusDecision.id,
      nextStatus
    );

    if (success) {
      setStatusDecision(null);
    }

    setUpdatingStatusAction(null);
  };

  // ----------------------------------------------------------
  // DELETE ONE REVIEW
  // ----------------------------------------------------------

  const deleteReview = async (id: string): Promise<boolean> => {
    if (!id) return false;

    setDeletingReviewId(id);

    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setReviews((previous) =>
        previous.filter((review) => review.id !== id)
      );

      setSelectedReviewIds((previous) =>
        previous.filter((reviewId) => reviewId !== id)
      );

      if (reviewDetails?.id === id) {
        setReviewDetails(null);
      }

      toast.success("Avis supprimé.");

      return true;
    } catch (error) {
      console.error("delete review:", error);
      toast.error("Impossible de supprimer cet avis.");
      return false;
    } finally {
      setDeletingReviewId(null);
    }
  };

  // ----------------------------------------------------------
  // DELETE SELECTED REVIEWS
  // ----------------------------------------------------------

  const deleteSelectedReviews = async () => {
    if (confirmDeleteIds.length === 0) return;

    setIsBulkDeleting(true);

    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .in("id", confirmDeleteIds);

      if (error) throw error;

      const deletedIds = new Set(confirmDeleteIds);

      setReviews((previous) =>
        previous.filter(
          (review) => !deletedIds.has(review.id)
        )
      );

      setSelectedReviewIds((previous) =>
        previous.filter((id) => !deletedIds.has(id))
      );

      if (
        reviewDetails &&
        deletedIds.has(reviewDetails.id)
      ) {
        setReviewDetails(null);
      }

      toast.success(
        `${confirmDeleteIds.length} avis supprimé${confirmDeleteIds.length > 1 ? "s" : ""}.`
      );

      setConfirmDeleteIds([]);
    } catch (error) {
      console.error("delete selected reviews:", error);
      toast.error("Impossible de supprimer les avis sélectionnés.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ----------------------------------------------------------
  // STATUS DIALOG
  // ----------------------------------------------------------

  const openStatusDialog = (
    id: string,
    currentStatus: ReviewStatus | undefined
  ) => {
    setStatusDecision({
      id,
      status: currentStatus,
    });
  };

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="space-y-7 pb-8">

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Avis clients
              </h1>

              <p className="text-sm text-muted-foreground">
                Gestion et modération des avis clients.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => loadReviews(true)}
          disabled={loading || refreshing}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Actualiser
        </Button>
      </div>

      {/* ================================================== */}
      {/* STATISTICS */}
      {/* ================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total des avis"
          value={statistics.total}
          icon={MessageSquare}
          description="Tous les avis reçus"
          iconClassName="bg-primary/10 text-primary"
        />

        <StatCard
          title="Approuvés"
          value={statistics.approved}
          icon={CheckCircle2}
          description="Avis publiables"
          iconClassName="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
        />

        <StatCard
          title="En attente"
          value={statistics.pending}
          icon={Clock3}
          description="À modérer"
          iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
        />

        <StatCard
          title="Rejetés"
          value={statistics.rejected}
          icon={XCircle}
          description="Avis non publiés"
          iconClassName="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
        />

      </div>

      {/* ================================================== */}
      {/* FILTERS */}
      {/* ================================================== */}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">

        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            Liste des avis
          </h2>

          <p className="text-xs text-muted-foreground">
            Recherchez, filtrez et gérez les avis reçus.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex flex-1 flex-col gap-3 sm:flex-row">

            {/* SEARCH */}

            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Produit, SKU, utilisateur, e-mail..."
                className="pl-9 pr-9"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* STATUS FILTER */}

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Tous les statuts" />
                </div>
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tous les statuts
                </SelectItem>

                <SelectItem value="approved">
                  Approuvés
                </SelectItem>

                <SelectItem value="pending">
                  En attente
                </SelectItem>

                <SelectItem value="rejected">
                  Rejetés
                </SelectItem>
              </SelectContent>
            </Select>

          </div>

          {/* PAGE SIZE */}

          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Afficher
            </span>

            <Select
              value={pageSize}
              onValueChange={setPageSize}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground">
              par page
            </span>
          </div>

        </div>

        {/* ACTIVE FILTERS */}

        {(query || statusFilter !== "all") && (
          <div className="mt-4 flex flex-wrap items-center gap-2">

            <span className="text-xs text-muted-foreground">
              Filtres actifs :
            </span>

            {query && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Recherche : {query}

                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Supprimer le filtre de recherche"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Statut : {STATUS_LABELS[statusFilter]}

                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  aria-label="Supprimer le filtre de statut"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Effacer tous les filtres
            </button>

          </div>
        )}

      </div>

      {/* ================================================== */}
      {/* BULK ACTIONS */}
      {/* ================================================== */}

      {selectedReviewIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedReviewIds.length} avis sélectionné
                {selectedReviewIds.length > 1 ? "s" : ""}
              </p>

              <p className="text-xs text-muted-foreground">
                Les actions s'appliqueront aux avis sélectionnés.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedReviewIds([])}
            >
              Annuler la sélection
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                setConfirmDeleteIds([...selectedReviewIds])
              }
              disabled={isBulkDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la sélection
            </Button>

          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* TABLE */}
      {/* ================================================== */}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">

        <div className="overflow-x-auto">

          <Table>

            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">

                <TableHead className="w-12">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(checked) =>
                      toggleAllPageReviews(checked === true)
                    }
                    aria-label="Sélectionner les avis de cette page"
                    disabled={loading || pageReviews.length === 0}
                  />
                </TableHead>

                <TableHead className="min-w-44">
                  Produit
                </TableHead>

                <TableHead className="min-w-44">
                  Utilisateur
                </TableHead>

                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-medium text-foreground"
                    onClick={() =>
                      setSortDir((previous) =>
                        previous === "desc" ? "asc" : "desc"
                      )
                    }
                  >
                    Note
                    <SortArrow
                      dir={sortDir}
                      ariaLabel="Trier par note"
                    />
                  </button>
                </TableHead>

                <TableHead className="min-w-52">
                  Commentaire
                </TableHead>

                <TableHead className="min-w-36">
                  Date
                </TableHead>

                <TableHead>
                  Statut
                </TableHead>

                <TableHead className="text-right">
                  Actions
                </TableHead>

              </TableRow>
            </TableHeader>

            <TableBody>

              {/* LOADING */}

              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-64 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Spinner className="h-7 w-7" />

                      <p className="text-sm text-muted-foreground">
                        Chargement des avis...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (

                /* EMPTY STATE */

                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <MessageSquare className="h-7 w-7 text-muted-foreground" />
                      </div>

                      <h3 className="text-base font-semibold text-foreground">
                        Aucun avis trouvé
                      </h3>

                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Aucun avis ne correspond à votre recherche ou à vos filtres.
                      </p>

                      {(query || statusFilter !== "all") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("all");
                          }}
                        >
                          Effacer les filtres
                        </Button>
                      )}

                    </div>
                  </TableCell>
                </TableRow>

              ) : (

                /* REVIEW ROWS */

                pageReviews.map((review) => (
                  <TableRow
                    key={review.id}
                    className="group transition-colors hover:bg-muted/30"
                  >

                    <TableCell>
                      <Checkbox
                        checked={selectedReviewIds.includes(review.id)}
                        onCheckedChange={(checked) =>
                          toggleReviewSelection(
                            review.id,
                            checked === true
                          )
                        }
                        aria-label={`Sélectionner l'avis ${review.id}`}
                      />
                    </TableCell>

                    {/* PRODUCT */}

                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="max-w-44 truncate text-sm font-semibold text-foreground">
                            {getProductName(review)}
                          </p>

                          {review.product?.sku && (
                            <p className="text-xs text-muted-foreground">
                              SKU : {review.product.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* USER */}

                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="max-w-48 truncate text-sm font-medium text-foreground">
                          {getUserName(review)}
                        </span>

                        {review.profile?.email && (
                          <span className="max-w-48 truncate text-xs text-muted-foreground">
                            {review.profile.email}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* RATING */}

                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />

                        <span className="text-sm font-semibold text-foreground">
                          {review.rating}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          / 5
                        </span>
                      </div>
                    </TableCell>

                    {/* COMMENT */}

                    <TableCell>
                      <p
                        className="max-w-64 truncate text-sm text-muted-foreground"
                        title={review.comment ?? ""}
                      >
                        {truncateText(review.comment, 75)}
                      </p>
                    </TableCell>

                    {/* DATE */}

                    <TableCell>
                      <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatReviewDate(review.created_at)}
                      </div>
                    </TableCell>

                    {/* STATUS */}

                    <TableCell>
                      <button
                        type="button"
                        onClick={() =>
                          openStatusDialog(
                            review.id,
                            review.is_approved
                          )
                        }
                        disabled={
                          updatingReviewId !== null ||
                          deletingReviewId !== null
                        }
                        className="rounded-full transition-opacity hover:opacity-75 disabled:cursor-not-allowed"
                        title="Modifier le statut"
                      >
                        <ReviewStatusBadge
                          status={review.is_approved}
                        />
                      </button>
                    </TableCell>

                    {/* ACTIONS */}

                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setReviewDetails(review)}
                          aria-label="Voir le détail de l'avis"
                          title="Voir le détail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            setConfirmDeleteId(review.id)
                          }
                          disabled={deletingReviewId !== null}
                          aria-label="Supprimer l'avis"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                      </div>
                    </TableCell>

                  </TableRow>
                ))

              )}

            </TableBody>

          </Table>

        </div>

        {/* ================================================== */}
        {/* PAGINATION */}
        {/* ================================================== */}

        {!loading && visible.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-sm text-muted-foreground">
              Affichage{" "}
              <span className="font-semibold text-foreground">
                {pageStart}–{pageEnd}
              </span>{" "}
              sur{" "}
              <span className="font-semibold text-foreground">
                {visible.length}
              </span>{" "}
              avis
            </p>

            <div className="flex items-center justify-center gap-1.5">

              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() =>
                  setCurrentPage((previous) =>
                    Math.max(1, previous - 1)
                  )
                }
                disabled={safeCurrentPage === 1}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {pageNumbers.map((page, index) =>
                page === "dots" ? (
                  <span
                    key={`dots-${index}`}
                    className="flex h-9 w-7 items-center justify-center text-sm text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    size="icon"
                    variant={
                      safeCurrentPage === page
                        ? "default"
                        : "outline"
                    }
                    className="h-9 w-9"
                    onClick={() => setCurrentPage(page)}
                    aria-current={
                      safeCurrentPage === page
                        ? "page"
                        : undefined
                    }
                  >
                    {page}
                  </Button>
                )
              )}

              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() =>
                  setCurrentPage((previous) =>
                    Math.min(totalPages, previous + 1)
                  )
                }
                disabled={safeCurrentPage === totalPages}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

            </div>

          </div>
        )}

      </div>

      {/* ================================================== */}
      {/* REVIEW DETAILS DIALOG */}
      {/* ================================================== */}

      <Dialog
        open={Boolean(reviewDetails)}
        onOpenChange={(open) => {
          if (!open) setReviewDetails(null);
        }}
      >
        <DialogContent className="max-w-2xl">

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Détail de l'avis
            </DialogTitle>
          </DialogHeader>

          {reviewDetails && (
            <div className="space-y-5">

              {/* PRODUCT AND USER */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      Produit
                    </span>
                  </div>

                  <p className="font-semibold text-foreground">
                    {getProductName(reviewDetails)}
                  </p>

                  {reviewDetails.product?.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      SKU : {reviewDetails.product.sku}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      Utilisateur
                    </span>
                  </div>

                  <p className="font-semibold text-foreground">
                    {getUserName(reviewDetails)}
                  </p>

                  {reviewDetails.profile?.email && (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {reviewDetails.profile.email}
                    </p>
                  )}
                </div>

              </div>

              {/* RATING */}

              <div className="rounded-lg border border-border p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Note attribuée
                </p>

                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={`h-5 w-5 ${
                        index < reviewDetails.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}

                  <span className="ml-2 text-sm font-bold text-foreground">
                    {reviewDetails.rating} / 5
                  </span>
                </div>
              </div>

              {/* STATUS */}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Statut de publication
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Modifiez le statut de cet avis.
                  </p>
                </div>

                <Select
                  value={getReviewStatus(
                    reviewDetails.is_approved
                  )}
                  onValueChange={(value) => {
                    const nextStatus: ReviewStatus =
                      value === "approved"
                        ? true
                        : value === "rejected"
                          ? false
                          : null;

                    if (
                      nextStatus !== reviewDetails.is_approved
                    ) {
                      setStatusDecision({
                        id: reviewDetails.id,
                        status: nextStatus,
                      });
                    }
                  }}
                  disabled={updatingReviewId !== null}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="pending">
                      En attente
                    </SelectItem>

                    <SelectItem value="approved">
                      Approuvé
                    </SelectItem>

                    <SelectItem value="rejected">
                      Rejeté
                    </SelectItem>
                  </SelectContent>
                </Select>

              </div>

              {/* COMMENT */}

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Commentaire
                </p>

                <div className="min-h-24 whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground">
                  {reviewDetails.comment?.trim() ||
                    "Aucun commentaire fourni."}
                </div>
              </div>

              {/* DATE */}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Date de création :{" "}
                <span className="font-medium text-foreground">
                  {formatReviewDate(reviewDetails.created_at)}
                </span>
              </div>

            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* ================================================== */}
      {/* DELETE ONE DIALOG */}
      {/* ================================================== */}

      <Dialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(open) => {
          if (!open && deletingReviewId === null) {
            setConfirmDeleteId(null);
          }
        }}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              Confirmer la suppression
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Voulez-vous vraiment supprimer cet avis ?
            </p>

            <p className="text-sm font-medium text-destructive">
              Cette action est irréversible.
            </p>
          </div>

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deletingReviewId !== null}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              disabled={deletingReviewId !== null}
              onClick={async () => {
                if (!confirmDeleteId) return;

                const success = await deleteReview(
                  confirmDeleteId
                );

                if (success) {
                  setConfirmDeleteId(null);
                }
              }}
              className="gap-2"
            >
              {deletingReviewId ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              Supprimer
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* ================================================== */}
      {/* BULK DELETE DIALOG */}
      {/* ================================================== */}

      <Dialog
        open={confirmDeleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !isBulkDeleting) {
            setConfirmDeleteIds([]);
          }
        }}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              Supprimer les avis sélectionnés ?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Vous êtes sur le point de supprimer{" "}
              <strong className="text-foreground">
                {confirmDeleteIds.length} avis
              </strong>.
            </p>

            <p className="text-sm font-medium text-destructive">
              Cette action est irréversible.
            </p>
          </div>

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setConfirmDeleteIds([])}
              disabled={isBulkDeleting}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={deleteSelectedReviews}
              disabled={isBulkDeleting}
              className="gap-2"
            >
              {isBulkDeleting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              Supprimer ({confirmDeleteIds.length})
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* ================================================== */}
      {/* STATUS DECISION DIALOG */}
      {/* ================================================== */}

      <Dialog
        open={Boolean(statusDecision)}
        onOpenChange={(open) => {
          if (!open && updatingReviewId === null) {
            setStatusDecision(null);
          }
        }}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              Confirmer le changement de statut
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Voulez-vous appliquer ce nouveau statut à cet avis ?
          </p>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">

            <Button
              variant="outline"
              onClick={() => applyStatusDecision(null)}
              disabled={updatingReviewId !== null}
              className="gap-2"
            >
              {updatingStatusAction === "pending" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}

              En attente
            </Button>

            <Button
              variant="destructive"
              onClick={() => applyStatusDecision(false)}
              disabled={updatingReviewId !== null}
              className="gap-2"
            >
              {updatingStatusAction === "reject" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}

              Rejeter
            </Button>

            <Button
              onClick={() => applyStatusDecision(true)}
              disabled={updatingReviewId !== null}
              className="gap-2"
            >
              {updatingStatusAction === "approve" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}

              Approuver
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
}
