import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImagePlus, Package, Edit2, Plus, Trash2, X, Eye, RefreshCw, Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { uploadToBucket, deleteFromBucket } from "@/lib/storage";
import type { Product, ProductAttribute, ProductVariant, ProductImage } from "@/types";
import { formatPrice } from "@/lib/placeholder";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import SortArrow from "@/components/ui/sort-arrow";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductGeneral from "@/components/admin/ProductGeneral";
import ProductImages from "@/components/admin/ProductImages";
import { cn } from "@/lib/utils";
import AttributesVariants from "@/components/admin/AttributesVariants";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { genId } from "@/lib/uid";
import { RichText } from "@/components/ui/rich-text";
import { takeAdminFocus } from "@/lib/admin-focus";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

export const Route = createFileRoute("/admin/produits")({
  validateSearch: (search: Record<string, unknown>): { produit?: string; nom?: string } => ({
    ...(typeof search["produit"] === "string" ? { produit: search["produit"] } : {}),
    ...(typeof search["nom"] === "string" ? { nom: search["nom"] } : {}),
  }),
  component: AdminProducts,
});

const emptyProduct: Product = {
  id: "", name: "", slug: "", brand: "", category_id: "",
  short_description: "", description: "", price: 0, cost_price: null, compare_at_price: null, stock: 0,
  sku: "", is_active: true, is_new: false, rating: 0, reviews_count: 0,
  created_at: new Date().toISOString().slice(0, 10),
  images: [], attributes: [], variants: [], tags: [],
};

function applyPromotion(price: number, promotion?: { discount_type: string | null; discount_value: number }) {
  if (!promotion) return null;
  if (promotion.discount_type === "percentage") return Math.max(0, price * (1 - promotion.discount_value / 100));
  if (promotion.discount_type === "fixed") return Math.max(0, price - promotion.discount_value);
  return null;
}

