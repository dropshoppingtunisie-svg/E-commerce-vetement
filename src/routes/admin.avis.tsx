import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  CheckCircle2, Clock3, Eye, Trash2, XCircle, Search, RefreshCw, Star, MessageSquare,
  Users, Package, CalendarDays, ChevronLeft, ChevronRight, Filter, X,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { takeAdminFocus } from "@/lib/admin-focus";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Spinner from "@/components/ui/spinner";
import SortArrow from "@/components/ui/sort-arrow";

export const Route = createFileRoute("/admin/avis")({
  validateSearch: (search: Record<string, unknown>): { review?: string } =>
    typeof search["review"] === "string" ? { review: search["review"] } : {},
  component: AdminAvis,
});

type ReviewStatus = boolean | null;

type ReviewRow = {
  id: string;
  product?: { id: string; name?: string | null; sku?: string | null; } | null;
  profile?: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; } | null;
  rating: number;
  comment?: string | null;
  is_approved?: ReviewStatus;
  created_at?: string | null;
};

type StatusDecision = { id: string; status: ReviewStatus | undefined; };
type StatusFilter = "all" | "approved" | "pending" | "rejected";

const PAGE_SIZE_OPTIONS = ["10", "20", "50"];

const STATUS_LABELS = {
  approved: "Approuvé",
  pending: "En attente",
  rejected: "Rejeté",
};

function getReviewStatus(status: ReviewStatus | undefined) {
  if (status === true) return "approved";
  if (status === false) return "rejected";
  return "pending";
}

function getStatusLabel(status: ReviewStatus | undefined) { return STATUS_LABELS[getReviewStatus(status)]; }

function formatReviewDate(date?: string | null) {
  if (!date) return "-";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return format(parsedDate, "dd/MM/yyyy à HH:mm", { locale: fr });
}

function getUserName(review: ReviewRow) {
  const firstName = review.profile?.first_name?.trim() ?? "";
  const lastName = review.profile?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || review.profile?.email || "Utilisateur inconnu";
}

function getProductName(review: ReviewRow) { return review.product?.name || review.product?.sku || "Produit inconnu"; }

function truncateText(value?: string | null, maxLength = 85) {
  const text = value?.trim() ?? "";
  if (!text) return "Aucun commentaire";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "dots")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: (number | "dots")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push("dots");
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < totalPages - 1) pages.push("dots");
  pages.push(totalPages);
  return pages;
}

