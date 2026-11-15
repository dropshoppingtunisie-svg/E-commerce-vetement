import { createFileRoute } from "@tanstack/react-router";
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderTree, Folder, Layers, Package, Pencil, Plus, Trash2, Eye, ChevronRight, ChevronDown,
  Search, X, RefreshCw, ImagePlus, Upload, GripVertical, Check, AlertCircle, FolderOpen,
  ArrowUp, ArrowDown, Hash, CalendarDays, FileText, MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Category } from "@/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Spinner from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { uploadToBucket, deleteFromBucket } from "@/lib/storage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { randomUUID } from "@/lib/uid";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

type SortDirection = "asc" | "desc";
type CategoryStatProps = { title: string; value: number; description: string; icon: LucideIcon; iconClassName: string; };

const PAGE_SIZE = 10;
const MAX_IMAGE_MB = 5;

const empty: Category = { id: "", parent_id: null, name: "", slug: "", description: "", image_url: null };

function normalizeCategory(row: any): Category {
  return {
    id: String(row.id), parent_id: row.parent_id ?? row.id, name: row.name ?? "", slug: row.slug ?? "",
    description: row.description ?? null, image_url: row.image_url ?? null,
    subcategories_count: Number(row.subcategories_count ?? 0),
    created_at: row.created_at ?? undefined, updated_at: row.updated_at ?? undefined,
  };
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitizeFileName(fileName: string): string {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()!.toLowerCase()}` : "";
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${slugify(baseName) || "image"}${extension}`;
}

function compareUpdatedAt(a: Category, b: Category): number {
  const aUpdated = a.updated_at ? Date.parse(a.updated_at) : 0;
  const bUpdated = b.updated_at ? Date.parse(b.updated_at) : 0;
  return bUpdated - aUpdated;
}

function formatCategoryDate(date?: string | null): string {
  if (!date) return "Non disponible";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Non disponible";
  return parsed.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

function extractStoragePath(url: string) {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1]!, path: decodeURIComponent(match[2]!) };
}

function StatCard({ title, value, description, icon: Icon, iconClassName }: CategoryStatProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-green-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#123b25] sm:text-3xl">{value.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-5 h-24 w-24 rounded-full bg-green-500/[0.035] transition-transform duration-500 group-hover:scale-150" />
    </div>
  );
}

