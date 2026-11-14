import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  PackageX,
  ShoppingBag,
  Star,
  Trash2,
  ArrowRight,
  Inbox,
  CircleCheck,
  Clock3,
  BellRing,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import type { Database } from "@/types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Spinner from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import {
  orderReferenceFromTitle,
  parseAdminLink,
  productNameFromBody,
} from "@/lib/admin-links";

import { setAdminFocus } from "@/lib/admin-focus";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];

// =========================================================
// CONFIGURATION
// =========================================================

const ITEMS_PER_PAGE = 10;

const TYPE_ICONS: Record<string, typeof Bell> = {
  order: ShoppingBag,
  review: Star,
  stock: PackageX,
};

const TYPE_LABELS: Record<string, string> = {
  order: "Commandes",
  review: "Avis clients",
  stock: "Alertes stock",
};

const TYPE_STYLES: Record<
  string,
  {
    icon: string;
    background: string;
    label: string;
  }
> = {
  order: {
    icon: "text-blue-600",
    background: "bg-blue-500/10",
    label: "text-blue-600 bg-blue-500/10",
  },
  review: {
    icon: "text-amber-600",
    background: "bg-amber-500/10",
    label: "text-amber-600 bg-amber-500/10",
  },
  stock: {
    icon: "text-rose-600",
    background: "bg-rose-500/10",
    label: "text-rose-600 bg-rose-500/10",
  },
};

function getNotificationStyle(type: string) {
  return (
    TYPE_STYLES[type] ?? {
      icon: "text-primary",
      background: "bg-primary/10",
      label: "text-primary bg-primary/10",
    }
  );
}

function formatNotificationDate(date: string | null) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

// =========================================================
// COMPOSANT PRINCIPAL
// =========================================================

