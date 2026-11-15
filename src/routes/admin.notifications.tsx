import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell, CheckCheck, PackageX, ShoppingBag, Star, Trash2, ArrowRight, Inbox,
  CircleCheck, Clock3, BellRing,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import type { Database } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Spinner from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { orderReferenceFromTitle, parseAdminLink, productNameFromBody } from "@/lib/admin-links";
import { setAdminFocus } from "@/lib/admin-focus";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const ITEMS_PER_PAGE = 10;

const TYPE_ICONS: Record<string, typeof Bell> = { order: ShoppingBag, review: Star, stock: PackageX };
const TYPE_LABELS: Record<string, string> = { order: "Commandes", review: "Avis clients", stock: "Alertes stock" };

const TYPE_STYLES: Record<string, { icon: string; background: string; label: string; }> = {
  order: { icon: "text-green-700", background: "bg-green-50", label: "text-green-700 bg-green-50" },
  review: { icon: "text-green-700", background: "bg-green-50", label: "text-green-700 bg-green-50" },
  stock: { icon: "text-green-700", background: "bg-green-50", label: "text-green-700 bg-green-50" },
};

function getNotificationStyle(type: string) {
  return TYPE_STYLES[type] ?? { icon: "text-green-700", background: "bg-green-50", label: "text-green-700 bg-green-50" };
}