function LoadingTableRow() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-64 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-green-600 border-t-transparent" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#123b25]">Chargement des catégories</p>
            <p className="text-xs text-gray-400">Récupération des données...</p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyTableRow({ hasSearch, onReset, onCreate }: { hasSearch: boolean; onReset: () => void; onCreate: () => void; }) {
  return (
    <TableRow>
      <TableCell colSpan={5}>
        <div className="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
            {hasSearch ? <Search className="h-7 w-7 text-gray-300" /> : <FolderOpen className="h-7 w-7 text-gray-300" />}
          </div>
          <h3 className="text-base font-semibold text-[#123b25]">{hasSearch ? "Aucune catégorie trouvée" : "Aucune catégorie disponible"}</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">{hasSearch ? "Aucun résultat ne correspond à votre recherche." : "Commencez par créer votre première catégorie pour organiser vos produits."}</p>
          <div className="mt-5">
            {hasSearch ? (
              <Button variant="outline" size="sm" onClick={onReset} className="border-green-200 text-green-700 hover:bg-green-50"><X className="mr-2 h-4 w-4" />Effacer la recherche</Button>
            ) : (
              <Button size="sm" onClick={onCreate} className="bg-green-700 text-white hover:bg-green-800"><Plus className="mr-2 h-4 w-4" />Créer une catégorie</Button>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AdminCategories() {
  const { profile } = useAuth();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Category>(empty);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [viewCategory, setViewCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [parentSearch, setParentSearch] = useState("");
  const [parentOptions, setParentOptions] = useState<Category[]>([]);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadCategories = useCallback(async (showNotification = false) => {
    if (showNotification) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.from("categories").select("*").order("updated_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      setList((data ?? []).map(normalizeCategory));
      if (showNotification) toast.success("Catégories actualisées.");
    } catch (error) {
      console.error("load categories:", error);
      toast.error("Impossible de charger les catégories.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  useEffect(() => {
    if (!parentMenuOpen) return;
    let active = true;
    const loadParentOptions = async () => {
      let query = supabase.from("categories").select("*").order("name", { ascending: true }).limit(30);
      const term = parentSearch.trim();
      if (term) query = query.ilike("name", `%${term}%`);
      const { data, error } = await query;
      if (error) { console.error("load parent categories:", error); return; }
      if (active) setParentOptions((data ?? []).map(normalizeCategory));
    };
    void loadParentOptions();
    return () => { active = false; };
  }, [parentMenuOpen, parentSearch]);

  const isDescendant = useCallback((categoryId: string, ancestorId: string): boolean => {
    if (!ancestorId) return false;
    const visited = new Set<string>();
    let currentId: string | null = categoryId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const category = list.find((item) => item.id === currentId);
      if (!category) return false;
      if (category.parent_id === ancestorId) return true;
      currentId = category.parent_id;
    }
    return false;
  }, [list]);

  const availableParents = useMemo(() => list.filter((category) => category.id !== draft.id && !isDescendant(category.id, draft.id)), [list, draft.id, isDescendant]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((category) => {
      if (!term) return true;
      return category.name.toLowerCase().includes(term) || (category.slug ?? "").toLowerCase().includes(term) || (category.description ?? "").toLowerCase().includes(term);
    }).sort(compareUpdatedAt);
  }, [list, search]);

  const topLevel = useMemo(() => filtered.filter((category) => category.parent_id === category.id), [filtered]);
  const displayRoots = useMemo(() => search.trim() ? (topLevel.length > 0 ? topLevel : filtered) : topLevel, [search, topLevel, filtered]);

  const statistics = useMemo(() => {
    const total = list.length;
    const mainCategories = list.filter((category) => category.parent_id === category.id).length;
    const subCategories = total - mainCategories;
    const totalProducts = list.reduce((sum, category) => sum + (category.subcategories_count ?? 0), 0);
    return { total, mainCategories, subCategories, totalProducts };
  }, [list]);

  const totalPages = Math.max(1, Math.ceil(displayRoots.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = displayRoots.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, displayRoots.length);
  const paginatedRoots = displayRoots.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  useEffect(() => { setCurrentPage(1); }, [search]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const toggleExpanded = (id: string) => setExpandedMap((current) => ({ ...current, [id]: !current[id] }));

  const allVisibleSelected = filtered.length > 0 && filtered.every((category) => selectedCategoryIds.includes(category.id));

  const toggleCategorySelection = (id: string, checked: boolean) => {
    setSelectedCategoryIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  };

  const toggleAllVisibleCategories = (checked: boolean) => {
    if (checked) setSelectedCategoryIds((current) => [...new Set([...current, ...filtered.map((category) => category.id)])]);
    else {
      const visibleIds = new Set(filtered.map((category) => category.id));
      setSelectedCategoryIds((current) => current.filter((id) => !visibleIds.has(id)));
    }
  };

  const resetForm = () => {
    setDraft(empty); setFile(null); setImgError(null); setNameError(""); setParentSearch(""); setParentMenuOpen(false); setDragOver(false);
  };

  const openCreateDialog = () => { resetForm(); setOpen(true); };
  const openEditDialog = (category: Category) => { setDraft({ ...category }); setFile(null); setImgError(null); setNameError(""); setParentSearch(""); setOpen(true); };

  const validateAndSetFile = (selectedFile: File | null) => {
    setImgError(null);
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) { setImgError("Le fichier doit être une image."); return; }
    if (selectedFile.size > MAX_IMAGE_MB * 1024 * 1024) { setImgError(`L'image ne doit pas dépasser ${MAX_IMAGE_MB} Mo.`); return; }
    setFile(selectedFile);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragOver(false); validateAndSetFile(event.dataTransfer.files?.[0] ?? null);
  };

  const save = async () => {
    const categoryName = draft.name.trim();
    if (!categoryName) { setNameError("Le nom de la catégorie est obligatoire."); nameInputRef.current?.focus(); return; }
    if (imgError) return;
    if (!profile) { toast.error("Vous devez être connecté en tant qu'administrateur."); return; }
    const categoryId = draft.id || randomUUID();
    const parentId = draft.parent_id || categoryId;
    if (parentId !== categoryId && isDescendant(parentId, categoryId)) { toast.error("Une catégorie ne peut pas être placée dans sa propre descendance."); return; }
    const slug = slugify(categoryName);
    const updatedAt = new Date().toISOString();
    setSaving(true);
    try {
      let imageUrl = draft.image_url ?? null;
      if (file) {
        const filename = `${Date.now()}-${sanitizeFileName(file.name)}`;
        const path = `categories/${filename}`;
        imageUrl = await uploadToBucket("categories", path, file);
      }
      if (draft.id) {
        const { error } = await supabase.from("categories").update({ name: categoryName, slug, parent_id: parentId, description: draft.description?.trim() || null, image_url: imageUrl, updated_at: updatedAt }).eq("id", draft.id);
        if (error) throw error;
        setList((previous) => previous.map((category) => category.id === draft.id ? { ...category, name: categoryName, slug, parent_id: parentId, description: draft.description?.trim() || null, image_url: imageUrl, updated_at: updatedAt } : category));
        toast.success("Catégorie mise à jour.");
      } else {
        const payload = { id: categoryId, name: categoryName, slug, parent_id: parentId, description: draft.description?.trim() || null, image_url: imageUrl, updated_at: updatedAt };
        const { data, error } = await supabase.from("categories").insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data) setList((previous) => [...previous, normalizeCategory(data)]);
        toast.success("Nouvelle catégorie créée.");
      }
      setOpen(false); resetForm();
    } catch (error: any) {
      console.error("save category:", error);
      const message = String(error?.message ?? "");
      toast.error(message.toLowerCase().includes("invalid key") ? "Nom de fichier image invalide." : "Impossible d'enregistrer la catégorie.");
    } finally { setSaving(false); }
  };

  const removeImage = async () => {
    if (!draft.image_url) { setFile(null); setDraft((current) => ({ ...current, image_url: null })); return; }
    if (!profile) { toast.error("Action non autorisée."); return; }
    setSaving(true);
    try {
      const storage = extractStoragePath(draft.image_url);
      if (storage) await deleteFromBucket(storage.bucket, storage.path);
      if (draft.id) {
        const { error } = await supabase.from("categories").update({ image_url: null }).eq("id", draft.id);
        if (error) throw error;
        setList((current) => current.map((category) => category.id === draft.id ? { ...category, image_url: null } : category));
      }
      setDraft((current) => ({ ...current, image_url: null }));
      setFile(null);
      toast.success("Image supprimée.");
    } catch (error) { console.error("remove image:", error); toast.error("Impossible de supprimer l'image."); }
    finally { setSaving(false); }
  };

  const deleteCategory = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setSaving(true);
    try {
      const { data, error: fetchError } = await supabase.from("categories").select("image_url").eq("id", id).maybeSingle();
      if (fetchError) throw fetchError;
      if (data?.image_url) {
        const storage = extractStoragePath(data.image_url);
        if (storage) { try { await deleteFromBucket(storage.bucket, storage.path); } catch (imageError) { console.warn("Failed to delete category image:", imageError); } }
      }
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await loadCategories();
      setSelectedCategoryIds((current) => current.filter((selectedId) => selectedId !== id));
      toast.success("Catégorie supprimée.");
    } catch (error) { console.error("delete category:", error); toast.error("Impossible de supprimer la catégorie."); }
    finally { setSaving(false); setConfirmDeleteId(null); }
  };

  const deleteSelectedCategories = async () => {
    if (confirmDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase.from("categories").delete().in("id", confirmDeleteIds);
      if (error) throw error;
      const deletedIds = new Set(confirmDeleteIds);
      setSelectedCategoryIds((current) => current.filter((id) => !deletedIds.has(id)));
      setConfirmDeleteIds([]);
      await loadCategories();
      toast.success(`${deletedIds.size} catégorie${deletedIds.size > 1 ? "s" : ""} supprimée${deletedIds.size > 1 ? "s" : ""}.`);
    } catch (error) { console.error("bulk delete:", error); toast.error("Impossible de supprimer les catégories sélectionnées."); }
    finally { setIsBulkDeleting(false); }
  };

  const moveCategory = async (draggedId: string, targetId: string | null) => {
    if (!draggedId || targetId === draggedId) return;
    if (targetId && isDescendant(targetId, draggedId)) { toast.error("Impossible de déplacer une catégorie dans sa propre descendance."); return; }
    const newParentId = targetId ?? draggedId;
    try {
      setLoading(true);
      const { error } = await supabase.from("categories").update({ parent_id: newParentId, updated_at: new Date().toISOString() }).eq("id", draggedId);
      if (error) throw error;
      await loadCategories();
      if (targetId) { setExpandedMap((current) => ({ ...current, [targetId]: true })); toast.success("Catégorie déplacée."); }
      else toast.success("Catégorie déplacée au niveau principal.");
    } catch (error) { console.error("move category:", error); toast.error("Impossible de déplacer la catégorie."); }
    finally { setLoading(false); setDragId(null); setDragOverId(null); }
  };

  const onDropToRoot = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain") || dragId;
    if (dragged) void moveCategory(dragged, null);
  };

  const renderRow = (category: Category, level = 0, path = new Set<string>()): React.ReactNode => {
    if (path.has(category.id)) return null;
    const nextPath = new Set(path);
    nextPath.add(category.id);
    const children = list.filter((item) => item.parent_id === category.id && item.id !== category.id).sort(compareUpdatedAt);
    const isExpanded = !!expandedMap[category.id];
    const isSelected = selectedCategoryIds.includes(category.id);
    const isDragging = dragId === category.id;
    const isDragTarget = dragOverId === category.id;
    return (
      <Fragment key={category.id}>
        <TableRow
          draggable={!loading}
          onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", category.id); setDragId(category.id); }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
          onDragOver={(event) => { event.preventDefault(); if (dragId && isDescendant(category.id, dragId)) return; setDragOverId(category.id); }}
          onDragLeave={() => { setDragOverId((current) => current === category.id ? null : current); }}
          onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData("text/plain") || dragId; if (dragged) void moveCategory(dragged, category.id); }}
          className={`group transition-colors hover:bg-green-50/30 ${isSelected ? "bg-green-50/40" : ""} ${isDragging ? "opacity-40" : ""} ${isDragTarget ? "bg-green-50 outline outline-1 outline-green-400" : ""}`}
        >
          <TableCell className="w-12 px-3">
            <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleCategorySelection(category.id, checked === true)} className="border-green-300 data-[state=checked]:bg-green-600" disabled={loading} />
          </TableCell>
          <TableCell className="min-w-[240px] px-3">
            <div className="flex min-w-0 items-center" style={{ paddingLeft: `${Math.min(level, 5) * 24}px` }}>
              <div className="mr-2 flex shrink-0 cursor-grab items-center text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"><GripVertical className="h-4 w-4" /></div>
              {level > 0 && <div className="mr-2 flex h-10 items-center"><span className="h-px w-4 bg-gray-200" /></div>}
              <Avatar className="h-10 w-10 shrink-0 rounded-lg border border-green-100">
                {category.image_url && <AvatarImage src={category.image_url} alt={category.name} className="object-cover" />}
                <AvatarFallback className="rounded-lg bg-green-50 text-sm font-bold text-green-700">{category.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="ml-2 flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm text-[#123b25] ${level === 0 ? "font-semibold" : "font-medium"}`}>{category.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-400">{level === 0 ? "Catégorie principale" : `Sous-catégorie · Niveau ${level + 1}`}</p>
                </div>
                {children.length > 0 && (
                  <button type="button" onClick={() => toggleExpanded(category.id)} aria-label={isExpanded ? "Réduire" : "Afficher"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-green-50 hover:text-green-700">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="max-w-[260px] px-3">
            <p className="max-w-[260px] truncate text-sm text-gray-500" title={category.description ?? ""}>{category.description || "Aucune description"}</p>
          </TableCell>
          <TableCell className="px-3 text-center">
            <span className="inline-flex min-w-9 items-center justify-center rounded-lg border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-green-700">{category.subcategories_count ?? 0}</span>
          </TableCell>
          <TableCell className="px-3 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button size="icon" variant="ghost" aria-label="Voir" title="Voir" className="h-8 w-8 text-gray-400 hover:bg-green-50 hover:text-green-700" onClick={() => setViewCategory(category)}><Eye className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Modifier" title="Modifier" className="h-8 w-8 text-gray-400 hover:bg-green-50 hover:text-green-700" onClick={() => openEditDialog(category)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Supprimer" title="Supprimer" className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDeleteId(category.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && children.map((child) => renderRow(child, level + 1, nextPath))}
      </Fragment>
    );
  };

  return (
    <div className="space-y-7 bg-white pb-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-green-100 bg-green-50 text-green-700"><FolderTree className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#123b25]">Catégories</h1>
            <p className="mt-0.5 text-sm text-gray-500">Gérez et organisez vos catégories et sous-catégories.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadCategories(true)} disabled={loading || refreshing} className="gap-2 border-green-200 text-green-700 hover:bg-green-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Actualiser</span></Button>
          <Button onClick={openCreateDialog} className="gap-2 bg-green-700 text-white shadow-sm hover:bg-green-800"><Plus className="h-4 w-4" />Nouvelle catégorie</Button>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total catégories" value={statistics.total} description="Toutes les catégories" icon={FolderTree} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Catégories principales" value={statistics.mainCategories} description="Niveaux principaux" icon={Folder} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Sous-catégories" value={statistics.subCategories} description="Catégories secondaires" icon={Layers} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Sous-catégories associées" value={statistics.totalProducts} description="Total des sous-catégories déclarées" icon={Package} iconClassName="bg-green-50 text-green-700" />
      </div>

      {/* CATEGORY MANAGEMENT */}
      <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-[#123b25]">Liste des catégories</h2>
              <p className="mt-1 text-xs text-gray-500">Consultez, modifiez et organisez votre structure.</p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 sm:self-auto">
              <FolderTree className="h-3.5 w-3.5" />{filtered.length} résultat{filtered.length > 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par nom, slug ou description..." className="h-10 border-green-200 bg-gray-50 pl-9 pr-10 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
              {search && (<button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700"><X className="h-4 w-4" /></button>)}
            </div>
            <p className="text-xs text-gray-500"><span className="font-semibold text-[#123b25]">{displayRoots.length}</span> catégorie{displayRoots.length > 1 ? "s" : ""} principale{displayRoots.length > 1 ? "s" : ""} affichée{displayRoots.length > 1 ? "s" : ""}</p>
          </div>
          {search.trim() && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Recherche active :</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{search}<button type="button" onClick={() => setSearch("")} aria-label="Supprimer la recherche"><X className="h-3 w-3" /></button></span>
            </div>
          )}
          {selectedCategoryIds.length > 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600"><Check className="h-4 w-4" /></div>
                <div>
                  <p className="text-sm font-semibold text-red-700">{selectedCategoryIds.length} catégorie{selectedCategoryIds.length > 1 ? "s" : ""} sélectionnée{selectedCategoryIds.length > 1 ? "s" : ""}</p>
                  <p className="text-xs text-gray-500">Vous pouvez supprimer les éléments sélectionnés.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedCategoryIds([])} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler la sélection</Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteIds(selectedCategoryIds)} disabled={loading} className="gap-2 bg-red-600 text-white hover:bg-red-700"><Trash2 className="h-4 w-4" />Supprimer ({selectedCategoryIds.length})</Button>
              </div>
            </div>
          )}
        </div>

        {/* DROP TO ROOT */}
        <div className="px-4 pt-4 sm:px-5">
          <div
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
            onDrop={onDropToRoot}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-center text-xs transition-all ${dragId ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span>{dragId ? "Déposez ici pour déplacer vers le niveau principal" : "Glissez une catégorie vers cette zone pour la déplacer au niveau principal"}</span>
          </div>
        </div>

        {/* TABLE */}
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50/50 hover:bg-green-50/50">
                <TableHead className="w-12 px-3"><Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAllVisibleCategories(checked === true)} className="border-green-300 data-[state=checked]:bg-green-600" aria-label="Sélectionner toutes les catégories visibles" disabled={loading || filtered.length === 0} /></TableHead>
                <TableHead className="min-w-[240px] px-3 text-xs font-semibold uppercase tracking-wide text-green-700/70">Catégorie</TableHead>
                <TableHead className="min-w-[200px] px-3 text-xs font-semibold uppercase tracking-wide text-green-700/70">Description</TableHead>
                <TableHead className="min-w-[130px] px-3 text-center text-xs font-semibold uppercase tracking-wide text-green-700/70">Sous-catégories</TableHead>
                <TableHead className="min-w-[130px] px-3 text-right text-xs font-semibold uppercase tracking-wide text-green-700/70">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <LoadingTableRow /> : displayRoots.length === 0 ? <EmptyTableRow hasSearch={Boolean(search.trim())} onReset={() => setSearch("")} onCreate={openCreateDialog} /> : paginatedRoots.map((category) => renderRow(category))}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        {!loading && displayRoots.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-100 bg-green-50/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-center text-sm text-gray-500 sm:text-left">
              Affichage <span className="font-semibold text-[#123b25]">{pageStart}–{pageEnd}</span> sur <span className="font-semibold text-[#123b25]">{displayRoots.length}</span> catégories
            </div>
            {totalPages > 1 && (
              <Pagination className="mx-0 w-auto justify-center text-[#123b25] sm:justify-end">
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setCurrentPage((page) => Math.max(1, page - 1)); }} aria-disabled={safeCurrentPage === 1} className={safeCurrentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                  {pageNumbers.map((page, index) => page === "dots" ? (<PaginationItem key={`dots-${index}`}><span className="flex h-9 w-7 items-center justify-center text-sm text-gray-400">...</span></PaginationItem>) : (
                    <PaginationItem key={page}><PaginationLink href="#" isActive={safeCurrentPage === page} onClick={(event) => { event.preventDefault(); setCurrentPage(page); }} aria-label={`Page ${page}`} aria-current={safeCurrentPage === page ? "page" : undefined} className={safeCurrentPage === page ? "border-green-600 bg-green-50 text-green-700" : ""}>{page}</PaginationLink></PaginationItem>
                  ))}
                  <PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); setCurrentPage((page) => Math.min(totalPages, page + 1)); }} aria-disabled={safeCurrentPage === totalPages} className={safeCurrentPage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      {/* FOOTER INFO */}
      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-green-100 bg-green-50/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500"><FolderTree className="h-4 w-4 text-green-700" /><span>Organisation hiérarchique des catégories.</span></div>
          <div className="flex items-center gap-2 text-xs text-gray-500"><span className="h-2 w-2 rounded-full bg-green-500" /><span>{list.length} catégorie{list.length > 1 ? "s" : ""} chargée{list.length > 1 ? "s" : ""}</span></div>
        </div>
      )}

      {/* BULK DELETE */}
      <Dialog open={confirmDeleteIds.length > 0} onOpenChange={(value) => { if (!value && !isBulkDeleting) setConfirmDeleteIds([]); }}>
        <DialogContent className="max-w-md border-green-100">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-6 w-6" /></div>
            <DialogTitle className="text-[#123b25]">Supprimer les catégories ?</DialogTitle>
            <DialogDescription>Cette action supprimera définitivement les catégories sélectionnées.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-gray-700">Vous êtes sur le point de supprimer <span className="font-bold">{confirmDeleteIds.length} catégorie{confirmDeleteIds.length > 1 ? "s" : ""}</span>.</p>
            <p className="mt-2 text-xs text-gray-500">Les sous-catégories associées seront également supprimées si la contrainte ON DELETE CASCADE est configurée.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteIds([])} disabled={isBulkDeleting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button onClick={deleteSelectedCategories} disabled={isBulkDeleting} className="gap-2 bg-red-600 text-white hover:bg-red-700">{isBulkDeleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE ONE */}
      <Dialog open={Boolean(confirmDeleteId)} onOpenChange={(value) => { if (!value && !saving) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-md border-green-100">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertCircle className="h-6 w-6" /></div>
            <DialogTitle className="text-[#123b25]">Confirmer la suppression</DialogTitle>
            <DialogDescription>Voulez-vous vraiment supprimer cette catégorie ?</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-gray-500">Les sous-catégories et leurs descendants pourront également être supprimés selon la configuration de votre base de données.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={saving} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button onClick={deleteCategory} disabled={saving} className="gap-2 bg-red-600 text-white hover:bg-red-700">{saving ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW */}
      <Dialog open={Boolean(viewCategory)} onOpenChange={(value) => { if (!value) setViewCategory(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-green-100">
          <div className="flex flex-col items-center pt-2">
            <Avatar className="h-24 w-24 rounded-2xl border border-green-100 shadow-sm">
              {viewCategory?.image_url && <AvatarImage src={viewCategory.image_url} alt={viewCategory.name} className="object-cover" />}
              <AvatarFallback className="rounded-2xl bg-green-50 text-3xl font-bold text-green-700">{viewCategory?.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-center text-xl font-bold text-[#123b25]">{viewCategory?.name}</DialogTitle>
            <DialogDescription className="text-center">Informations détaillées de la catégorie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-green-100 bg-green-50/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#123b25]"><FileText className="h-4 w-4 text-gray-400" />Description</div>
              <p className="text-sm leading-relaxed text-gray-500">{viewCategory?.description || "Aucune description disponible."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-100 p-3"><div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><Layers className="h-4 w-4" />Sous-catégories</div><p className="text-xl font-bold text-[#123b25]">{viewCategory?.subcategories_count ?? 0}</p></div>
              <div className="rounded-xl border border-green-100 p-3"><div className="mb-2 flex items-center gap-2 text-xs text-gray-400"><Hash className="h-4 w-4" />Identifiant</div><p className="truncate text-xs font-semibold text-[#123b25]" title={viewCategory?.id}>{viewCategory?.id ?? "—"}</p></div>
            </div>
            <div className="rounded-xl border border-green-100 p-3"><p className="mb-1 text-xs text-gray-400">Slug</p><p className="break-all text-sm font-medium text-[#123b25]">{viewCategory?.slug || "—"}</p></div>
            <div className="flex items-start gap-3 rounded-xl border border-green-100 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700"><CalendarDays className="h-4 w-4" /></div>
              <div><p className="text-xs text-gray-400">Dernière mise à jour</p><p className="mt-1 text-sm font-medium text-[#123b25]">{formatCategoryDate(viewCategory?.updated_at)}</p></div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setViewCategory(null)} className="border-gray-200 text-gray-600 hover:bg-gray-50">Fermer</Button>
            <Button className="gap-2 bg-green-700 text-white hover:bg-green-800" onClick={() => { if (!viewCategory) return; openEditDialog(viewCategory); setViewCategory(null); }}><Pencil className="h-4 w-4" />Modifier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT */}
      <Dialog open={open} onOpenChange={(value) => { if (saving) return; setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-green-100">
          <DialogHeader className="border-b border-green-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">{draft.id ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#123b25]">{draft.id ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
                <DialogDescription className="mt-1">{draft.id ? "Modifiez les informations de cette catégorie." : "Renseignez les informations pour créer une nouvelle catégorie."}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="category-name" className="text-[#123b25]">Nom de la catégorie<span className="ml-1 text-red-500">*</span></Label>
              <Input id="category-name" ref={nameInputRef} value={draft.name} placeholder="Ex. Électronique" aria-invalid={Boolean(nameError)} className={nameError ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); if (event.target.value.trim()) setNameError(""); }} />
              {nameError && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" />{nameError}</p>}
              <p className="text-xs text-gray-400">Le slug sera généré automatiquement à partir du nom.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[#123b25]">Catégorie parente</Label>
              <Popover open={parentMenuOpen} onOpenChange={setParentMenuOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 w-full justify-between border-green-200 bg-gray-50 font-normal text-gray-700 hover:bg-white">
                    <span className="flex min-w-0 items-center gap-2 truncate"><Folder className="h-4 w-4 shrink-0 text-gray-400" /><span className="truncate">{draft.parent_id && draft.parent_id !== draft.id ? list.find((category) => category.id === draft.parent_id)?.name ?? "Catégorie sélectionnée" : "Aucune — catégorie principale"}</span></span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-green-100 p-0">
                  <div className="border-b border-green-100 p-2"><div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input autoFocus value={parentSearch} onChange={(event) => setParentSearch(event.target.value)} placeholder="Rechercher une catégorie..." className="h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0" /></div></div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    <button type="button" className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-green-50 ${!draft.parent_id || draft.parent_id === draft.id ? "bg-green-50 text-green-700" : "text-gray-700"}`} onClick={() => { setDraft({ ...draft, parent_id: null }); setParentSearch(""); setParentMenuOpen(false); }}>
                      <span className="flex items-center gap-2"><FolderTree className="h-4 w-4" />Aucune — catégorie principale</span>
                      {(!draft.parent_id || draft.parent_id === draft.id) && <Check className="h-4 w-4" />}
                    </button>
                    {parentOptions.filter((category) => availableParents.some((item) => item.id === category.id)).map((category) => (
                      <button type="button" key={category.id} className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-green-50 ${draft.parent_id === category.id ? "bg-green-50 text-green-700" : "text-gray-700"}`} onClick={() => { setDraft({ ...draft, parent_id: category.id }); setParentSearch(""); setParentMenuOpen(false); }}>
                        <span className="flex min-w-0 items-center gap-2"><Folder className="h-4 w-4 shrink-0 text-gray-400" /><span className="truncate">{category.name}</span></span>
                        {draft.parent_id === category.id && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))}
                    {parentOptions.filter((category) => availableParents.some((item) => item.id === category.id)).length === 0 && (<p className="px-3 py-5 text-center text-sm text-gray-400">Aucune catégorie trouvée.</p>)}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-400">Sélectionnez une catégorie parente ou laissez ce champ vide pour créer une catégorie principale.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description" className="text-[#123b25]">Description</Label>
              <Input id="category-description" value={draft.description ?? ""} placeholder="Décrivez brièvement cette catégorie..." className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </div>
            <div className="space-y-3">
              <div><Label className="text-[#123b25]">Image de la catégorie</Label><p className="mt-1 text-xs text-gray-400">Ajoutez une image pour identifier visuellement cette catégorie.</p></div>
              {!file && !draft.image_url ? (
                <div onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleImageDrop} onClick={() => imageInputRef.current?.click()} className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-7 text-center transition-all ${dragOver ? "border-green-500 bg-green-50" : "border-green-200 bg-gray-50 hover:border-green-400 hover:bg-green-50/50"}`}>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700 transition-transform group-hover:scale-105"><ImagePlus className="h-6 w-6" /></div>
                  <p className="text-sm font-semibold text-[#123b25]">Glissez-déposez votre image ici</p>
                  <p className="mt-1 text-xs text-gray-400">ou cliquez pour parcourir vos fichiers</p>
                  <div className="mt-3 rounded-full border border-green-100 bg-white px-3 py-1 text-[11px] text-gray-500">JPG, PNG, WEBP · {MAX_IMAGE_MB} Mo maximum</div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-xl border border-green-100 bg-green-50/30 p-3 sm:flex-row sm:items-center">
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-green-100 bg-gray-100 sm:w-32"><img src={previewUrl ?? draft.image_url ?? ""} alt="Aperçu" className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /><p className="text-sm font-semibold text-[#123b25]">{file ? "Nouvelle image sélectionnée" : "Image actuelle"}</p></div>
                    {file && <p className="mt-1 truncate text-xs text-gray-500">{file.name}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="border-green-200 text-green-700 hover:bg-green-50"><Upload className="mr-2 h-3.5 w-3.5" />Remplacer</Button>
                      <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={removeImage} disabled={saving}><Trash2 className="mr-2 h-3.5 w-3.5" />Supprimer</Button>
                    </div>
                  </div>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { validateAndSetFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
              {imgError && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" />{imgError}</p>}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 border-t border-green-100 pt-4 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button onClick={save} disabled={saving || Boolean(imgError)} className="gap-2 bg-green-700 text-white hover:bg-green-800">{saving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}{draft.id ? "Enregistrer les modifications" : "Créer la catégorie"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}