function AdminNotifications() {
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  // =======================================================
  // CHARGEMENT
  // =======================================================

  const load = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setItems(data ?? []);
    } catch (err) {
      console.error("load notifications", err);
      toast.error("Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // =======================================================
  // RÉINITIALISATION DES SÉLECTIONS ET DE LA PAGINATION
  // =======================================================

  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [typeFilter]);

  // =======================================================
  // MARQUER UNE NOTIFICATION COMME LUE
  // =======================================================

  const markRead = async (id: string) => {
    const previousItems = items;

    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("mark read", error);
      toast.error("Impossible de marquer cette notification comme lue.");
      setItems(previousItems);
    }
  };

  // =======================================================
  // MARQUER TOUTES LES NOTIFICATIONS COMME LUES
  // =======================================================

  const markAllRead = async () => {
    const unreadIds = items
      .filter((n) => !n.is_read)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    const previousItems = items;

    setItems((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (error) {
      console.error("mark all read", error);
      setItems(previousItems);
      toast.error("Impossible de tout marquer comme lu.");
    } else {
      toast.success("Toutes les notifications sont marquées comme lues.");
    }
  };

  // =======================================================
  // SUPPRIMER UNE NOTIFICATION
  // =======================================================

  const remove = async (id: string) => {
    const removed = items.find((n) => n.id === id);

    setItems((prev) =>
      prev.filter((n) => n.id !== id)
    );

    setSelectedIds((prev) =>
      prev.filter((x) => x !== id)
    );

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("delete notification", error);

      if (removed) {
        setItems((prev) => [removed, ...prev]);
      }

      toast.error("Impossible de supprimer la notification.");
    } else {
      toast.success("Notification supprimée.");
    }
  };

  // =======================================================
  // SUPPRIMER LES NOTIFICATIONS SÉLECTIONNÉES
  // =======================================================

  const removeSelected = async () => {
    if (selectedIds.length === 0) return;

    setDeleting(true);

    const snapshot = items;
    const idsToDelete = [...selectedIds];
    const count = idsToDelete.length;

    setItems((prev) =>
      prev.filter((n) => !idsToDelete.includes(n.id))
    );

    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", idsToDelete);

    setDeleting(false);
    setConfirmBulkDelete(false);

    if (error) {
      console.error("bulk delete notifications", error);

      setItems(snapshot);

      toast.error(
        "Impossible de supprimer les notifications sélectionnées."
      );

      return;
    }

    setSelectedIds([]);

    toast.success(
      `${count} notification${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}.`
    );
  };

  // =======================================================
  // STATISTIQUES
  // =======================================================

  const unreadCount = items.filter((n) => !n.is_read).length;
  const readCount = items.length - unreadCount;

  // =======================================================
  // FILTRES DYNAMIQUES
  // =======================================================

  const typeTabs = useMemo(() => {
    const counts = new Map<string, number>();

    items.forEach((n) => {
      counts.set(
        n.type,
        (counts.get(n.type) ?? 0) + 1
      );
    });

    return [
      {
        value: "all",
        label: "Toutes",
        count: items.length,
      },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({
          value: type,
          label: TYPE_LABELS[type] ?? type,
          count,
        })),
    ];
  }, [items]);

  const visible = useMemo(
    () =>
      typeFilter === "all"
        ? items
        : items.filter((n) => n.type === typeFilter),
    [items, typeFilter]
  );

  // =======================================================
  // PAGINATION
  // =======================================================

  const totalPages = Math.max(
    1,
    Math.ceil(visible.length / ITEMS_PER_PAGE)
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return visible.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [visible, currentPage]);

  const startItem =
    visible.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const endItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    visible.length
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // =======================================================
  // SÉLECTION MULTIPLE
  // =======================================================

  const visibleIds = paginatedItems.map((n) => n.id);

  const selectedVisibleIds = selectedIds.filter((id) =>
    visibleIds.includes(id)
  );

  const allVisibleSelected =
    visibleIds.length > 0 &&
    selectedVisibleIds.length === visibleIds.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])]
    );
  };

  // =======================================================
  // NUMÉROS DE PAGE
  // =======================================================

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];

    for (let page = 1; page <= totalPages; page++) {
      if (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - currentPage) <= 1
      ) {
        const last = pages[pages.length - 1];

        if (typeof last === "number" && page - last > 1) {
          pages.push("...");
        } else if (last === "...") {
          // Rien à ajouter : l'ellipse est déjà présente.
        }

        pages.push(page);
      }
    }

    return pages;
  }, [totalPages, currentPage]);

  // =======================================================
  // NAVIGATION DEPUIS UNE NOTIFICATION
  // =======================================================

  const handleNotificationClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    n: NotificationRow
  ) => {
    event.preventDefault();

    if (!n.is_read) {
      markRead(n.id);
    }

    const target = parseAdminLink(n.link) ?? {
      to: "/admin/notifications",
      search: {},
    };

    if (n.type === "order" && !target.search["order"]) {
      const reference = orderReferenceFromTitle(n.title);

      if (reference) {
        target.to = "/admin/commandes";

        target.search = {
          ...target.search,
          ref: reference,
        };
      }
    }

    if (n.type === "stock" && !target.search["produit"]) {
      const name = productNameFromBody(n.body);

      if (name) {
        target.to = "/admin/produits";

        target.search = {
          ...target.search,
          nom: name,
        };
      }
    }

    setAdminFocus({
      path: target.to,
      search: target.search,
    });

    navigate({
      to: target.to as "/admin/notifications",
      search: target.search,
    });
  };

  // =======================================================
  // RENDU
  // =======================================================

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-7 pb-8">

      {/* HEADER */}

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">

        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

          <div className="flex items-start gap-4">

            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:h-14 sm:w-14">
              <BellRing className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div className="min-w-0">

              <div className="mb-1 flex flex-wrap items-center gap-2">

                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  Centre de notifications
                </span>

                {unreadCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                  </span>
                )}

              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Notifications
              </h1>

              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Retrouvez ici les événements importants concernant vos commandes,
                les avis clients et la gestion de votre stock.
              </p>

            </div>
          </div>

          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="h-10 shrink-0 gap-2 rounded-xl"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>

        </div>

        {/* STATISTIQUES */}

        <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">

          <div className="flex items-center gap-3 rounded-xl bg-surface/60 p-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total notifications
              </p>
              <p className="text-xl font-bold tabular-nums">
                {items.length}
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3 rounded-xl bg-surface/60 p-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
              <Clock3 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Non lues
              </p>
              <p className="text-xl font-bold tabular-nums">
                {unreadCount}
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3 rounded-xl bg-surface/60 p-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CircleCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Lues
              </p>
              <p className="text-xl font-bold tabular-nums">
                {readCount}
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* FILTRES */}

      {items.length > 0 && (
        <div className="space-y-3">

          <div className="flex flex-wrap items-center justify-between gap-2">

            <div>
              <h2 className="text-base font-semibold">
                Vos notifications
              </h2>

              <p className="text-xs text-muted-foreground">
                Filtrez les notifications par catégorie.
              </p>
            </div>

            <span className="text-xs font-medium text-muted-foreground">
              {visible.length} résultat{visible.length > 1 ? "s" : ""}
            </span>

          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">

            {typeTabs.map((tab) => {
              const Icon =
                tab.value === "all"
                  ? Bell
                  : TYPE_ICONS[tab.value] ?? Bell;

              const active = typeFilter === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setTypeFilter(tab.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />

                  {tab.label}

                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-bold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-surface text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}

          </div>
        </div>
      )}

      {/* BARRE DE SÉLECTION */}

      {visible.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">

          <label className="flex cursor-pointer items-center gap-3 text-sm">

            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAllVisible}
            />

            <span className="font-medium">
              {selectedVisibleIds.length > 0
                ? `${selectedVisibleIds.length} notification${selectedVisibleIds.length > 1 ? "s" : ""} sélectionnée${selectedVisibleIds.length > 1 ? "s" : ""}`
                : "Tout sélectionner"}
            </span>

          </label>

          <div className="flex items-center gap-2">

            {selectedVisibleIds.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedVisibleIds.length} élément(s) sélectionné(s)
              </span>
            )}

            <Button
              variant="destructive"
              size="sm"
              disabled={selectedVisibleIds.length === 0}
              onClick={() => setConfirmBulkDelete(true)}
              className="h-9 gap-2 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la sélection
            </Button>

          </div>
        </div>
      )}

      {/* LISTE DES NOTIFICATIONS */}

      {loading ? (

        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-card">
          <Spinner showLabel />
        </div>

      ) : visible.length === 0 ? (

        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">

          <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-primary/5">
            {items.length === 0 ? (
              <Inbox className="h-9 w-9 text-muted-foreground" />
            ) : (
              <Bell className="h-9 w-9 text-muted-foreground" />
            )}
          </div>

          <h3 className="text-lg font-semibold">
            {items.length === 0
              ? "Aucune notification pour le moment"
              : "Aucune notification de ce type"}
          </h3>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {items.length === 0
              ? "Les nouvelles commandes, les avis clients et les alertes de stock apparaîtront ici."
              : "Aucune notification ne correspond à cette catégorie. Essayez un autre filtre."}
          </p>

          {typeFilter !== "all" && items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-5 rounded-lg"
              onClick={() => setTypeFilter("all")}
            >
              Afficher toutes les notifications
            </Button>
          )}

        </div>

      ) : (

        <div className="space-y-3">

          {paginatedItems.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const style = getNotificationStyle(n.type);
            const selected = selectedIds.includes(n.id);

            return (
              <div
                key={n.id}
                className={cn(
                  "group relative flex gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200 sm:gap-4 sm:p-5",
                  n.is_read
                    ? "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                    : "border-primary/25 bg-primary/[0.035] shadow-sm hover:border-primary/40",
                  selected && "ring-2 ring-primary/20"
                )}
              >

                {!n.is_read && (
                  <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />
                )}

                {/* CHECKBOX */}

                <div className="flex shrink-0 items-start pt-1">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleSelected(n.id)}
                    aria-label={`Sélectionner « ${n.title} »`}
                  />
                </div>

                {/* ICÔNE */}

                <div
                  className={cn(
                    "mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12",
                    style.background
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 sm:h-[22px] sm:w-[22px]",
                      style.icon
                    )}
                  />
                </div>

                {/* CONTENU */}

                <a
                  href={n.link ?? "/admin/notifications"}
                  onClick={(event) => handleNotificationClick(event, n)}
                  className="min-w-0 flex-1 cursor-pointer"
                >

                  <div className="flex flex-wrap items-center gap-2">

                    <h3 className="break-words text-sm font-semibold text-foreground sm:text-base">
                      {n.title}
                    </h3>

                    {!n.is_read && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Nouveau
                      </span>
                    )}

                  </div>

                  {n.body && (
                    <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
                      {n.body}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">

                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold",
                        style.label
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>

                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatNotificationDate(n.created_at)}
                    </span>

                  </div>

                </a>

                {/* ACTIONS */}

                <div className="flex shrink-0 items-start gap-1">

                  {!n.is_read && (
                    <button
                      type="button"
                      aria-label="Marquer comme lu"
                      title="Marquer comme lu"
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
                      onClick={() => markRead(n.id)}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Supprimer"
                    title="Supprimer"
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(n.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <ArrowRight className="mt-2 hidden h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-1 group-hover:text-primary sm:block" />

                </div>

              </div>
            );
          })}

        </div>
      )}

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {!loading && visible.length > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          {/* INFORMATIONS */}

          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              Affichage de{" "}
              <span className="font-semibold text-foreground">
                {startItem}–{endItem}
              </span>{" "}
              sur{" "}
              <span className="font-semibold text-foreground">
                {visible.length}
              </span>{" "}
              notifications
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </p>
          </div>

          {/* NAVIGATION */}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
                className="h-9 rounded-lg px-3"
              >
                Précédent
              </Button>

              {pageNumbers.map((page, index) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1 text-sm text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={
                      currentPage === page ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-9 min-w-9 rounded-lg px-2.5"
                    aria-current={
                      currentPage === page ? "page" : undefined
                    }
                  >
                    {page}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(totalPages, prev + 1)
                  )
                }
                className="h-9 rounded-lg px-3"
              >
                Suivant
              </Button>

            </div>
          )}

        </div>
      )}

      {/* =====================================================
          DIALOG SUPPRESSION MULTIPLE
      ===================================================== */}

      <Dialog
        open={confirmBulkDelete}
        onOpenChange={(open) =>
          !open && !deleting && setConfirmBulkDelete(false)
        }
      >
        <DialogContent className="max-w-md rounded-2xl">

          <DialogHeader>

            <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>

            <DialogTitle className="text-lg">
              Supprimer les notifications ?
            </DialogTitle>

            <DialogDescription className="pt-1">
              Vous êtes sur le point de supprimer{" "}
              <strong className="text-foreground">
                {selectedVisibleIds.length} notification
                {selectedVisibleIds.length > 1 ? "s" : ""}
              </strong>
              . Cette action est irréversible.
            </DialogDescription>

          </DialogHeader>

          <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row">

            <Button
              variant="outline"
              onClick={() => setConfirmBulkDelete(false)}
              disabled={deleting}
              className="rounded-lg"
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={removeSelected}
              disabled={deleting}
              className="gap-2 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
              {deleting
                ? "Suppression…"
                : "Confirmer la suppression"}
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
}