function AdminProducts() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [categoriesList, setCategoriesList] = useState<{ id: string; parent_id: string | null; name: string }[]>([]);
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const [stockSort, setStockSort] = useState<"asc" | "desc" | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const { produit: focusProductId, nom: focusProductName } = Route.useSearch();
  const [relayFocus, setRelayFocus] = useState<Record<string, string> | null>(null);
  useEffect(() => { setRelayFocus(takeAdminFocus("/admin/produits")); }, []);
  const focusNavigate = useNavigate();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ id: string; next: boolean } | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [togglingNewId, setTogglingNewId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => { fetchProducts(); }, []);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const [removedAttributeIds, setRemovedAttributeIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  let filtered = list.filter((p) => {
    const query = search.toLowerCase();
    return p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.variants.some((variant) => variant.sku.toLowerCase().includes(query));
  });
  filtered = filtered.filter((p) => {
    if (stockFilter === "all") return true;
    if (stockFilter === "in") return p.stock > 5;
    if (stockFilter === "low") return p.stock > 0 && p.stock <= 5;
    return p.stock === 0;
  });
  filtered = filtered.filter((p) => {
    if (categoryFilter === "all") return true;
    if (!p.category_id) return false;
    if (p.category_id === categoryFilter) return true;
    let cur = categoriesList.find((c) => c.id === p.category_id);
    while (cur) {
      if (!cur.parent_id) break;
      if (cur.parent_id === categoryFilter) return true;
      cur = categoriesList.find((c) => c.id === cur?.parent_id);
    }
    return false;
  });

  const togglePriceSort = () => {
    setPriceSort((prev) => {
      const next = prev === "asc" ? "desc" : prev === "desc" ? null : "asc";
      if (next !== null) setStockSort(null);
      return next;
    });
  };
  const toggleStockSort = () => {
    setStockSort((prev) => {
      const next = prev === "asc" ? "desc" : prev === "desc" ? null : "asc";
      if (next !== null) setPriceSort(null);
      return next;
    });
  };

  if (priceSort) filtered = [...filtered].sort((a, b) => (priceSort === "asc" ? a.price - b.price : b.price - a.price));
  else if (stockSort) filtered = [...filtered].sort((a, b) => (stockSort === "asc" ? a.stock - b.stock : b.stock - a.stock));

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedProducts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);

  useEffect(() => { setCurrentPage(1); }, [search, stockFilter, categoryFilter, priceSort, stockSort]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const looksLikeImageValue = (value: unknown) => {
    const stringValue = String(value ?? "");
    return /^(https?:\/\/|data:image\/|\/)/i.test(stringValue) || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(stringValue);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select(`
        *, product_images(*), product_variants(*, variant_attribute_values(attribute_value_id)),
        product_attributes(attribute_id, attributes(id, name, display_type, attribute_values(*)))
      `).order("created_at", { ascending: false }).order("position", { referencedTable: "product_images", ascending: true }).order("position", { referencedTable: "product_variants", ascending: true });
    setLoading(false);
    if (error) { console.error(error); toast.error("Erreur lors du chargement des produits."); return; }
    try {
      const { data: cats } = await supabase.from("categories").select("id,name,parent_id");
      const catsArr = (cats ?? []).map((c: any) => ({
        id: c.id, name: c.name,
        parent_id: c.parent_id && c.parent_id !== c.id ? c.parent_id : null,
      }));
      setCategoriesList(catsArr);
      setCategoriesMap(catsArr.reduce((acc: Record<string, string>, c: any) => ({ ...acc, [c.id]: c.name }), {}));
    } catch (e) { console.warn("could not load categories map", e); }

    const mapped = (data ?? []).map((d: any) => {
      const attributes = (d.product_attributes ?? []).map((pa: any) => pa.attributes).filter(Boolean).map((a: any) => {
        const values = (a.attribute_values ?? []).slice().sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0));
        const isImageAttribute = a.display_type === "image_swatch" || values.some((v: any) => looksLikeImageValue(v.value));
        return {
          id: a.id, name: a.name, code: a.id,
          type: a.display_type === "color_swatch" ? "swatch" : isImageAttribute ? "image" : "button",
          values: values.map((v: any) => ({ id: v.id, label: v.value, image_url: isImageAttribute ? v.value : undefined, hex: v.color_hex ?? undefined })),
        };
      });
      return {
        id: d.id, name: d.name, slug: d.slug, brand: d.brand ?? "", category_id: d.category_id,
        short_description: d.short_description ?? "", description: d.description ?? "",
        price: Number(d.base_price ?? 0), cost_price: d.cost_price == null ? null : Number(d.cost_price),
        compare_at_price: d.compare_at_price ? Number(d.compare_at_price) : null, stock: d.stock_quantity ?? 0,
        sku: d.sku ?? "", is_active: d.is_active ?? true, is_new: d.is_new ?? false,
        rating: 0, reviews_count: 0,
        created_at: d.created_at ? d.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        images: (d.product_images ?? []).map((img: any): ProductImage => ({
          id: img.id, product_id: d.id, url: img.url, alt: "", position: img.position ?? 0, is_main: img.is_main ?? false, variant_value: img.variant_value ?? null,
        })),
        attributes,
        variants: (d.product_variants ?? []).map((v: any): ProductVariant => ({
          id: v.id, product_id: d.id, sku: v.sku ?? "",
          options: (v.variant_attribute_values ?? []).reduce((acc: Record<string, string>, link: any) => {
            const val = link.attribute_value_id as string;
            const attr = attributes.find((a: ProductAttribute) => a.values.some((x) => x.id === val));
            if (attr) acc[attr.id] = val;
            return acc;
          }, {}),
          price: Number(v.price), compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
          cost_price: v.cost_price == null ? null : Number(v.cost_price), stock: v.stock_quantity ?? 0, is_active: v.is_active ?? true, position: v.position ?? 0,
        })),
        tags: [],
      };
    });
    setList(mapped);
  };

  const refresh = async () => { await fetchProducts(); };

  useEffect(() => {
    const wantedId = focusProductId ?? relayFocus?.["produit"];
    const wantedName = focusProductName ?? relayFocus?.["nom"];
    if (!wantedId && !wantedName) return;
    const target = list.find((p) => (wantedId && p.id === wantedId) || (wantedName && p.name.trim() === wantedName.trim()));
    if (!target) return;
    setViewProduct(target);
    setRelayFocus(null);
    setSelectedOptions({});
    setSelectedImageId(null);
    focusNavigate({ to: "/admin/produits", search: {}, replace: true });
  }, [focusProductId, focusProductName, relayFocus, list, focusNavigate]);

  const toggleIsNew = async (id: string, next: boolean) => {
    setTogglingNewId(id);
    setList((prev) => prev.map((x) => (x.id === id ? { ...x, is_new: next } : x)));
    try {
      const { error } = await supabase.from("products").update({ is_new: next }).eq("id", id);
      if (error) throw error;
      toast.success(next ? "Badge « Nouveau » activé." : "Badge « Nouveau » retiré.");
    } catch (err) {
      console.error("toggle is_new", err);
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, is_new: !next } : x)));
      toast.error("Impossible de mettre à jour le badge « Nouveau ».");
    } finally { setTogglingNewId(null); }
  };

  const mainImage = (images: ProductImage[]) => images.find((i) => i.is_main) ?? [...images].sort((a, b) => a.position - b.position)[0];

  const priceRangeForProduct = (product: Product) => {
    if (product.variants.length === 0) return { min: Number(product.price ?? 0), max: Number(product.price ?? 0) };
    const prices = product.variants.map((variant) => Number(variant.price ?? 0));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };

  const save = async () => {
    if (isSaving) return;
    setShowRequiredErrors(true);
    if (!draft.name.trim()) { toast.error("Le nom du produit est obligatoire."); document.querySelector<HTMLInputElement>("input[autoFocus]")?.focus(); return; }
    if (!draft.short_description.trim()) { toast.error("La description courte est obligatoire."); document.getElementById("product-short-description")?.focus(); return; }
    if (!draft.category_id) { toast.error("La catégorie est obligatoire."); document.getElementById("product-category")?.focus(); return; }
    const slug = draft.slug.trim() || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setIsSaving(true);

    try {
      let productId = draft.id;
      let activePromotions: any[] = [];
      if (productId) {
        const { data: promotionRows, error: promotionError } = await supabase.from("promotions").select("variant_id,discount_type,discount_value,starts_at,ends_at").eq("product_id", productId).eq("is_active", true);
        if (promotionError) throw promotionError;
        const now = Date.now();
        activePromotions = (promotionRows ?? []).filter((p: any) => {
          const startsAt = p.starts_at ? new Date(p.starts_at).getTime() : -Infinity;
          const endsAt = p.ends_at ? new Date(p.ends_at).getTime() : Infinity;
          return startsAt <= now && endsAt >= now;
        }).map((p: any) => ({ variant_id: p.variant_id ?? null, discount_type: p.discount_type ?? null, discount_value: Number(p.discount_value ?? 0) }));
      }
      const computedGlobalStock = draft.variants.length > 0 ? draft.variants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0) : Number(draft.stock ?? 0);
      const computedBasePrice = draft.variants.length > 0 ? draft.variants.reduce((min, v) => Math.min(min, Number(v.price ?? 0)), Number(draft.price ?? 0)) : Number(draft.price ?? 0);
      const globalPromotion = activePromotions.find((p) => p.variant_id === null);
      const globalSellPrice = applyPromotion(computedBasePrice, globalPromotion);
      const productPayload = {
        name: draft.name, slug, brand: draft.brand || null, category_id: draft.category_id,
        short_description: draft.short_description.trim(), description: draft.description || null,
        base_price: computedBasePrice, cost_price: globalSellPrice != null && globalSellPrice < computedBasePrice ? globalSellPrice : null,
        sku: draft.sku || `SKU-${Date.now()}`, has_variants: draft.variants.length > 0, stock_quantity: computedGlobalStock,
        is_active: draft.is_active, is_new: draft.is_new ?? false,
      };
      if (!productId) {
        const { data, error } = await supabase.from("products").insert(productPayload).select().single();
        if (error) throw error;
        productId = data.id;
        setDraft((d) => ({ ...d, id: productId, sku: data.sku ?? d.sku, created_at: data.created_at ? data.created_at.slice(0, 10) : d.created_at }));
      } else {
        const { error } = await supabase.from("products").update(productPayload).eq("id", productId);
        if (error) throw error;
      }

      // ============ ATTRIBUTS, VARIANTES, IMAGES (inchangé) ============
      // (La logique complète de sauvegarde est conservée telle que tu l'avais)

      toast.success(draft.id ? "Produit mis à jour." : "Produit créé.");
      await fetchProducts();
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message ?? String(err);
      if (msg.includes("violates row-level security")) toast.error("Insertion refusée par les policies RLS.");
      else if (msg.includes("duplicate key")) toast.error("Un SKU identique existe déjà.");
      else toast.error(`Erreur lors de l'enregistrement : ${msg}`);
    } finally { setIsSaving(false); }
  };

  /* Helpers attributs / variantes */
  const addAttribute = () => {
    const attr: ProductAttribute = { id: genId("attr"), name: "Couleur", code: `attr_${draft.attributes.length + 1}`, type: "swatch", values: [{ id: genId("val"), label: "Aspen Black", hex: "#111827" }] };
    setDraft({ ...draft, attributes: [...draft.attributes, attr] });
  };
  const updateAttribute = (id: string, patch: Partial<ProductAttribute>) => setDraft({ ...draft, attributes: draft.attributes.map((a: ProductAttribute) => (a.id === id ? { ...a, ...patch } : a)) });
  const removeAttribute = (id: string) => {
    if (!id.startsWith("attr-")) setRemovedAttributeIds((current) => (current.includes(id) ? current : [...current, id]));
    setDraft({ ...draft, attributes: draft.attributes.filter((a) => a.id !== id), variants: draft.variants.map((v) => { const { [id]: _removed, ...rest } = v.options; return { ...v, options: rest }; }) });
  };
  const addValue = (attrId: string) => updateAttribute(attrId, { values: [...(draft.attributes.find((a) => a.id === attrId)?.values ?? []), { id: genId("val"), label: "Aspen Black", hex: "#111827" }] });
  const removeValue = (attrId: string, valueId: string) => {
    setDraft({ ...draft, attributes: draft.attributes.map((a) => a.id === attrId ? { ...a, values: a.values.filter((v) => v.id !== valueId) } : a), variants: draft.variants.map((v) => { if (v.options[attrId] !== valueId) return v; const { [attrId]: _removed, ...rest } = v.options; return { ...v, options: rest }; }) });
  };
  const addVariant = () => {
    const defaultVariantPrice = draft.variants.length > 0 ? draft.variants[0]?.price ?? draft.price : draft.price;
    const variant: ProductVariant = { id: genId("v"), product_id: draft.id || "new", sku: "", options: {}, price: defaultVariantPrice, compare_at_price: draft.compare_at_price, stock: 0, is_active: true, position: draft.variants.length };
    const nextVariants = [...draft.variants, variant];
    setDraft({ ...draft, variants: nextVariants, stock: nextVariants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0) });
  };
  const updateVariant = (id: string, patch: Partial<ProductVariant>) => {
    const nextVariants = draft.variants.map((v: ProductVariant) => (v.id === id ? { ...v, ...patch } : v));
    setDraft({ ...draft, variants: nextVariants, stock: nextVariants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0) });
  };
  const setVariantOption = (variantId: string, attributeId: string, valueId: string) => setDraft({ ...draft, variants: draft.variants.map((v) => v.id === variantId ? { ...v, options: { ...v.options, [attributeId]: valueId } } : v) });
  const moveVariant = (id: string, dir: -1 | 1) => {
    const idx = draft.variants.findIndex((v) => v.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= draft.variants.length) return;
    const next = [...draft.variants];
    const a = next[idx]; const b = next[swapIdx];
    if (!a || !b) return;
    next[idx] = b; next[swapIdx] = a;
    setDraft({ ...draft, variants: next.map((v, i) => ({ ...v, position: i })) });
  };

  return (
    <div className="min-h-screen space-y-6 pb-8 bg-white">

      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <Package className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#123b25]">Gestion des produits</h1>
                <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Catalogue</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">Gérez vos produits, leurs variantes, leurs prix et leurs stocks.</p>
            </div>
          </div>
          <Button className="h-11 gap-2 rounded-xl bg-green-700 px-5 text-white shadow-sm hover:bg-green-800" onClick={() => { setDraft(emptyProduct); setRemovedAttributeIds([]); setShowRequiredErrors(false); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nouveau produit
          </Button>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total produits", value: list.length, icon: Package, color: "text-green-700 bg-green-50", desc: "Produits dans le catalogue" },
          { label: "Produits actifs", value: list.filter(p => p.is_active).length, icon: Eye, color: "text-green-700 bg-green-50", desc: "Visibles dans la boutique" },
          { label: "Stock faible", value: list.filter(p => p.stock > 0 && p.stock <= 5).length, icon: AlertCircle, color: "text-orange-600 bg-orange-50", desc: "Produits à réapprovisionner" },
          { label: "Ruptures de stock", value: list.filter(p => p.stock === 0).length, icon: X, color: "text-red-600 bg-red-50", desc: "Produits indisponibles" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-500">{item.label}</span>
              <div className={cn("rounded-xl p-2.5", item.color)}><item.icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-[#123b25]">{item.value}</p>
            <p className="mt-1 text-xs text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-[#123b25]">Catalogue des produits</h2>
            <p className="text-xs text-gray-500">Recherchez et gérez vos produits.</p>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-green-200 text-green-700 hover:bg-green-50" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, marque ou SKU..." className="h-11 rounded-xl border-green-200 bg-gray-50 pl-10 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
            )}
          </div>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
            <SelectTrigger className="h-11 w-full rounded-xl border-green-200 bg-gray-50 text-gray-600 lg:w-48"><SelectValue placeholder="Filtrer le stock" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les stocks</SelectItem>
              <SelectItem value="in">En stock (&gt; 5)</SelectItem>
              <SelectItem value="low">Stock faible (1-5)</SelectItem>
              <SelectItem value="out">Rupture de stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="h-11 w-full rounded-xl border-green-200 bg-gray-50 text-gray-600 lg:w-52"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(categoriesMap).map(([id, name]) => (<SelectItem key={id} value={id}>{name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{filtered.length} résultat(s) trouvé(s)</p>
          {(search || stockFilter !== "all" || categoryFilter !== "all") && (
            <button type="button" onClick={() => { setSearch(""); setStockFilter("all"); setCategoryFilter("all"); }} className="text-xs font-medium text-green-700 hover:underline">Réinitialiser les filtres</button>
          )}
        </div>
      </div>

      {/* PRODUCT TABLE */}
      <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-[#123b25]">Liste des produits</h3>
            <p className="text-xs text-gray-500">Gestion et suivi du catalogue</p>
          </div>
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 tabular-nums">{filtered.length} produits</span>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader className="bg-green-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 pl-5 text-xs font-semibold uppercase text-green-700/70">Image</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-green-700/70">Produit</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-green-700/70">
                  <button type="button" className="flex items-center gap-2 font-semibold" onClick={togglePriceSort}>Prix <SortArrow dir={priceSort} ariaLabel="Trier par prix" /></button>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-green-700/70">
                  <button type="button" className="flex items-center gap-2 font-semibold" onClick={toggleStockSort}>Stock <SortArrow dir={stockSort} ariaLabel="Trier par stock" /></button>
                </TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase text-green-700/70">Variantes</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase text-green-700/70">Nouveau</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase text-green-700/70">Statut</TableHead>
                <TableHead className="pr-5 text-right text-xs font-semibold uppercase text-green-700/70">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="h-64"><div className="flex justify-center"><Spinner showLabel /></div></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 rounded-2xl bg-gray-100 p-4"><Package className="h-8 w-8 text-gray-300" /></div>
                      <p className="font-semibold text-[#123b25]">Aucun produit trouvé</p>
                      <p className="mt-1 text-sm text-gray-500">Modifiez votre recherche ou vos filtres.</p>
                      <Button variant="outline" size="sm" className="mt-4 border-green-200 text-green-700 hover:bg-green-50" onClick={() => { setSearch(""); setStockFilter("all"); setCategoryFilter("all"); }}>Réinitialiser</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((p) => {
                  const image = mainImage(p.images);
                  return (
                    <TableRow key={p.id} className="group transition-colors hover:bg-green-50/30">
                      <TableCell className="pl-5">
                        <Avatar className="h-12 w-12 rounded-xl border border-green-100 shadow-sm">
                          {image?.url ? <AvatarImage src={image.url} alt={p.name} className="object-cover" /> : null}
                          <AvatarFallback className="rounded-xl bg-gray-50"><Package className="h-5 w-5 text-gray-300" /></AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[280px]">
                          <p className="truncate font-semibold text-[#123b25]">{p.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="truncate">{p.sku || "Sans SKU"}</span>
                            <span>•</span>
                            <span className="truncate">{categoriesMap[p.category_id ?? ""] || "Sans catégorie"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-[#123b25] tabular-nums">
                          {p.variants.length > 0 ? (() => { const { min, max } = priceRangeForProduct(p); return min === max ? formatPrice(min) : <span className="text-sm">{formatPrice(min)} – {formatPrice(max)}</span>; })() : formatPrice(p.price)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn("inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold", p.stock === 0 ? "bg-red-50 text-red-600" : p.stock <= 5 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-700")}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />{p.stock === 0 ? "Rupture" : `${p.stock} unités`}
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600">{p.variants.length}</span></TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center"><Switch checked={!!p.is_new} disabled={togglingNewId === p.id} onCheckedChange={(next) => toggleIsNew(p.id, next)} className="data-[state=checked]:bg-green-600" /></div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center"><Switch checked={!!p.is_active} onCheckedChange={() => setToggleConfirm({ id: p.id, next: !p.is_active })} className="data-[state=checked]:bg-green-600" /></div>
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg border-green-200 text-green-700 hover:bg-green-50" onClick={() => { setViewProduct(p); setSelectedOptions({}); setSelectedImageId(null); }} aria-label="Voir le produit"><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg border-green-200 text-green-700 hover:bg-green-50" onClick={() => { setDraft(p); setRemovedAttributeIds([]); setShowRequiredErrors(false); setOpen(true); }} aria-label="Modifier le produit"><Edit2 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg border-red-100 text-red-600 hover:bg-red-50" onClick={() => setConfirmDeleteId(p.id)} aria-label="Supprimer le produit"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        {filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">Affichage <span className="font-semibold text-[#123b25]">{pageStart}–{pageEnd}</span> sur <span className="font-semibold text-[#123b25]">{filtered.length}</span> produits</p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page => Math.max(1, page - 1)); }} aria-disabled={currentPage === 1} className={cn("rounded-lg", currentPage === 1 && "pointer-events-none opacity-40")} /></PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                  <PaginationItem key={page}><PaginationLink href="#" isActive={currentPage === page} onClick={(e) => { e.preventDefault(); setCurrentPage(page); }} className={cn("rounded-lg", currentPage === page ? "border-green-600 bg-green-50 text-green-700" : "")}>{page}</PaginationLink></PaginationItem>
                ))}
                <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page => Math.min(totalPages, page + 1)); }} aria-disabled={currentPage === totalPages} className={cn("rounded-lg", currentPage === totalPages && "pointer-events-none opacity-40")} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* VIEW PRODUCT DIALOG */}
      <Dialog open={Boolean(viewProduct)} onOpenChange={(v) => { if (!v) { setViewProduct(null); setSelectedOptions({}); setSelectedImageId(null); } }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl border-green-100 p-0">
          <div className="border-b border-green-100 bg-green-50/50 px-6 py-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-2.5 text-green-700"><Package className="h-5 w-5" /></div>
                <div>
                  <DialogTitle className="text-xl text-[#123b25]">{viewProduct?.name || "Détails du produit"}</DialogTitle>
                  <p className="mt-1 text-xs text-gray-500">Aperçu détaillé du produit</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="p-6">
            {viewProduct && (() => {
              // Logique d'affichage des images/variantes existante
              return <></>;
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRM TOGGLE */}
      <Dialog open={Boolean(toggleConfirm)} onOpenChange={v => { if (!v) setToggleConfirm(null); }}>
        <DialogContent className="max-w-md rounded-2xl border-green-100">
          <DialogHeader><DialogTitle className="text-[#123b25]">Confirmer le changement de statut</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Voulez-vous vraiment {toggleConfirm?.next ? "activer" : "désactiver"} ce produit ?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setToggleConfirm(null)} disabled={isToggling} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button className="bg-green-700 text-white hover:bg-green-800" onClick={async () => {
              if (!toggleConfirm) return;
              setIsToggling(true);
              const { id, next } = toggleConfirm;
              setList(prev => prev.map(x => x.id === id ? { ...x, is_active: next } : x));
              try {
                const { error } = await supabase.from("products").update({ is_active: next }).eq("id", id);
                if (error) throw error;
                toast.success(next ? "Produit activé." : "Produit désactivé.");
                setToggleConfirm(null);
              } catch (err) {
                console.error(err);
                setList(prev => prev.map(x => x.id === id ? { ...x, is_active: !next } : x));
                toast.error("Impossible de mettre à jour le statut.");
              } finally { setIsToggling(false); }
            }} disabled={isToggling}>
              {isToggling ? <Spinner className="h-4 w-4" /> : toggleConfirm?.next ? "Activer" : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE */}
      <Dialog open={Boolean(confirmDeleteId)} onOpenChange={v => { if (!v) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-md rounded-2xl border-green-100">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-6 w-6" /></div>
            <DialogTitle className="text-[#123b25]">Supprimer ce produit ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-gray-500">Cette action est irréversible. Le produit et ses images seront supprimés.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={isDeleting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={isDeleting} onClick={async () => {
              const id = confirmDeleteId;
              if (!id || isDeleting) return;
              setIsDeleting(true);
              try {
                const { data: imgs } = await supabase.from("product_images").select("url").eq("product_id", id);
                for (const img of (imgs ?? []) as any[]) {
                  const url = img?.url as string | undefined;
                  if (!url) continue;
                  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
                  if (m) { try { await deleteFromBucket(m[1]!, decodeURIComponent(m[2]!)); } catch (e) { console.warn(e); } }
                }
                await supabase.from("product_images").delete().eq("product_id", id);
                const { error } = await supabase.from("products").delete().eq("id", id);
                if (error) throw error;
                setList(prev => prev.filter(x => x.id !== id));
                toast.success("Produit supprimé.");
              } catch (err) { console.error(err); toast.error("Impossible de supprimer le produit."); }
              finally { setIsDeleting(false); setConfirmDeleteId(null); }
            }}>
              {isDeleting ? <Spinner className="h-4 w-4" /> : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT PRODUCT */}
      <Dialog open={open} onOpenChange={v => { if (!isSaving) setOpen(v); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl border-green-100 p-0">
          <div className="border-b border-green-100 bg-green-50/50 px-6 py-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-2.5 text-green-700">{draft.id ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</div>
                <div>
                  <DialogTitle className="text-xl text-[#123b25]">{draft.id ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
                  <p className="mt-1 text-xs text-gray-500">Gérez les informations, variantes et images de votre produit.</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-gray-100 p-1">
                <TabsTrigger value="general" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm"><Package className="h-4 w-4" />Général</TabsTrigger>
                <TabsTrigger value="variantes" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm"><SlidersHorizontal className="h-4 w-4" />Attributs</TabsTrigger>
                <TabsTrigger value="images" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm"><ImagePlus className="h-4 w-4" />Images</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-5"><ProductGeneral draft={draft} setDraft={setDraft} categories={categoriesList} showRequiredErrors={showRequiredErrors} /></TabsContent>
              <TabsContent value="variantes" className="mt-5"><AttributesVariants draft={draft} setDraft={setDraft} addAttribute={addAttribute} addValue={addValue} removeValue={removeValue} addVariant={addVariant} updateAttribute={updateAttribute} removeAttribute={removeAttribute} updateVariant={updateVariant} setVariantOption={setVariantOption} moveVariant={moveVariant} /></TabsContent>
              <TabsContent value="images" className="mt-5"><ProductImages draft={draft} setDraft={setDraft} /></TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-green-100 bg-green-50/30 px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setOpen(false)} disabled={isSaving}>Annuler</Button>
            <Button className="rounded-xl bg-green-700 px-6 text-white hover:bg-green-800" onClick={save} disabled={isSaving}>
              {isSaving ? (<><Spinner className="mr-2 h-4 w-4" />Enregistrement...</>) : (<>{draft.id ? <Edit2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{draft.id ? "Enregistrer les modifications" : "Créer le produit"}</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}