function ReviewStatusBadge({ status }: { status: ReviewStatus | undefined }) {
  const currentStatus = getReviewStatus(status);
  const styles = {
    approved: "border-green-200 bg-green-50 text-green-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    rejected: "border-red-200 bg-red-50 text-red-600",
  };
  const icons = {
    approved: <CheckCircle2 className="h-3.5 w-3.5" />,
    pending: <Clock3 className="h-3.5 w-3.5" />,
    rejected: <XCircle className="h-3.5 w-3.5" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[currentStatus]}`}>
      {icons[currentStatus]}
      {STATUS_LABELS[currentStatus]}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, description, iconClassName }: { title: string; value: number; icon: React.ElementType; description: string; iconClassName: string; }) {
  return (
    <div className="rounded-xl border border-green-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#123b25]">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminAvis() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [reviewDetails, setReviewDetails] = useState<ReviewRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [statusDecision, setStatusDecision] = useState<StatusDecision | null>(null);
  const [updatingStatusAction, setUpdatingStatusAction] = useState<"approve" | "reject" | "pending" | null>(null);
  const { review: focusReviewId } = Route.useSearch();
  const [relayFocus, setRelayFocus] = useState<Record<string, string> | null>(null);
  const navigate = useNavigate();

  const loadReviews = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.from("reviews").select(`*, product:products(id,name,sku), profile:profiles(id,first_name,last_name,email)`).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []).map((item: any): ReviewRow => {
        const profile = item.profile && typeof item.profile === "object" && !("message" in item.profile) ? item.profile : null;
        const product = item.product && typeof item.product === "object" && !("message" in item.product) ? item.product : null;
        return { id: item.id, rating: Number(item.rating ?? 0), comment: item.comment ?? null, is_approved: item.is_approved ?? null, created_at: item.created_at ?? null, product, profile };
      });
      setReviews(rows);
      setSelectedReviewIds([]);
      if (showRefresh) toast.success("Les avis ont été actualisés.");
    } catch (error) {
      console.error("load reviews:", error);
      toast.error("Impossible de charger les avis.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from("reviews").select(`*, product:products(id,name,sku), profile:profiles(id,first_name,last_name,email)`).order("created_at", { ascending: false });
        if (error) throw error;
        if (!mounted) return;
        const rows = (data ?? []).map((item: any): ReviewRow => {
          const profile = item.profile && typeof item.profile === "object" && !("message" in item.profile) ? item.profile : null;
          const product = item.product && typeof item.product === "object" && !("message" in item.product) ? item.product : null;
          return { id: item.id, rating: Number(item.rating ?? 0), comment: item.comment ?? null, is_approved: item.is_approved ?? null, created_at: item.created_at ?? null, product, profile };
        });
        setReviews(rows);
      } catch (error) {
        console.error("load reviews:", error);
        toast.error("Impossible de charger les avis.");
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { setRelayFocus(takeAdminFocus("/admin/avis")); }, []);

  useEffect(() => {
    const wantedId = focusReviewId ?? relayFocus?.["review"];
    if (!wantedId || loading) return;
    const target = reviews.find((review) => review.id === wantedId);
    if (!target) {
      if (reviews.length > 0) {
        toast.error("L'avis demandé est introuvable.");
        setRelayFocus(null);
        if (focusReviewId) navigate({ to: "/admin/avis", search: {}, replace: true });
      }
      return;
    }
    setReviewDetails(target);
    setRelayFocus(null);
    if (focusReviewId) navigate({ to: "/admin/avis", search: {}, replace: true });
  }, [focusReviewId, relayFocus, reviews, loading, navigate]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    let result = [...reviews];
    if (search) {
      result = result.filter((review) => {
        const productName = review.product?.name?.toLowerCase() ?? "";
        const productSku = review.product?.sku?.toLowerCase() ?? "";
        const email = review.profile?.email?.toLowerCase() ?? "";
        const firstName = review.profile?.first_name?.toLowerCase() ?? "";
        const lastName = review.profile?.last_name?.toLowerCase() ?? "";
        const comment = review.comment?.toLowerCase() ?? "";
        const fullName = `${firstName} ${lastName}`;
        return productName.includes(search) || productSku.includes(search) || email.includes(search) || firstName.includes(search) || lastName.includes(search) || fullName.includes(search) || comment.includes(search);
      });
    }
    if (statusFilter === "approved") result = result.filter((review) => review.is_approved === true);
    else if (statusFilter === "rejected") result = result.filter((review) => review.is_approved === false);
    else if (statusFilter === "pending") result = result.filter((review) => review.is_approved === null || review.is_approved === undefined);
    result.sort((a, b) => sortDir === "desc" ? b.rating - a.rating : a.rating - b.rating);
    return result;
  }, [reviews, query, statusFilter, sortDir]);

  const statistics = useMemo(() => {
    const approved = reviews.filter((review) => review.is_approved === true).length;
    const rejected = reviews.filter((review) => review.is_approved === false).length;
    const pending = reviews.filter((review) => review.is_approved === null || review.is_approved === undefined).length;
    return { total: reviews.length, approved, rejected, pending };
  }, [reviews]);

  const numericPageSize = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(visible.length / numericPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = visible.length === 0 ? 0 : (safeCurrentPage - 1) * numericPageSize + 1;
  const pageEnd = Math.min(safeCurrentPage * numericPageSize, visible.length);
  const pageReviews = visible.slice((safeCurrentPage - 1) * numericPageSize, safeCurrentPage * numericPageSize);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  useEffect(() => { setCurrentPage(1); setSelectedReviewIds([]); }, [query, statusFilter, pageSize, sortDir]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const allPageSelected = pageReviews.length > 0 && pageReviews.every((review) => selectedReviewIds.includes(review.id));

  const toggleReviewSelection = (id: string, checked: boolean) => {
    setSelectedReviewIds((previous) => checked ? [...new Set([...previous, id])] : previous.filter((reviewId) => reviewId !== id));
  };

  const toggleAllPageReviews = (checked: boolean) => {
    const pageIds = pageReviews.map((review) => review.id);
    if (checked) setSelectedReviewIds((previous) => [...new Set([...previous, ...pageIds])]);
    else { const pageIdSet = new Set(pageIds); setSelectedReviewIds((previous) => previous.filter((id) => !pageIdSet.has(id))); }
  };

  const updateReviewStatus = async (id: string, nextStatus: ReviewStatus): Promise<boolean> => {
    setUpdatingReviewId(id);
    try {
      const { error } = await supabase.from("reviews").update({ is_approved: nextStatus }).eq("id", id);
      if (error) throw error;
      setReviews((previous) => previous.map((review) => review.id === id ? { ...review, is_approved: nextStatus } : review));
      setReviewDetails((previous) => previous?.id === id ? { ...previous, is_approved: nextStatus } : previous);
      toast.success(nextStatus === true ? "Avis approuvé." : nextStatus === false ? "Avis rejeté." : "Avis remis en attente.");
      return true;
    } catch (error) { console.error("update review status:", error); toast.error("Impossible de modifier le statut de l'avis."); return false; }
    finally { setUpdatingReviewId(null); }
  };

  const applyStatusDecision = async (nextStatus: ReviewStatus) => {
    if (!statusDecision) return;
    setUpdatingStatusAction(nextStatus === true ? "approve" : nextStatus === false ? "reject" : "pending");
    const success = await updateReviewStatus(statusDecision.id, nextStatus);
    if (success) setStatusDecision(null);
    setUpdatingStatusAction(null);
  };

  const deleteReview = async (id: string): Promise<boolean> => {
    if (!id) return false;
    setDeletingReviewId(id);
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
      setReviews((previous) => previous.filter((review) => review.id !== id));
      setSelectedReviewIds((previous) => previous.filter((reviewId) => reviewId !== id));
      if (reviewDetails?.id === id) setReviewDetails(null);
      toast.success("Avis supprimé.");
      return true;
    } catch (error) { console.error("delete review:", error); toast.error("Impossible de supprimer cet avis."); return false; }
    finally { setDeletingReviewId(null); }
  };

  const deleteSelectedReviews = async () => {
    if (confirmDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase.from("reviews").delete().in("id", confirmDeleteIds);
      if (error) throw error;
      const deletedIds = new Set(confirmDeleteIds);
      setReviews((previous) => previous.filter((review) => !deletedIds.has(review.id)));
      setSelectedReviewIds((previous) => previous.filter((id) => !deletedIds.has(id)));
      if (reviewDetails && deletedIds.has(reviewDetails.id)) setReviewDetails(null);
      toast.success(`${confirmDeleteIds.length} avis supprimé${confirmDeleteIds.length > 1 ? "s" : ""}.`);
      setConfirmDeleteIds([]);
    } catch (error) { console.error("delete selected reviews:", error); toast.error("Impossible de supprimer les avis sélectionnés."); }
    finally { setIsBulkDeleting(false); }
  };

  const openStatusDialog = (id: string, currentStatus: ReviewStatus | undefined) => { setStatusDecision({ id, status: currentStatus }); };

  return (
    <div className="space-y-7 bg-white pb-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700"><MessageSquare className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#123b25]">Avis clients</h1>
            <p className="text-sm text-gray-500">Gestion et modération des avis clients.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadReviews(true)} disabled={loading || refreshing} className="gap-2 self-start border-green-200 text-green-700 hover:bg-green-50 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Actualiser
        </Button>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total des avis" value={statistics.total} icon={MessageSquare} description="Tous les avis reçus" iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Approuvés" value={statistics.approved} icon={CheckCircle2} description="Avis publiables" iconClassName="bg-green-50 text-green-700" />
        <StatCard title="En attente" value={statistics.pending} icon={Clock3} description="À modérer" iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Rejetés" value={statistics.rejected} icon={XCircle} description="Avis non publiés" iconClassName="bg-green-50 text-green-700" />
      </div>

      {/* FILTERS */}
      <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-[#123b25]">Liste des avis</h2>
          <p className="text-xs text-gray-500">Recherchez, filtrez et gérez les avis reçus.</p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produit, SKU, utilisateur, e-mail..." className="border-green-200 bg-gray-50 pl-9 pr-9 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
              {query && (<button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700"><X className="h-4 w-4" /></button>)}
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full border-green-200 bg-gray-50 text-gray-600 sm:w-48"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><SelectValue placeholder="Tous les statuts" /></div></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="approved">Approuvés</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="rejected">Rejetés</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs text-gray-500">Afficher</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="w-20 border-green-200 bg-gray-50 text-gray-600"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZE_OPTIONS.map((size) => (<SelectItem key={size} value={size}>{size}</SelectItem>))}</SelectContent>
            </Select>
            <span className="text-xs text-gray-500">par page</span>
          </div>
        </div>
        {(query || statusFilter !== "all") && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Filtres actifs :</span>
            {query && (<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Recherche : {query}<button type="button" onClick={() => setQuery("")} aria-label="Supprimer le filtre de recherche"><X className="h-3 w-3" /></button></span>)}
            {statusFilter !== "all" && (<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Statut : {STATUS_LABELS[statusFilter]}<button type="button" onClick={() => setStatusFilter("all")} aria-label="Supprimer le filtre de statut"><X className="h-3 w-3" /></button></span>)}
            <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }} className="text-xs font-semibold text-green-700 hover:underline">Effacer tous les filtres</button>
          </div>
        )}
      </div>

      {/* BULK ACTIONS */}
      {selectedReviewIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-green-800">{selectedReviewIds.length} avis sélectionné{selectedReviewIds.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">Les actions s'appliqueront aux avis sélectionnés.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedReviewIds([])} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler la sélection</Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteIds([...selectedReviewIds])} disabled={isBulkDeleting} className="gap-2 bg-red-600 text-white hover:bg-red-700"><Trash2 className="h-4 w-4" />Supprimer la sélection</Button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50/50 hover:bg-green-50/50">
                <TableHead className="w-12 px-3"><Checkbox checked={allPageSelected} onCheckedChange={(checked) => toggleAllPageReviews(checked === true)} className="border-green-300 data-[state=checked]:bg-green-600" aria-label="Sélectionner les avis de cette page" disabled={loading || pageReviews.length === 0} /></TableHead>
                <TableHead className="min-w-44 text-xs font-semibold uppercase tracking-wide text-green-700/70">Produit</TableHead>
                <TableHead className="min-w-44 text-xs font-semibold uppercase tracking-wide text-green-700/70">Utilisateur</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-green-700/70">
                  <button type="button" className="inline-flex items-center gap-2 font-medium text-green-700/70 transition hover:text-green-900" onClick={() => setSortDir((previous) => previous === "desc" ? "asc" : "desc")}>
                    Note<SortArrow dir={sortDir} ariaLabel="Trier par note" />
                  </button>
                </TableHead>
                <TableHead className="min-w-52 text-xs font-semibold uppercase tracking-wide text-green-700/70">Commentaire</TableHead>
                <TableHead className="min-w-36 text-xs font-semibold uppercase tracking-wide text-green-700/70">Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-green-700/70">Statut</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-green-700/70">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="h-64 text-center"><div className="flex flex-col items-center justify-center gap-3"><Spinner className="h-7 w-7" /><p className="text-sm text-gray-500">Chargement des avis...</p></div></TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={8}>
                  <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50"><MessageSquare className="h-7 w-7 text-gray-300" /></div>
                    <h3 className="text-base font-semibold text-[#123b25]">Aucun avis trouvé</h3>
                    <p className="mt-1 max-w-sm text-sm text-gray-500">Aucun avis ne correspond à votre recherche ou à vos filtres.</p>
                    {(query || statusFilter !== "all") && (<Button variant="outline" size="sm" className="mt-4 border-green-200 text-green-700 hover:bg-green-50" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Effacer les filtres</Button>)}
                  </div>
                </TableCell></TableRow>
              ) : (
                pageReviews.map((review) => (
                  <TableRow key={review.id} className="group transition-colors hover:bg-green-50/30">
                    <TableCell className="px-3"><Checkbox checked={selectedReviewIds.includes(review.id)} onCheckedChange={(checked) => toggleReviewSelection(review.id, checked === true)} className="border-green-300 data-[state=checked]:bg-green-600" aria-label={`Sélectionner l'avis ${review.id}`} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700"><Package className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="max-w-44 truncate text-sm font-semibold text-[#123b25]">{getProductName(review)}</p>
                          {review.product?.sku && (<p className="text-xs text-gray-400">SKU : {review.product.sku}</p>)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="max-w-48 truncate text-sm font-medium text-gray-700">{getUserName(review)}</span>
                        {review.profile?.email && (<span className="max-w-48 truncate text-xs text-gray-400">{review.profile.email}</span>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-semibold text-[#123b25]">{review.rating}</span>
                        <span className="text-xs text-gray-400">/ 5</span>
                      </div>
                    </TableCell>
                    <TableCell><p className="max-w-64 truncate text-sm text-gray-500" title={review.comment ?? ""}>{truncateText(review.comment, 75)}</p></TableCell>
                    <TableCell><div className="flex items-center gap-2 whitespace-nowrap text-xs text-gray-500"><CalendarDays className="h-3.5 w-3.5 text-gray-400" />{formatReviewDate(review.created_at)}</div></TableCell>
                    <TableCell>
                      <button type="button" onClick={() => openStatusDialog(review.id, review.is_approved)} disabled={updatingReviewId !== null || deletingReviewId !== null} className="rounded-full transition-opacity hover:opacity-75 disabled:cursor-not-allowed" title="Modifier le statut">
                        <ReviewStatusBadge status={review.is_approved} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="icon" variant="outline" className="h-8 w-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => setReviewDetails(review)} aria-label="Voir le détail de l'avis" title="Voir le détail"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDeleteId(review.id)} disabled={deletingReviewId !== null} aria-label="Supprimer l'avis" title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        {!loading && visible.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-100 bg-green-50/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">Affichage <span className="font-semibold text-[#123b25]">{pageStart}–{pageEnd}</span> sur <span className="font-semibold text-[#123b25]">{visible.length}</span> avis</p>
            <div className="flex items-center justify-center gap-1.5">
              <Button size="icon" variant="outline" className="h-9 w-9 border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40" onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))} disabled={safeCurrentPage === 1} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button>
              {pageNumbers.map((page, index) => page === "dots" ? (<span key={`dots-${index}`} className="flex h-9 w-7 items-center justify-center text-sm text-gray-400">...</span>) : (
                <Button key={page} size="icon" variant={safeCurrentPage === page ? "default" : "outline"} className={`h-9 w-9 ${safeCurrentPage === page ? "bg-green-700 text-white hover:bg-green-800" : "border-green-200 text-green-700 hover:bg-green-50"}`} onClick={() => setCurrentPage(page)} aria-current={safeCurrentPage === page ? "page" : undefined}>{page}</Button>
              ))}
              <Button size="icon" variant="outline" className="h-9 w-9 border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40" onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))} disabled={safeCurrentPage === totalPages} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* REVIEW DETAILS DIALOG */}
      <Dialog open={Boolean(reviewDetails)} onOpenChange={(open) => { if (!open) setReviewDetails(null); }}>
        <DialogContent className="max-w-2xl border-green-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#123b25]"><MessageSquare className="h-5 w-5 text-green-700" />Détail de l'avis</DialogTitle>
          </DialogHeader>
          {reviewDetails && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-green-100 bg-green-50/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-gray-500"><Package className="h-4 w-4" /><span className="text-xs font-medium">Produit</span></div>
                  <p className="font-semibold text-[#123b25]">{getProductName(reviewDetails)}</p>
                  {reviewDetails.product?.sku && (<p className="mt-1 text-xs text-gray-400">SKU : {reviewDetails.product.sku}</p>)}
                </div>
                <div className="rounded-lg border border-green-100 bg-green-50/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-gray-500"><Users className="h-4 w-4" /><span className="text-xs font-medium">Utilisateur</span></div>
                  <p className="font-semibold text-[#123b25]">{getUserName(reviewDetails)}</p>
                  {reviewDetails.profile?.email && (<p className="mt-1 break-all text-xs text-gray-400">{reviewDetails.profile.email}</p>)}
                </div>
              </div>
              <div className="rounded-lg border border-green-100 p-4">
                <p className="mb-2 text-xs font-medium text-gray-500">Note attribuée</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, index) => (<Star key={index} className={`h-5 w-5 ${index < reviewDetails.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />))}
                  <span className="ml-2 text-sm font-bold text-[#123b25]">{reviewDetails.rating} / 5</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#123b25]">Statut de publication</p>
                  <p className="text-xs text-gray-500">Modifiez le statut de cet avis.</p>
                </div>
                <Select value={getReviewStatus(reviewDetails.is_approved)} onValueChange={(value) => { const nextStatus: ReviewStatus = value === "approved" ? true : value === "rejected" ? false : null; if (nextStatus !== reviewDetails.is_approved) setStatusDecision({ id: reviewDetails.id, status: nextStatus }); }} disabled={updatingReviewId !== null}>
                  <SelectTrigger className="w-full border-green-200 bg-gray-50 sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="approved">Approuvé</SelectItem>
                    <SelectItem value="rejected">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-[#123b25]">Commentaire</p>
                <div className="min-h-24 whitespace-pre-wrap break-words rounded-lg border border-green-100 bg-green-50/30 p-4 text-sm leading-relaxed text-gray-700">{reviewDetails.comment?.trim() || "Aucun commentaire fourni."}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500"><CalendarDays className="h-4 w-4 text-gray-400" />Date de création : <span className="font-medium text-[#123b25]">{formatReviewDate(reviewDetails.created_at)}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE ONE DIALOG */}
      <Dialog open={Boolean(confirmDeleteId)} onOpenChange={(open) => { if (!open && deletingReviewId === null) setConfirmDeleteId(null); }}>
        <DialogContent className="border-green-100">
          <DialogHeader><DialogTitle className="text-[#123b25]">Confirmer la suppression</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Voulez-vous vraiment supprimer cet avis ?</p>
            <p className="text-sm font-medium text-red-600">Cette action est irréversible.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deletingReviewId !== null} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button variant="destructive" disabled={deletingReviewId !== null} onClick={async () => { if (!confirmDeleteId) return; const success = await deleteReview(confirmDeleteId); if (success) setConfirmDeleteId(null); }} className="gap-2 bg-red-600 text-white hover:bg-red-700">
              {deletingReviewId ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK DELETE DIALOG */}
      <Dialog open={confirmDeleteIds.length > 0} onOpenChange={(open) => { if (!open && !isBulkDeleting) setConfirmDeleteIds([]); }}>
        <DialogContent className="border-green-100">
          <DialogHeader><DialogTitle className="text-[#123b25]">Supprimer les avis sélectionnés ?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Vous êtes sur le point de supprimer <strong className="text-[#123b25]">{confirmDeleteIds.length} avis</strong>.</p>
            <p className="text-sm font-medium text-red-600">Cette action est irréversible.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteIds([])} disabled={isBulkDeleting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button variant="destructive" onClick={deleteSelectedReviews} disabled={isBulkDeleting} className="gap-2 bg-red-600 text-white hover:bg-red-700">
              {isBulkDeleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}Supprimer ({confirmDeleteIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STATUS DECISION DIALOG */}
      <Dialog open={Boolean(statusDecision)} onOpenChange={(open) => { if (!open && updatingReviewId === null) setStatusDecision(null); }}>
        <DialogContent className="border-green-100">
          <DialogHeader><DialogTitle className="text-[#123b25]">Confirmer le changement de statut</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Voulez-vous appliquer ce nouveau statut à cet avis ?</p>
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => applyStatusDecision(null)} disabled={updatingReviewId !== null} className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50">
              {updatingStatusAction === "pending" ? <Spinner className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}En attente
            </Button>
            <Button variant="destructive" onClick={() => applyStatusDecision(false)} disabled={updatingReviewId !== null} className="gap-2 bg-red-600 text-white hover:bg-red-700">
              {updatingStatusAction === "reject" ? <Spinner className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}Rejeter
            </Button>
            <Button onClick={() => applyStatusDecision(true)} disabled={updatingReviewId !== null} className="gap-2 bg-green-700 text-white hover:bg-green-800">
              {updatingStatusAction === "approve" ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}