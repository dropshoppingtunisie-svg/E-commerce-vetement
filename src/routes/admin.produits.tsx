import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImagePlus, Package, Edit2, Plus, Trash2, X, Eye, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductGeneral from "@/components/admin/ProductGeneral";
import ProductImages from "@/components/admin/ProductImages";
import { cn } from "@/lib/utils";
import AttributesVariants from "@/components/admin/AttributesVariants";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductDetails } from "@/components/store/ProductDetails";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const Route = createFileRoute("/admin/produits")({
  // Liens profonds depuis les alertes de stock : `?produit=<uuid>`, ou
  // `?nom=<nom>` pour les alertes antérieures dont le lien n'avait pas d'id.
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
  // Cible transmise par la boîte de réception (cf. lib/admin-focus).
  const [relayFocus, setRelayFocus] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    setRelayFocus(takeAdminFocus("/admin/produits"));
  }, []);
  const focusNavigate = useNavigate();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sélection de variante par ATTRIBUT (ex: { attrCouleurId: valRougeId, attrTailleId: valMId })
  // plutôt que par id de variante directement — reproduit le comportement de la fiche
  // produit boutique où l'on choisit des options une par une jusqu'à résoudre la variante.
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

  // client-side filtering + sorting
  let filtered = list.filter((p) => {
    const query = search.toLowerCase();
    return p.name.toLowerCase().includes(query)
      || p.brand.toLowerCase().includes(query)
      || p.sku.toLowerCase().includes(query)
      || p.variants.some((variant) => variant.sku.toLowerCase().includes(query));
  });
  // apply stock filter
  filtered = filtered.filter((p) => {
    if (stockFilter === "all") return true;
    if (stockFilter === "in") return p.stock > 5;
    if (stockFilter === "low") return p.stock > 0 && p.stock <= 5;
    return p.stock === 0;
  });
  // category filter (includes parent matching)
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

  // price sort
  if (priceSort) {
    filtered = [...filtered].sort((a, b) => (priceSort === "asc" ? a.price - b.price : b.price - a.price));
  } else if (stockSort) {
    filtered = [...filtered].sort((a, b) => (stockSort === "asc" ? a.stock - b.stock : b.stock - a.stock));
  }

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedProducts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, stockFilter, categoryFilter, priceSort, stockSort]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const looksLikeImageValue = (value: unknown) => {
    const stringValue = String(value ?? "");
    return /^(https?:\/\/|data:image\/|\/)/i.test(stringValue) || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(stringValue);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select(`
        *,
        product_images(*),
        product_variants(*, variant_attribute_values(attribute_value_id)),
        product_attributes(attribute_id, attributes(id, name, display_type, attribute_values(*)))
      `).order("created_at", { ascending: false }).order("position", {
      referencedTable: "product_images",
      ascending: true,
    }).order("position", {
      referencedTable: "product_variants",
      ascending: true,
    });
    setLoading(false);
    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des produits.");
      return;
    }
    try {
      const { data: cats } = await supabase.from("categories").select("id,name,parent_id");
      const catsArr = (cats ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        // Une catégorie racine se référence elle-même (cf.
        // database/categories-parent-id.sql) : sans ce retour à null, les
        // remontées d'ancêtres plus bas bouclent indéfiniment.
        parent_id: c.parent_id && c.parent_id !== c.id ? c.parent_id : null,
      }));
      setCategoriesList(catsArr);
      setCategoriesMap(catsArr.reduce((acc: Record<string, string>, c: any) => ({ ...acc, [c.id]: c.name }), {}));
    } catch (e) {
      console.warn("could not load categories map", e);
    }
    const mapped = (data ?? []).map((d: any) => {
      const attributes = (d.product_attributes ?? []).map((pa: any) => pa.attributes).filter(Boolean).map((a: any) => {
        const values = (a.attribute_values ?? []).slice().sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0));
        const isImageAttribute = a.display_type === "image_swatch" || values.some((v: any) => looksLikeImageValue(v.value));
        return {
          id: a.id,
          name: a.name,
          code: a.id,
          type: a.display_type === "color_swatch" ? "swatch" : isImageAttribute ? "image" : "button",
          values: values.map((v: any) => ({
            id: v.id,
            label: v.value,
            image_url: isImageAttribute ? v.value : undefined,
            hex: v.color_hex ?? undefined,
          })),
        };
      });
      return {
        id: d.id,
        name: d.name,
        slug: d.slug,
        brand: d.brand ?? "",
        category_id: d.category_id,
        short_description: d.short_description ?? "",
        description: d.description ?? "",
        price: Number(d.base_price ?? 0),
        cost_price: d.cost_price == null ? null : Number(d.cost_price),
        compare_at_price: d.compare_at_price ? Number(d.compare_at_price) : null,
        stock: d.stock_quantity ?? 0,
        sku: d.sku ?? "",
        is_active: d.is_active ?? true,
        is_new: d.is_new ?? false,
        rating: 0,
        reviews_count: 0,
        created_at: d.created_at ? d.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        images: (d.product_images ?? []).map((img: any): ProductImage => ({
          id: img.id, product_id: d.id, url: img.url, alt: "",
          position: img.position ?? 0, is_main: img.is_main ?? false, variant_value: img.variant_value ?? null,
        })),
        attributes,
        variants: (d.product_variants ?? []).map((v: any): ProductVariant => ({
          id: v.id,
          product_id: d.id,
          sku: v.sku ?? "",
          options: (v.variant_attribute_values ?? []).reduce((acc: Record<string, string>, link: any) => {
            const val = link.attribute_value_id as string;
            const attr = attributes.find((a: ProductAttribute) => a.values.some((x) => x.id === val));
            if (attr) acc[attr.id] = val;
            return acc;
          }, {}),
          price: Number(v.price),
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
          cost_price: v.cost_price == null ? null : Number(v.cost_price),
          stock: v.stock_quantity ?? 0,
          is_active: v.is_active ?? true,
          position: v.position ?? 0,
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
    const target = list.find(
      (p) =>
        (wantedId && p.id === wantedId) ||
        (wantedName && p.name.trim() === wantedName.trim()),
    );
    if (!target) return;
    setViewProduct(target);
    setRelayFocus(null);
    setSelectedOptions({});
    setSelectedImageId(null);
    focusNavigate({ to: "/admin/produits", search: {}, replace: true });
  }, [focusProductId, focusProductName, relayFocus, list, focusNavigate]);

  // Badge « Nouveau » : simple mise en avant en boutique, pas de confirmation.
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
    } finally {
      setTogglingNewId(null);
    }
  };

  // image à afficher en priorité: celle marquée is_main, sinon la première par position
  const mainImage = (images: ProductImage[]) =>
    images.find((i) => i.is_main) ?? [...images].sort((a, b) => a.position - b.position)[0];

  const priceRangeForProduct = (product: Product) => {
    if (product.variants.length === 0) return { min: Number(product.price ?? 0), max: Number(product.price ?? 0) };
    const prices = product.variants.map((variant) => Number(variant.price ?? 0));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };

  const categoryMatches = (productCategoryId: string | null) => {
    if (categoryFilter === "all") return true;
    if (!productCategoryId) return false;
    const target = categoryFilter as string;
    if (productCategoryId === target) return true;
    let cur = categoriesList.find((c) => c.id === productCategoryId);
    while (cur) {
      if (!cur.parent_id) break;
      if (cur.parent_id === target) return true;
      cur = categoriesList.find((c) => c.id === cur?.parent_id);
    }
    return false;
  };

  const save = async () => {
    if (isSaving) return;
    setShowRequiredErrors(true);
    if (!draft.name.trim()) {
      toast.error("Le nom du produit est obligatoire.");
      document.querySelector<HTMLInputElement>("input[autoFocus]")?.focus();
      return;
    }
    if (!draft.short_description.trim()) {
      toast.error("La description courte est obligatoire.");
      document.getElementById("product-short-description")?.focus();
      return;
    }
    if (!draft.category_id) {
      toast.error("La catégorie est obligatoire.");
      document.getElementById("product-category")?.focus();
      return;
    }
    const slug = draft.slug.trim() || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setIsSaving(true);

    try {
      // ---- 1) produit ----
      let productId = draft.id;
      let activePromotions: Array<{
        variant_id: string | null;
        discount_type: string | null;
        discount_value: number;
        starts_at: string | null;
        ends_at: string | null;
      }> = [];
      if (productId) {
        const { data: promotionRows, error: promotionError } = await supabase
          .from("promotions")
          .select("variant_id,discount_type,discount_value,starts_at,ends_at")
          .eq("product_id", productId)
          .eq("is_active", true);
        if (promotionError) throw promotionError;
        const now = Date.now();
        activePromotions = (promotionRows ?? []).filter((promotion: any) => {
          const startsAt = promotion.starts_at ? new Date(promotion.starts_at).getTime() : -Infinity;
          const endsAt = promotion.ends_at ? new Date(promotion.ends_at).getTime() : Infinity;
          return startsAt <= now && endsAt >= now;
        }).map((promotion: any) => ({
          variant_id: promotion.variant_id ?? null,
          discount_type: promotion.discount_type ?? null,
          discount_value: Number(promotion.discount_value ?? 0),
          starts_at: promotion.starts_at ?? null,
          ends_at: promotion.ends_at ?? null,
        }));
      }
      const computedGlobalStock = draft.variants.length > 0
        ? draft.variants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0)
        : Number(draft.stock ?? 0);
      const computedBasePrice = draft.variants.length > 0
        ? draft.variants.reduce((min, v) => Math.min(min, Number(v.price ?? 0)), Number(draft.price ?? 0))
        : Number(draft.price ?? 0);
      const globalPromotion = activePromotions.find((promotion) => promotion.variant_id === null);
      const globalSellPrice = applyPromotion(computedBasePrice, globalPromotion);
      const productPayload = {
        name: draft.name,
        slug,
        brand: draft.brand || null,
        category_id: draft.category_id,
        short_description: draft.short_description.trim(),
        description: draft.description || null,
        base_price: computedBasePrice,
        cost_price: globalSellPrice != null && globalSellPrice < computedBasePrice ? globalSellPrice : null,
        sku: draft.sku || `SKU-${Date.now()}`,
        has_variants: draft.variants.length > 0,
        stock_quantity: computedGlobalStock,
        is_active: draft.is_active,
        is_new: draft.is_new ?? false,
      };
      if (!productId) {
        const { data, error } = await supabase.from("products").insert(productPayload).select().single();
        if (error) throw error;
        productId = data.id;
        // update draft with DB-generated fields so the UI shows them immediately
        setDraft((d) => ({ ...d, id: productId, sku: data.sku ?? d.sku, created_at: data.created_at ? data.created_at.slice(0, 10) : d.created_at }));
      } else {
        const { error } = await supabase.from("products").update(productPayload).eq("id", productId);
        if (error) throw error;
      }

      // ---- 2) attributs + valeurs (couleur, taille…) ----
      // On travaille sur une copie locale pour résoudre les ids réels tout de suite
      // (setDraft est asynchrone, on ne peut pas compter dessus dans la même fonction).
      const workingAttributes = draft.attributes.map((a) => ({ ...a, values: a.values.map((v) => ({ ...v })) }));
      const oldValueIdToNewValueId: Record<string, string> = {};

      for (const attr of workingAttributes) {
        const attrPayload = {
          name: attr.name,
          display_type: attr.type === "swatch" ? "color_swatch" : attr.type === "image" ? "image_swatch" : "select",
        };
        const isNewAttr = attr.id.startsWith("attr-");
        if (isNewAttr) {
          const { data, error } = await supabase.from("attributes").insert(attrPayload).select().single();
          if (error) throw error;
          attr.id = data.id;
        } else {
          const { error } = await supabase.from("attributes").update(attrPayload).eq("id", attr.id);
          if (error) throw error;
        }
        // lien produit <-> attribut (idempotent)
        const { error: linkErr } = await supabase
          .from("product_attributes")
          .upsert({ product_id: productId, attribute_id: attr.id }, { onConflict: "product_id,attribute_id" });
        if (linkErr) throw linkErr;

        // ---- Valeurs de cet attribut : on gère aussi la SUPPRESSION ----
        // Avant, on ne faisait qu'insert/update sur les valeurs présentes dans
        // draft.attributes — si l'utilisateur retirait une valeur côté UI (bouton
        // "supprimer" sur une couleur/taille), rien ne la supprimait jamais en
        // base : elle réapparaissait après rechargement. On calcule ici la
        // différence entre les valeurs existantes en base et celles gardées
        // dans le draft pour supprimer le reste.
        const { data: existingValueRows, error: existingValuesError } = await supabase
          .from("attribute_values")
          .select("id")
          .eq("attribute_id", attr.id);
        if (existingValuesError) throw existingValuesError;
        const keptValueIds: string[] = [];

        for (const [i, val] of attr.values.entries()) {
          const oldId = val.id;
          const valPayload = {
            attribute_id: attr.id,
            value: attr.type === "image" ? (val.image_url || val.label) : val.label,
            color_hex: attr.type === "swatch" ? (val.hex ?? null) : null,
            position: i,
          };
          if (oldId.startsWith("val-")) {
            const { data, error } = await supabase.from("attribute_values").insert(valPayload).select().single();
            if (error) throw error;
            val.id = data.id;
          } else {
            const { error } = await supabase.from("attribute_values").update(valPayload).eq("id", val.id);
            if (error) throw error;
          }
          oldValueIdToNewValueId[oldId] = val.id;
          keptValueIds.push(val.id);
        }

        const valueIdsToDelete = (existingValueRows ?? [])
          .map((row: any) => row.id as string)
          .filter((id: string) => !keptValueIds.includes(id));
        if (valueIdsToDelete.length) {
          const { error: delValuesErr } = await supabase
            .from("attribute_values")
            .delete()
            .in("id", valueIdsToDelete);
          if (delValuesErr) throw delValuesErr;
        }
      }

      // supprimer les attributs retirés du produit (juste le lien produit<->attribut, on ne
      // touche pas à la table `attributes` qui pourrait être référencée ailleurs)
      if (productId) {
        const { data: existingLinks, error: existingLinksError } = await supabase
          .from("product_attributes")
          .select("attribute_id")
          .eq("product_id", productId);
        if (existingLinksError) throw existingLinksError;
        const keepAttrIds = workingAttributes.map((a) => a.id);
        const removedByDiff = (existingLinks ?? [])
          .map((l: any) => l.attribute_id)
          .filter((id: string) => !keepAttrIds.includes(id));
        const toUnlink = [...new Set([...removedByDiff, ...removedAttributeIds])];
        if (toUnlink.length) {
          const { error } = await supabase.from("product_attributes").delete().eq("product_id", productId).in("attribute_id", toUnlink);
          if (error) throw error;

          // Les attributs créés pour ce produit ne doivent pas rester visibles
          // après leur retrait. On conserve ceux encore utilisés ailleurs.
          for (const attributeId of toUnlink) {
            const { data: remainingLinks, error: remainingLinksError } = await supabase
              .from("product_attributes")
              .select("product_id")
              .eq("attribute_id", attributeId)
              .limit(1);
            if (remainingLinksError) throw remainingLinksError;
            if (!remainingLinks?.length) {
              const { error: deleteAttributeError } = await supabase.from("attributes").delete().eq("id", attributeId);
              if (deleteAttributeError) throw deleteAttributeError;
            }
          }
        }
      }

      // ---- 3) variantes ----
      const { data: existingVariantsRows } = await supabase.from("product_variants").select("id").eq("product_id", productId);
      const existingVariantIds = (existingVariantsRows ?? []).map((e: any) => e.id);
      const keptVariantIds: string[] = [];

      for (const [i, v] of draft.variants.entries()) {
        const isNewVariant = !existingVariantIds.includes(v.id);
        const payload = {
          product_id: productId,
          // un SKU vide ou dupliqué fait échouer l'insert (colonne UNIQUE) : on force un SKU
          // unique par défaut plutôt que de laisser Postgres rejeter silencieusement la ligne.
          sku: v.sku?.trim() || null,
          price: v.price ?? 0,
          cost_price: (() => {
            const promotion = activePromotions.find(
              (item) => item.variant_id === v.id || item.variant_id === null,
            );
            const sellPrice = applyPromotion(Number(v.price ?? 0), promotion);
            return sellPrice != null && sellPrice < Number(v.price ?? 0) ? sellPrice : null;
          })(),
          compare_at_price: v.compare_at_price ?? null,
          stock_quantity: v.stock ?? 0,
          is_active: v.is_active ?? true,
          position: i,
        };
        let variantId = v.id;
        if (isNewVariant) {
          const { data, error } = await supabase.from("product_variants").insert(payload).select().single();
          if (error) throw error;
          variantId = data.id;
          // replace temporary variant id in draft with DB id so generated fields appear
          setDraft((d) => ({ ...d, variants: d.variants.map((vv) => (vv.id === v.id ? { ...vv, id: variantId } : vv)) }));
        } else {
          const { error } = await supabase.from("product_variants").update(payload).eq("id", variantId);
          if (error) throw error;
        }
        keptVariantIds.push(variantId);

        // lien variante <-> valeurs d'attribut choisies (couleur/taille…)
        const resolvedValueIds = Object.values(v.options || {}).map((valId) => oldValueIdToNewValueId[valId] ?? valId);
        const { error: delLinksErr } = await supabase.from("variant_attribute_values").delete().eq("variant_id", variantId);
        if (delLinksErr) throw delLinksErr;
        if (resolvedValueIds.length) {
          const { error: insLinksErr } = await supabase
            .from("variant_attribute_values")
            .insert(resolvedValueIds.map((attribute_value_id) => ({ variant_id: variantId, attribute_value_id })));
          if (insLinksErr) throw insLinksErr;
        }
      }

      // supprimer les variantes retirées du produit (cascade sur variant_attribute_values / variant_images)
      const toDeleteVariants = existingVariantIds.filter((id: string) => !keptVariantIds.includes(id));
      if (toDeleteVariants.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", toDeleteVariants);
        if (error) throw error;
      }

      // ---- 4) images : upload et associations au clic sur Enregistrer ----
      const { data: existingImageRows, error: existingImagesError } = await supabase
        .from("product_images")
        .select("id,url")
        .eq("product_id", productId);
      if (existingImagesError) throw existingImagesError;

      const keptImageIds: string[] = [];
      for (const [i, image] of draft.images.entries()) {
        const mappedVariantValue = image.variant_value
          ? (oldValueIdToNewValueId[image.variant_value] ?? image.variant_value)
          : null;
        const imagePayload = {
          product_id: productId,
          url: image.url,
          position: i,
          is_main: image.is_main ?? i === 0,
          variant_value: mappedVariantValue,
        };

        const isPendingImage = Boolean(image.file) || image.id.startsWith("img-");
        if (isPendingImage) {
          if (!image.file) {
            throw new Error("Cette image locale doit être sélectionnée à nouveau avant l'enregistrement.");
          }
          const rawName = image.file.name.replace(/\s+/g, "_");
          const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "");
          const path = `${productId}/${Date.now()}-${safeName}`;
          const publicUrl = await uploadToBucket("products", path, image.file);
          const { data: insertedImage, error: insertImageError } = await supabase
            .from("product_images")
            .insert({ ...imagePayload, url: publicUrl } as any)
            .select("id")
            .single();
          if (insertImageError) throw insertImageError;
          keptImageIds.push(insertedImage.id);
          URL.revokeObjectURL(image.url);
        } else if (!image.id.startsWith("img-")) {
          const { error: updateImageError } = await supabase
            .from("product_images")
            .update({ position: i, is_main: imagePayload.is_main, variant_value: mappedVariantValue } as any)
            .eq("id", image.id)
            .eq("product_id", productId);
          if (updateImageError) throw updateImageError;
          keptImageIds.push(image.id);
        } else {
          throw new Error("Une image sélectionnée est introuvable. Veuillez la sélectionner à nouveau.");
        }
      }

      const removedImageRows = (existingImageRows ?? []).filter((row: any) => !keptImageIds.includes(row.id));
      for (const image of removedImageRows) {
        const { error: deleteImageError } = await supabase.from("product_images").delete().eq("id", image.id);
        if (deleteImageError) throw deleteImageError;
        const match = String(image.url ?? "").match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if (match) {
          try {
            await deleteFromBucket(match[1]!, decodeURIComponent(match[2]!));
          } catch (storageError) {
            console.warn("failed to delete removed product image", storageError);
          }
        }
      }

      toast.success(draft.id ? "Produit mis à jour." : "Produit créé.");
      await fetchProducts();
      setOpen(false);
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.message ?? String(err);
      if (msg.includes("violates row-level security") || msg.includes("row-level security")) {
        toast.error("Insertion refusée par les policies RLS — vérifiez les policies DB ou connectez-vous en tant qu'admin.");
      } else if (msg.includes("duplicate key") || msg.includes("already exists")) {
        toast.error("Un SKU identique existe déjà — changez le SKU de la variante en conflit.");
      } else {
        toast.error(`Erreur lors de l'enregistrement : ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /* ---- gestion des attributs / variantes dans le formulaire ---- */
  const addAttribute = () => {
    const attr: ProductAttribute = {
      id: genId("attr"),
      name: "Couleur",
      code: `attr_${draft.attributes.length + 1}`,
      type: "swatch",
      values: [{ id: genId("val"), label: "Aspen Black", hex: "#111827" }],
    };
    setDraft({ ...draft, attributes: [...draft.attributes, attr] });
  };

  const updateAttribute = (id: string, patch: Partial<ProductAttribute>) =>
    setDraft({
      ...draft,
      attributes: draft.attributes.map((a: ProductAttribute) => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeAttribute = (id: string) => {
    if (!id.startsWith("attr-")) {
      setRemovedAttributeIds((current) => (current.includes(id) ? current : [...current, id]));
    }
    setDraft({
      ...draft,
      attributes: draft.attributes.filter((a) => a.id !== id),
      // on retire aussi ce choix de toutes les variantes qui l'utilisaient
      variants: draft.variants.map((v) => {
        const { [id]: _removed, ...rest } = v.options;
        return { ...v, options: rest };
      }),
    });
  };

  const addValue = (attrId: string) =>
    updateAttribute(attrId, {
      values: [
        ...(draft.attributes.find((a) => a.id === attrId)?.values ?? []),
        { id: genId("val"), label: "Aspen Black", hex: "#111827" },
      ],
    });

  // Supprime une valeur (ex: une couleur ou une taille) d'un attribut.
  // C'était la pièce manquante : addValue existait pour ajouter, mais aucune
  // fonction équivalente n'existait pour retirer une valeur, et rien n'était
  // passé en prop à AttributesVariants pour ça — donc le bouton "supprimer"
  // dans l'onglet Attributs n'avait aucun handler à appeler.
  // On retire aussi cette valeur de toutes les variantes qui l'utilisaient,
  // sinon une variante garderait une référence à un value_id qui n'existe
  // plus dans draft.attributes (incohérence silencieuse au moment du save).
  const removeValue = (attrId: string, valueId: string) => {
    setDraft({
      ...draft,
      attributes: draft.attributes.map((a) =>
        a.id === attrId ? { ...a, values: a.values.filter((v) => v.id !== valueId) } : a
      ),
      variants: draft.variants.map((v) => {
        if (v.options[attrId] !== valueId) return v;
        const { [attrId]: _removed, ...rest } = v.options;
        return { ...v, options: rest };
      }),
    });
  };

  const addVariant = () => {
    const defaultVariantPrice = draft.variants.length > 0 ? draft.variants[0]?.price ?? draft.price : draft.price;
    const variant: ProductVariant = {
      id: genId("v"),
      product_id: draft.id || "new",
      // sku will be generated by the DB trigger; keep empty here
      sku: "",
      options: {},
      price: defaultVariantPrice,
      compare_at_price: draft.compare_at_price,
      stock: 0,
      is_active: true,
      position: draft.variants.length,
    };
    const nextVariants = [...draft.variants, variant];
    setDraft({
      ...draft,
      variants: nextVariants,
      stock: nextVariants.length > 0 ? nextVariants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0) : draft.stock,
    });
  };

  const updateVariant = (id: string, patch: Partial<ProductVariant>) => {
    const nextVariants = draft.variants.map((v: ProductVariant) => (v.id === id ? { ...v, ...patch } : v));
    setDraft({
      ...draft,
      variants: nextVariants,
      stock: nextVariants.length > 0 ? nextVariants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0) : draft.stock,
    });
  };

  // fixe la valeur choisie pour un attribut donné (ex: Couleur -> Rouge) sur une variante
  const setVariantOption = (variantId: string, attributeId: string, valueId: string) =>
    setDraft({
      ...draft,
      variants: draft.variants.map((v) =>
        v.id === variantId ? { ...v, options: { ...v.options, [attributeId]: valueId } } : v
      ),
    });

  const moveVariant = (id: string, dir: -1 | 1) => {
    const idx = draft.variants.findIndex((v) => v.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= draft.variants.length) return;
    const next = [...draft.variants];
    const a = next[idx];
    const b = next[swapIdx];
    if (!a || !b) return;
    next[idx] = b;
    next[swapIdx] = a;
    setDraft({ ...draft, variants: next.map((v, i) => ({ ...v, position: i })) });
  };

return (
  <div className="min-h-screen space-y-6 pb-8">

    {/* HEADER */}
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent-strong">
            <Package className="h-7 w-7" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Gestion des produits</h1>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-strong">
                Catalogue
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez vos produits, leurs variantes, leurs prix et leurs stocks.
            </p>
          </div>
        </div>

        <Button
          variant="accent"
          className="h-11 gap-2 rounded-xl px-5 shadow-sm"
          onClick={() => {
            setDraft(emptyProduct);
            setRemovedAttributeIds([]);
            setShowRequiredErrors(false);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nouveau produit
        </Button>
      </div>
    </div>

    {/* STATISTICS */}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Total produits</span>
          <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">{list.length}</p>
        <p className="mt-1 text-xs text-muted-foreground">Produits dans le catalogue</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Produits actifs</span>
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
            <Eye className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">{list.filter(p => p.is_active).length}</p>
        <p className="mt-1 text-xs text-muted-foreground">Visibles dans la boutique</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Stock faible</span>
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">
          {list.filter(p => p.stock > 0 && p.stock <= 5).length}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Produits à réapprovisionner</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Ruptures de stock</span>
          <div className="rounded-xl bg-destructive/10 p-2.5 text-destructive">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">
          {list.filter(p => p.stock === 0).length}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Produits indisponibles</p>
      </div>

    </div>

    {/* FILTERS */}
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">Catalogue des produits</h2>
          <p className="text-xs text-muted-foreground">
            Recherchez et gérez vos produits.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-lg"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, marque ou SKU..."
            className="h-11 rounded-xl pl-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
          <SelectTrigger className="h-11 w-full rounded-xl lg:w-48">
            <SelectValue placeholder="Filtrer le stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les stocks</SelectItem>
            <SelectItem value="in">En stock (&gt; 5)</SelectItem>
            <SelectItem value="low">Stock faible (1-5)</SelectItem>
            <SelectItem value="out">Rupture de stock</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="h-11 w-full rounded-xl lg:w-52">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {Object.entries(categoriesMap).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filtered.length} résultat(s) trouvé(s)
        </p>
        {(search || stockFilter !== "all" || categoryFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStockFilter("all");
              setCategoryFilter("all");
            }}
            className="text-xs font-medium text-accent-strong hover:underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </div>

    {/* PRODUCT TABLE */}
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold">Liste des produits</h3>
          <p className="text-xs text-muted-foreground">
            Gestion et suivi du catalogue
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
          {filtered.length} produits
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1050px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 pl-5">Image</TableHead>
              <TableHead>Produit</TableHead>

              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-2 font-semibold"
                  onClick={togglePriceSort}
                >
                  Prix
                  <SortArrow dir={priceSort} ariaLabel="Trier par prix" />
                </button>
              </TableHead>

              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-2 font-semibold"
                  onClick={toggleStockSort}
                >
                  Stock
                  <SortArrow dir={stockSort} ariaLabel="Trier par stock" />
                </button>
              </TableHead>

              <TableHead className="text-center">Variantes</TableHead>
              <TableHead className="text-center">Nouveau</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64">
                  <div className="flex justify-center">
                    <Spinner showLabel />
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 rounded-2xl bg-muted p-4">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-semibold">Aucun produit trouvé</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Modifiez votre recherche ou vos filtres.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setSearch("");
                        setStockFilter("all");
                        setCategoryFilter("all");
                      }}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((p) => {
                const image = mainImage(p.images);

                return (
                  <TableRow
                    key={p.id}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="pl-5">
                      <Avatar className="h-12 w-12 rounded-xl border border-border shadow-sm">
                        {image?.url ? (
                          <AvatarImage
                            src={image.url}
                            alt={p.name}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="rounded-xl bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>

                    <TableCell>
                      <div className="max-w-[280px]">
                        <p className="truncate font-semibold">{p.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {p.sku || "Sans SKU"}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {categoriesMap[p.category_id ?? ""] || "Sans catégorie"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold tabular-nums">
                        {p.variants.length > 0 ? (() => {
                          const { min, max } = priceRangeForProduct(p);
                          return min === max
                            ? formatPrice(min)
                            : (
                              <span className="text-sm">
                                {formatPrice(min)} – {formatPrice(max)}
                              </span>
                            );
                        })() : formatPrice(p.price)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                        p.stock === 0
                          ? "bg-destructive/10 text-destructive"
                          : p.stock <= 5
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-emerald-500/10 text-emerald-600"
                      )}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {p.stock === 0 ? "Rupture" : `${p.stock} unités`}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">
                        {p.variants.length}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={!!p.is_new}
                          disabled={togglingNewId === p.id}
                          onCheckedChange={(next) => toggleIsNew(p.id, next)}
                          aria-label={p.is_new ? "Retirer le badge Nouveau" : "Afficher le badge Nouveau"}
                          className="data-[state=checked]:bg-accent-strong"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={!!p.is_active}
                          onCheckedChange={() => setToggleConfirm({
                            id: p.id,
                            next: !p.is_active
                          })}
                          className="data-[state=checked]:bg-emerald-600"
                          aria-label={p.is_active ? "Désactiver" : "Activer"}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1.5">

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => {
                            setViewProduct(p);
                            setSelectedOptions({});
                            setSelectedImageId(null);
                          }}
                          aria-label="Voir le produit"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => {
                            setDraft(p);
                            setRemovedAttributeIds([]);
                            setShowRequiredErrors(false);
                            setOpen(true);
                          }}
                          aria-label="Modifier le produit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setConfirmDeleteId(p.id)}
                          aria-label="Supprimer le produit"
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

      {/* PAGINATION */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage{" "}
            <span className="font-semibold text-foreground">{pageStart}–{pageEnd}</span>
            {" "}sur{" "}
            <span className="font-semibold text-foreground">{filtered.length}</span>
            {" "}produits
          </p>

          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrentPage(page => Math.max(1, page - 1));
                  }}
                  aria-disabled={currentPage === 1}
                  className={cn(
                    "rounded-lg",
                    currentPage === 1 && "pointer-events-none opacity-40"
                  )}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === page}
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage(page);
                    }}
                    className="rounded-lg"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrentPage(page => Math.min(totalPages, page + 1));
                  }}
                  aria-disabled={currentPage === totalPages}
                  className={cn(
                    "rounded-lg",
                    currentPage === totalPages && "pointer-events-none opacity-40"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>

    {/* Les trois Dialog existants : détails, confirmation activation,
        confirmation suppression, ainsi que le Dialog d'édition.
        Conserve ici leur contenu actuel. */}

    {/* VIEW PRODUCT DIALOG */}
    <Dialog
      open={Boolean(viewProduct)}
      onOpenChange={(v) => {
        if (!v) {
          setViewProduct(null);
          setSelectedOptions({});
          setSelectedImageId(null);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl border-border p-0">
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5 text-accent-strong">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {viewProduct?.name || "Détails du produit"}
                </DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aperçu détaillé du produit
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">
          {viewProduct && (() => {
            const sorted = [...viewProduct.images].sort(
              (a, b) => Number(b.is_main) - Number(a.is_main) || a.position - b.position
            );

            const hasVariants = viewProduct.variants.length > 0;

            const defaultSelectedOptions = hasVariants
              ? viewProduct.attributes.reduce<Record<string, string>>((acc, attr) => {
                  const value = viewProduct.variants[0]?.options?.[attr.id];
                  if (value) acc[attr.id] = value;
                  return acc;
                }, {})
              : {};

            const effectiveSelectedOptions =
              Object.keys(selectedOptions).length > 0
                ? selectedOptions
                : defaultSelectedOptions;

            const isSelectionComplete =
              viewProduct.attributes.length > 0 &&
              viewProduct.attributes.every(attr => Boolean(effectiveSelectedOptions[attr.id]));

            const selectedVariant = isSelectionComplete
              ? viewProduct.variants.find(v =>
                  viewProduct.attributes.every(
                    attr => v.options[attr.id] === effectiveSelectedOptions[attr.id]
                  )
                ) ?? null
              : null;

            const chosenValueIds = Object.values(effectiveSelectedOptions);

            const variantImage = chosenValueIds.length
              ? sorted.find(img => img.variant_value && chosenValueIds.includes(img.variant_value))
              : null;

            const activeImage = selectedImageId
              ? sorted.find(img => img.id === selectedImageId) ?? variantImage ?? sorted[0]
              : variantImage ?? sorted[0];

            const resolveAttributeImage = (valueId: string) => {
              const value = viewProduct.attributes
                .flatMap(attr => attr.values)
                .find(item => item.id === valueId);

              if (value?.image_url && looksLikeImageValue(value.image_url)) return value.image_url;
              if (value?.label && looksLikeImageValue(value.label)) return value.label;

              return viewProduct.images.find(img => img.variant_value === valueId)?.url;
            };

            const displayPrice = selectedVariant ? selectedVariant.price : viewProduct.price;
            const displayStock = selectedVariant ? selectedVariant.stock : viewProduct.stock;

            const variantPrices = viewProduct.variants.map(v => v.price);
            const variantPromoPrices = viewProduct.variants.map(v => v.cost_price ?? v.price);

            const hasOneGlobalPrice =
              !hasVariants ||
              (variantPrices.every(price => price === variantPrices[0]) &&
                variantPromoPrices.every(price => price === variantPromoPrices[0]));

            const globalOriginalPrice = hasVariants
              ? viewProduct.variants[0]?.price ?? viewProduct.price
              : viewProduct.price;

            const globalPromoPrice = hasVariants
              ? viewProduct.variants[0]?.cost_price ?? globalOriginalPrice
              : viewProduct.cost_price ?? viewProduct.price;

            const globalDiscountPercent =
              globalOriginalPrice && globalPromoPrice !== globalOriginalPrice
                ? Math.round(((globalOriginalPrice - globalPromoPrice) / globalOriginalPrice) * 100)
                : null;

            const chooseOption = (attributeId: string, valueId: string) => {
              setSelectedOptions(prev => ({ ...prev, [attributeId]: valueId }));
              setSelectedImageId(null);
            };

            return (
              <div className="grid gap-7 lg:grid-cols-2">

                {/* GALLERY */}
                <div className="space-y-3">
                  <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 p-4">
                    {activeImage?.url ? (
                      <img
                        src={activeImage.url}
                        alt={viewProduct.name}
                        className="max-h-[380px] w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Package className="h-12 w-12 opacity-40" />
                        <span className="text-sm">Aucune image disponible</span>
                      </div>
                    )}
                  </div>

                  {sorted.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {sorted.map(img => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setSelectedImageId(img.id)}
                          className={cn(
                            "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted transition",
                            activeImage?.id === img.id
                              ? "border-accent-strong"
                              : "border-transparent hover:border-border"
                          )}
                        >
                          <img src={img.url} alt={viewProduct.name} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* GENERAL INFORMATION */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">Marque</p>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {viewProduct.brand || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">SKU</p>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {viewProduct.sku || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">Catégorie</p>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {categoriesMap[viewProduct.category_id ?? ""] ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-xs text-muted-foreground">Statut</p>
                      <span className={cn(
                        "mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        viewProduct.is_active
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {viewProduct.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PRODUCT DETAILS */}
                <div className="space-y-5">

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {hasVariants && hasOneGlobalPrice ? "Prix global" : "Prix du produit"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {formatPrice(
                          hasVariants && hasOneGlobalPrice
                            ? globalPromoPrice
                            : viewProduct.cost_price ?? viewProduct.price
                        )}
                      </span>

                      {globalDiscountPercent !== null && hasVariants && hasOneGlobalPrice && (
                        <>
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(globalOriginalPrice)}
                          </span>
                          <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
                            -{Math.abs(globalDiscountPercent)}%
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                      <span className="text-muted-foreground">Stock disponible</span>
                      <span className={cn(
                        "font-semibold",
                        (selectedVariant ? selectedVariant.stock : viewProduct.stock) === 0
                          ? "text-destructive"
                          : "text-emerald-600"
                      )}>
                        {selectedVariant ? selectedVariant.stock : viewProduct.stock} unités
                      </span>
                    </div>
                  </div>

                  {/* VARIANTS */}
                  {hasVariants && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Variantes du produit</h3>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          {viewProduct.variants.length} variantes
                        </span>
                      </div>

                      {viewProduct.attributes.map(attribute => (
                        <div key={attribute.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{attribute.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attribute.values.find(v => v.id === effectiveSelectedOptions[attribute.id])?.label}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {attribute.values.map(value => {
                              const isSelected = effectiveSelectedOptions[attribute.id] === value.id;

                              if (attribute.type === "swatch") {
                                return (
                                  <button
                                    key={value.id}
                                    type="button"
                                    title={value.label}
                                    onClick={() => chooseOption(attribute.id, value.id)}
                                    className={cn(
                                      "h-9 w-9 rounded-full border-2 transition",
                                      isSelected
                                        ? "border-accent-strong ring-2 ring-accent/30"
                                        : "border-border hover:scale-105"
                                    )}
                                    style={{ backgroundColor: value.hex || "#e5e7eb" }}
                                  />
                                );
                              }

                              if (
                                attribute.type === "image" ||
                                looksLikeImageValue(value.label) ||
                                looksLikeImageValue(value.image_url)
                              ) {
                                const previewUrl = resolveAttributeImage(value.id);

                                return (
                                  <button
                                    key={value.id}
                                    type="button"
                                    title={value.label}
                                    onClick={() => chooseOption(attribute.id, value.id)}
                                    className={cn(
                                      "h-10 w-10 overflow-hidden rounded-xl border-2 transition",
                                      isSelected ? "border-accent-strong ring-2 ring-accent/20" : "border-border"
                                    )}
                                  >
                                    {previewUrl && (
                                      <img src={previewUrl} alt={value.label} className="h-full w-full object-cover" />
                                    )}
                                  </button>
                                );
                              }

                              return (
                                <button
                                  key={value.id}
                                  type="button"
                                  onClick={() => chooseOption(attribute.id, value.id)}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-sm font-medium transition",
                                    isSelected
                                      ? "border-accent-strong bg-accent/10 text-accent-strong"
                                      : "border-border hover:bg-muted"
                                  )}
                                >
                                  {value.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {selectedVariant ? (
                        <div className="space-y-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">Variante sélectionnée</span>
                            <span className="text-xs text-muted-foreground">{selectedVariant.sku || "Sans SKU"}</span>
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xl font-bold">
                              {formatPrice(selectedVariant.cost_price ?? selectedVariant.price)}
                            </span>
                            {selectedVariant.cost_price != null &&
                              selectedVariant.cost_price !== selectedVariant.price && (
                                <span className="text-sm text-muted-foreground line-through">
                                  {formatPrice(selectedVariant.price)}
                                </span>
                              )}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Stock : <strong className="text-foreground">{selectedVariant.stock}</strong>
                          </p>
                        </div>
                      ) : isSelectionComplete ? (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          Cette combinaison n'existe pas pour ce produit.
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!hasVariants && viewProduct.compare_at_price && (
                    <p className="text-sm text-muted-foreground">
                      Prix avant réduction :{" "}
                      <span className="line-through">
                        {formatPrice(viewProduct.compare_at_price)}
                      </span>
                    </p>
                  )}

                  {(viewProduct.short_description || viewProduct.description) && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <h3 className="font-semibold">Description</h3>
                      {viewProduct.short_description && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {viewProduct.short_description}
                        </p>
                      )}
                      {viewProduct.description && (
                        <RichText value={viewProduct.description} className="text-sm leading-relaxed" />
                      )}
                    </div>
                  )}

                </div>

                {/* FOOTER */}
                <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end lg:col-span-2">
                  <Button variant="outline" onClick={() => setViewProduct(null)}>
                    Fermer
                  </Button>
                  <Button
                    variant="accent"
                    onClick={() => {
                      setDraft(viewProduct);
                      setRemovedAttributeIds([]);
                      setShowRequiredErrors(false);
                      setOpen(true);
                      setViewProduct(null);
                      setSelectedOptions({});
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Modifier le produit
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>

    {/* CONFIRM TOGGLE */}
    <Dialog open={Boolean(toggleConfirm)} onOpenChange={v => { if (!v) setToggleConfirm(null); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirmer le changement de statut</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Voulez-vous vraiment {toggleConfirm?.next ? "activer" : "désactiver"} ce produit ?
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setToggleConfirm(null)} disabled={isToggling}>
            Annuler
          </Button>
          <Button
            variant="accent"
            onClick={async () => {
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
              } finally {
                setIsToggling(false);
              }
            }}
            disabled={isToggling}
          >
            {isToggling ? <Spinner className="h-4 w-4" /> : toggleConfirm?.next ? "Activer" : "Désactiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* CONFIRM DELETE */}
    <Dialog open={Boolean(confirmDeleteId)} onOpenChange={v => { if (!v) setConfirmDeleteId(null); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="h-6 w-6" />
          </div>
          <DialogTitle>Supprimer ce produit ?</DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Cette action est irréversible. Le produit et ses images seront supprimés.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={isDeleting}>
            Annuler
          </Button>
          <Button
            variant="accent"
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={async () => {
              const id = confirmDeleteId;
              if (!id || isDeleting) return;
              setIsDeleting(true);

              try {
                const { data: imgs, error: imgErr } = await supabase
                  .from("product_images")
                  .select("url")
                  .eq("product_id", id);
                if (imgErr) throw imgErr;

                for (const img of (imgs ?? []) as any[]) {
                  const url = img?.url as string | undefined;
                  if (!url) continue;
                  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
                  if (m) {
                    try {
                      await deleteFromBucket(m[1]!, decodeURIComponent(m[2]!));
                    } catch (e) {
                      console.warn("failed to delete storage object", e);
                    }
                  }
                }

                const { error: delImgsErr } = await supabase.from("product_images").delete().eq("product_id", id);
                if (delImgsErr) throw delImgsErr;

                const { error } = await supabase.from("products").delete().eq("id", id);
                if (error) throw error;

                setList(prev => prev.filter(x => x.id !== id));
                toast.success("Produit supprimé.");
              } catch (err) {
                console.error(err);
                toast.error("Impossible de supprimer le produit.");
              } finally {
                setIsDeleting(false);
                setConfirmDeleteId(null);
              }
            }}
          >
            {isDeleting ? <Spinner className="h-4 w-4" /> : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ADD / EDIT PRODUCT */}
    <Dialog open={open} onOpenChange={v => { if (!isSaving) setOpen(v); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl border-border p-0">
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5 text-accent-strong">
                {draft.id ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {draft.id ? "Modifier le produit" : "Nouveau produit"}
                </DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gérez les informations, variantes et images de votre produit.
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted/70 p-1">
              <TabsTrigger value="general" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                <Package className="h-4 w-4" />
                Général
              </TabsTrigger>
              <TabsTrigger value="variantes" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                <SlidersHorizontal className="h-4 w-4" />
                Attributs
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                <ImagePlus className="h-4 w-4" />
                Images
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-5">
              <ProductGeneral
                draft={draft}
                setDraft={setDraft}
                categories={categoriesList}
                showRequiredErrors={showRequiredErrors}
              />
            </TabsContent>

            <TabsContent value="variantes" className="mt-5">
              <AttributesVariants
                draft={draft}
                setDraft={setDraft}
                addAttribute={addAttribute}
                addValue={addValue}
                removeValue={removeValue}
                addVariant={addVariant}
                updateAttribute={updateAttribute}
                removeAttribute={removeAttribute}
                updateVariant={updateVariant}
                setVariantOption={setVariantOption}
                moveVariant={moveVariant}
              />
            </TabsContent>

            <TabsContent value="images" className="mt-5">
              <ProductImages draft={draft} setDraft={setDraft} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button
            variant="accent"
            className="rounded-xl px-6"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Enregistrement...
              </>
            ) : (
              <>
                {draft.id ? <Edit2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {draft.id ? "Enregistrer les modifications" : "Créer le produit"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

  </div>
);

}