function formatNotificationDate(date: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function AdminNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) { console.error("load notifications", err); toast.error("Impossible de charger les notifications."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelectedIds([]); setCurrentPage(1); }, [typeFilter]);

  const markRead = async (id: string) => {
    const previousItems = items;
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) { console.error("mark read", error); toast.error("Impossible de marquer cette notification comme lue."); setItems(previousItems); }
  };

  const markAllRead = async () => {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const previousItems = items;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    if (error) { console.error("mark all read", error); setItems(previousItems); toast.error("Impossible de tout marquer comme lu."); }
    else { toast.success("Toutes les notifications sont marquées comme lues."); }
  };

  const remove = async (id: string) => {
    const removed = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) { console.error("delete notification", error); if (removed) setItems((prev) => [removed, ...prev]); toast.error("Impossible de supprimer la notification."); }
    else { toast.success("Notification supprimée."); }
  };

  const removeSelected = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const snapshot = items;
    const idsToDelete = [...selectedIds];
    const count = idsToDelete.length;
    setItems((prev) => prev.filter((n) => !idsToDelete.includes(n.id)));
    const { error } = await supabase.from("notifications").delete().in("id", idsToDelete);
    setDeleting(false);
    setConfirmBulkDelete(false);
    if (error) { console.error("bulk delete notifications", error); setItems(snapshot); toast.error("Impossible de supprimer les notifications sélectionnées."); return; }
    setSelectedIds([]);
    toast.success(`${count} notification${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}.`);
  };

  const unreadCount = items.filter((n) => !n.is_read).length;
  const readCount = items.length - unreadCount;

  const typeTabs = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((n) => { counts.set(n.type, (counts.get(n.type) ?? 0) + 1); });
    return [{ value: "all", label: "Toutes", count: items.length }, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ value: type, label: TYPE_LABELS[type] ?? type, count }))];
  }, [items]);

  const visible = useMemo(() => typeFilter === "all" ? items : items.filter((n) => n.type === typeFilter), [items, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => { const startIndex = (currentPage - 1) * ITEMS_PER_PAGE; return visible.slice(startIndex, startIndex + ITEMS_PER_PAGE); }, [visible, currentPage]);
  const startItem = visible.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, visible.length);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const visibleIds = paginatedItems.map((n) => n.id);
  const selectedVisibleIds = selectedIds.filter((id) => visibleIds.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;

  const toggleSelected = (id: string) => { setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); };
  const toggleSelectAllVisible = () => { setSelectedIds((prev) => allVisibleSelected ? prev.filter((id) => !visibleIds.includes(id)) : [...new Set([...prev, ...visibleIds])]); };

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    for (let page = 1; page <= totalPages; page++) {
      if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
        const last = pages[pages.length - 1];
        if (typeof last === "number" && page - last > 1) { pages.push("..."); } else if (last === "...") { /* déjà présent */ }
        pages.push(page);
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLAnchorElement>, n: NotificationRow) => {
    event.preventDefault();
    if (!n.is_read) markRead(n.id);
    const target = parseAdminLink(n.link) ?? { to: "/admin/notifications", search: {} };
    if (n.type === "order" && !target.search["order"]) { const reference = orderReferenceFromTitle(n.title); if (reference) { target.to = "/admin/commandes"; target.search = { ...target.search, ref: reference }; } }
    if (n.type === "stock" && !target.search["produit"]) { const name = productNameFromBody(n.body); if (name) { target.to = "/admin/produits"; target.search = { ...target.search, nom: name }; } }
    setAdminFocus({ path: target.to, search: target.search });
    navigate({ to: target.to as "/admin/notifications", search: target.search });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-7 bg-white pb-8">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-green-500/5 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-50 text-green-700 sm:h-14 sm:w-14"><BellRing className="h-6 w-6 sm:h-7 sm:w-7" /></div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-green-700">Centre de notifications</span>
                {unreadCount > 0 && (<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</span>)}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#123b25] sm:text-3xl">Notifications</h1>
              <p className="mt-1 max-w-xl text-sm text-gray-500">Retrouvez ici les événements importants concernant vos commandes, les avis clients et la gestion de votre stock.</p>
            </div>
          </div>
          <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0} className="h-10 shrink-0 gap-2 rounded-xl border-green-200 text-green-700 hover:bg-green-50"><CheckCheck className="h-4 w-4" />Tout marquer comme lu</Button>
        </div>
        <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Bell className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-gray-500">Total notifications</p><p className="text-xl font-bold tabular-nums text-[#123b25]">{items.length}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700"><Clock3 className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-gray-500">Non lues</p><p className="text-xl font-bold tabular-nums text-[#123b25]">{unreadCount}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700"><CircleCheck className="h-5 w-5" /></div>
            <div><p className="text-xs font-medium text-gray-500">Lues</p><p className="text-xl font-bold tabular-nums text-[#123b25]">{readCount}</p></div>
          </div>
        </div>
      </div>

      {/* FILTRES */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-base font-semibold text-[#123b25]">Vos notifications</h2><p className="text-xs text-gray-500">Filtrez les notifications par catégorie.</p></div>
            <span className="text-xs font-medium text-gray-400">{visible.length} résultat{visible.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {typeTabs.map((tab) => {
              const Icon = tab.value === "all" ? Bell : TYPE_ICONS[tab.value] ?? Bell;
              const active = typeFilter === tab.value;
              return (
                <button key={tab.value} type="button" onClick={() => setTypeFilter(tab.value)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200", active ? "border-green-700 bg-green-700 text-white shadow-sm" : "border-green-200 bg-white text-gray-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700")}>
                  <Icon className="h-4 w-4" />{tab.label}
                  <span className={cn("grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-bold", active ? "bg-white/20 text-white" : "bg-green-50 text-green-700")}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BARRE DE SÉLECTION */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-green-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} className="border-green-300 data-[state=checked]:bg-green-600" />
            <span className="font-medium text-[#123b25]">{selectedVisibleIds.length > 0 ? `${selectedVisibleIds.length} notification${selectedVisibleIds.length > 1 ? "s" : ""} sélectionnée${selectedVisibleIds.length > 1 ? "s" : ""}` : "Tout sélectionner"}</span>
          </label>
          <div className="flex items-center gap-2">
            {selectedVisibleIds.length > 0 && (<span className="text-xs text-gray-400">{selectedVisibleIds.length} élément(s) sélectionné(s)</span>)}
            <Button variant="destructive" size="sm" disabled={selectedVisibleIds.length === 0} onClick={() => setConfirmBulkDelete(true)} className="h-9 gap-2 rounded-lg bg-red-600 text-white hover:bg-red-700"><Trash2 className="h-4 w-4" />Supprimer la sélection</Button>
          </div>
        </div>
      )}

      {/* LISTE */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-green-100 bg-white"><Spinner showLabel /></div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-green-200 bg-white px-5 py-12 text-center">
          <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-green-50">{items.length === 0 ? <Inbox className="h-9 w-9 text-green-700" /> : <Bell className="h-9 w-9 text-green-700" />}</div>
          <h3 className="text-lg font-semibold text-[#123b25]">{items.length === 0 ? "Aucune notification pour le moment" : "Aucune notification de ce type"}</h3>
          <p className="mt-2 max-w-md text-sm text-gray-500">{items.length === 0 ? "Les nouvelles commandes, les avis clients et les alertes de stock apparaîtront ici." : "Aucune notification ne correspond à cette catégorie. Essayez un autre filtre."}</p>
          {typeFilter !== "all" && items.length > 0 && (<Button variant="outline" size="sm" className="mt-5 rounded-lg border-green-200 text-green-700 hover:bg-green-50" onClick={() => setTypeFilter("all")}>Afficher toutes les notifications</Button>)}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedItems.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const style = getNotificationStyle(n.type);
            const selected = selectedIds.includes(n.id);
            return (
              <div key={n.id} className={cn("group relative flex gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200 sm:gap-4 sm:p-5", n.is_read ? "border-green-100 bg-white hover:border-green-300 hover:shadow-sm" : "border-green-200 bg-green-50/30 shadow-sm hover:border-green-400", selected && "ring-2 ring-green-200")}>
                {!n.is_read && (<div className="absolute bottom-0 left-0 top-0 w-1 bg-green-600" />)}
                <div className="flex shrink-0 items-start pt-1"><Checkbox checked={selected} onCheckedChange={() => toggleSelected(n.id)} className="border-green-300 data-[state=checked]:bg-green-600" aria-label={`Sélectionner « ${n.title} »`} /></div>
                <div className={cn("mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12", style.background)}><Icon className={cn("h-5 w-5 sm:h-[22px] sm:w-[22px]", style.icon)} /></div>
                <a href={n.link ?? "/admin/notifications"} onClick={(event) => handleNotificationClick(event, n)} className="min-w-0 flex-1 cursor-pointer">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-sm font-semibold text-[#123b25] sm:text-base">{n.title}</h3>
                    {!n.is_read && (<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-600" />Nouveau</span>)}
                  </div>
                  {n.body && (<p className="mt-2 break-words text-sm leading-relaxed text-gray-500">{n.body}</p>)}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold", style.label)}><Icon className="h-3 w-3" />{TYPE_LABELS[n.type] ?? n.type}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400"><Clock3 className="h-3.5 w-3.5" />{formatNotificationDate(n.created_at)}</span>
                  </div>
                </a>
                <div className="flex shrink-0 items-start gap-1">
                  {!n.is_read && (<button type="button" aria-label="Marquer comme lu" title="Marquer comme lu" className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-green-50 hover:text-green-700" onClick={() => markRead(n.id)}><CheckCheck className="h-4 w-4" /></button>)}
                  <button type="button" aria-label="Supprimer" title="Supprimer" className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4" /></button>
                  <ArrowRight className="mt-2 hidden h-4 w-4 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-green-700 sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {!loading && visible.length > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-500">Affichage de <span className="font-semibold text-[#123b25]">{startItem}–{endItem}</span> sur <span className="font-semibold text-[#123b25]">{visible.length}</span> notifications</p>
            <p className="mt-1 text-xs text-gray-400">Page {currentPage} sur {totalPages}</p>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} className="h-9 rounded-lg border-green-200 px-3 text-green-700 hover:bg-green-50">Précédent</Button>
              {pageNumbers.map((page, index) => page === "..." ? (<span key={`ellipsis-${index}`} className="px-1 text-sm text-gray-400">...</span>) : (
                <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page)} className={cn("h-9 min-w-9 rounded-lg px-2.5", currentPage === page ? "bg-green-700 text-white hover:bg-green-800" : "border-green-200 text-green-700 hover:bg-green-50")} aria-current={currentPage === page ? "page" : undefined}>{page}</Button>
              ))}
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} className="h-9 rounded-lg border-green-200 px-3 text-green-700 hover:bg-green-50">Suivant</Button>
            </div>
          )}
        </div>
      )}

      {/* DIALOG SUPPRESSION MULTIPLE */}
      <Dialog open={confirmBulkDelete} onOpenChange={(open) => !open && !deleting && setConfirmBulkDelete(false)}>
        <DialogContent className="max-w-md rounded-2xl border-green-100">
          <DialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <DialogTitle className="text-lg text-[#123b25]">Supprimer les notifications ?</DialogTitle>
            <DialogDescription className="pt-1">Vous êtes sur le point de supprimer <strong className="text-[#123b25]">{selectedVisibleIds.length} notification{selectedVisibleIds.length > 1 ? "s" : ""}</strong>. Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)} disabled={deleting} className="rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button variant="destructive" onClick={removeSelected} disabled={deleting} className="gap-2 rounded-lg bg-red-600 text-white hover:bg-red-700"><Trash2 className="h-4 w-4" />{deleting ? "Suppression…" : "Confirmer la suppression"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}