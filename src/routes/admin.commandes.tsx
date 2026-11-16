import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Download, Eye, Plus, Trash2, Edit2, SlidersHorizontal, User, Phone, Mail, MapPin, FileText, FileDown, Divide } from "lucide-react";
import { GOVERNORATES } from "@/data/governorates";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import SortArrow from "@/components/ui/sort-arrow";
import { toast } from "sonner";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/data/orders";
import type { Order, OrderStatus, OrderItem } from "@/types";
import { formatPrice } from "@/lib/placeholder";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination";
import { takeAdminFocus } from "@/lib/admin-focus";
import { jsPDF } from "jspdf";
import OrderStatusTimeline from "@/components/store/OrderStatusTimeline";

export const Route = createFileRoute("/admin/commandes")({
  // Liens profonds depuis les notifications : `?order=<uuid>`, ou `?ref=<numéro>`
  // pour les notifications antérieures dont le lien ne portait pas d'identifiant.
  validateSearch: (search: Record<string, unknown>): { order?: string; ref?: string } => ({
    ...(typeof search["order"] === "string" ? { order: search["order"] } : {}),
    ...(typeof search["ref"] === "string" ? { ref: search["ref"] } : {}),
  }),
  component: AdminOrders,
});

const statuses: string[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const allowedTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

type DraftOrderItem = {
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string | null;
  variant_label: string | null;
  image: string | null;
  unit_price: number;
  quantity: number;
};

type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category_id: string | null;
  short_description: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  sku: string;
  is_active: boolean;
  is_new: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
  images: Array<{
    id: string;
    product_id: string;
    url: string;
    alt: string;
    position: number;
    is_main?: boolean;
    variant_value: string | null;
  }>;
  attributes: Array<{
    id: string;
    name: string;
    code: string;
    type: "swatch" | "button";
    values: Array<{ id: string; label: string; hex?: string }>;
  }>;
  variants: Array<{
    id: string;
    product_id: string;
    sku: string;
    options: Record<string, string>;
    price: number;
    compare_at_price: number | null;
    stock: number;
    is_active: boolean;
    position?: number;
  }>;
  tags: string[];
};

type ShippingRate = {
  id: string;
  governorate: string;
  price: number;
  is_active: boolean;
};

type OrderDraft = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  address_line: string;
  city: string;
  payment_method: string;
  status: OrderStatus;
  coupon_code: string;
  note: string;
};

const emptyOrderDraft = (): OrderDraft => ({
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  governorate: "",
  address_line: "",
  city: "",
  payment_method: "cod",
  status: "pending" as OrderStatus,
  coupon_code: "",
  note: "",
});

// ---------------------------------------------------------------------------
// Mapping centralisé : utilisé au chargement initial ET en cas de rollback
// (avant, ce bloc était dupliqué et incomplet -> email/adresse/ville/city et
// images des articles n'étaient jamais peuplés après un rechargement de page)
// ---------------------------------------------------------------------------
async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items(
        *,
        products(
          sku,
          product_images(url, is_main, position)
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const orders = rows.map(mapOrderRow);

  // Le checkout boutique ne met pas d'e-mail dans shipping_address (il n'est
  // saisi nulle part côté client) : on le complète depuis profiles. En
  // best-effort — un échec ici ne doit pas priver l'admin de sa liste.
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", userIds);
    if (profilesError) {
      console.warn("load order customer emails", profilesError);
    } else {
      const emailByUser = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
      rows.forEach((r: any, index: number) => {
        const order = orders[index];
        if (order && !order.customer_email) order.customer_email = emailByUser.get(r.user_id) ?? "";
      });
    }
  }

  return orders;
}

function mapOrderRow(r: any): Order {
  const shipping = r.shipping_address ?? {};

  return {
    id: r.id,
    reference: r.order_number,
    customer_name: shipping.full_name || shipping.name || "Client",
    customer_email: shipping.email || "",
    customer_phone: shipping.phone || shipping.mobile || "",
    address_line: shipping.line1 || shipping.address_line || "",
    city: shipping.city || "",
    postal_code: shipping.postal_code || "",
    governorate: shipping.governorate || shipping.city || "",
    status: (r.status as OrderStatus) || "pending",
    payment_method: r.payment_method || "",
    subtotal: r.subtotal ?? 0,
    shipping: r.shipping_amount ?? 0,
    discount: r.discount_amount ?? 0,
    total: r.total ?? 0,
    created_at: r.created_at,
    items: (r.order_items || []).map((it: any) => {
      const images: any[] = it.products?.product_images ?? [];
      const mainImage =
        images.find((img) => img.is_main)?.url ??
        [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url ??
        "";

      return {
        id: it.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        name: it.product_name || "Article",
        sku: it.sku || it.products?.sku || null,
        variant_label: it.variant_label || null,
        image: mainImage,
        unit_price: it.unit_price ?? 0,
        quantity: it.quantity ?? 1,
      };
    }),
    notes: r.notes ?? null,
  };
}

function AdminOrders() {
  const { profile } = useAuth();
  const { settings } = useSiteSettings();
  const [list, setList] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [detail, setDetail] = useState<Order | null>(null);
  const { order: focusOrderId, ref: focusOrderRef } = Route.useSearch();
  // Cible transmise par la boîte de réception (cf. lib/admin-focus).
  const [relayFocus, setRelayFocus] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    setRelayFocus(takeAdminFocus("/admin/commandes"));
  }, []);
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);

  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [selectedOrderItems, setSelectedOrderItems] = useState<DraftOrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [productSearch, setProductSearch] = useState("");
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [dateSortDir, setDateSortDir] = useState<'asc' | 'desc' | null>(null);
  const [governorateSearch, setGovernorateSearch] = useState("");
  const [isGovernorateMenuOpen, setIsGovernorateMenuOpen] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(emptyOrderDraft());
  const [validatedCoupon, setValidatedCoupon] = useState<any | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusNoteOpen, setStatusNoteOpen] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; status: OrderStatus } | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [orderFieldErrors, setOrderFieldErrors] = useState<Record<string, string>>({});

  const getMissingOrderAddressField = () => {
    if (!draft.customer_name.trim()) return { key: "customer_name", message: "Le nom du client est requis." };
    if (!draft.customer_phone.trim()) return { key: "customer_phone", message: "Le téléphone est obligatoire." };
    if (!draft.address_line.trim()) return { key: "address_line", message: "L'adresse est obligatoire." };
    if (!draft.city.trim()) return { key: "city", message: "La ville est obligatoire." };
    if (!draft.governorate.trim()) return { key: "governorate", message: "Le gouvernorat est obligatoire." };
    return null;
  };

  const validateOrderAddress = () => {
    const missingField = getMissingOrderAddressField();
    if (!missingField) {
      setOrderFieldErrors({});
      return true;
    }
    setOrderFieldErrors({ [missingField.key]: missingField.message });
    document.getElementById(`order-${missingField.key}`)?.focus();
    return false;
  };

  const getVariantLabel = (product: CatalogProduct | null, variant: CatalogProduct["variants"][number] | null | undefined) => {
    if (!product || !variant) return "Variation";

    const labelParts: string[] = [];
    product.attributes.forEach((attribute) => {
      const valueId = variant.options[attribute.id];
      if (!valueId) return;
      const value = attribute.values.find((item) => item.id === valueId);
      if (value) {
        labelParts.push(value.label);
      }
    });

    if (labelParts.length > 0) {
      return labelParts.join(" / ");
    }

    return variant.sku || product.sku || "Variation";
  };

  useEffect(() => {
    let mounted = true;
    async function loadCatalogProducts() {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_images(*),
          product_attributes(attribute_id, attributes(id, name, display_type, attribute_values(*))),
          product_variants(*, variant_attribute_values(attribute_value_id, attribute_values(id, value, color_hex, attribute_id, attributes(id, name))))
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Impossible de charger les produits depuis Supabase.");
        return;
      }

      if (!mounted) return;

      const mapped: CatalogProduct[] = (data ?? []).map((product: any) => {
        const attributes: CatalogProduct["attributes"] = (product.product_attributes ?? [])
          .map((pa: any) => pa.attributes)
          .filter(Boolean)
          .map((attribute: any) => ({
            id: attribute.id,
            name: attribute.name,
            code: attribute.id,
            type: attribute.display_type === "color_swatch" ? "swatch" : "button",
            values: (attribute.attribute_values ?? [])
              .slice()
              .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
              .map((value: any) => ({
                id: value.id,
                label: value.value,
                hex: value.color_hex ?? undefined,
              })),
          }));

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand ?? "",
          category_id: product.category_id ?? null,
          short_description: product.short_description ?? "",
          description: product.description ?? "",
          price: Number(product.base_price ?? product.price ?? 0),
          compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
          stock: Number(product.stock_quantity ?? 0),
          sku: product.sku ?? "",
          is_active: product.is_active ?? true,
          is_new: false,
          rating: 0,
          reviews_count: 0,
          created_at: product.created_at ?? new Date().toISOString(),
          images: ((product.product_images ?? []) as any[]).map((image) => ({
            id: image.id,
            product_id: image.product_id ?? product.id,
            url: image.url ?? "",
            alt: product.name,
            position: Number(image.position ?? 0),
            is_main: Boolean(image.is_main),
            variant_value: image.variant_value ?? null,
          })),
          attributes,
          variants: ((product.product_variants ?? []) as any[]).map((variant: any) => {
            const options = (variant.variant_attribute_values ?? []).reduce((acc: Record<string, string>, link: any) => {
              const value = link.attribute_values;
              const attribute = attributes.find((entry) => entry.values.some((item) => item.id === value?.id));
              if (attribute && value) {
                acc[attribute.id] = value.id;
              }
              return acc;
            }, {});

            return {
              id: variant.id,
              product_id: variant.product_id ?? product.id,
              sku: variant.sku ?? "",
              options,
              price: Number(variant.price ?? product.base_price ?? 0),
              compare_at_price: variant.compare_at_price ? Number(variant.compare_at_price) : null,
              stock: Number(variant.stock_quantity ?? 0),
              is_active: variant.is_active ?? true,
              position: Number(variant.position ?? 0),
            };
          }),
          tags: [],
        };
      });

      setCatalogProducts(mapped);
    }

    loadCatalogProducts();
    return () => { mounted = false; };
  }, []);


  useEffect(() => {
    const wantedId = focusOrderId ?? relayFocus?.["order"];
    const wantedRef = focusOrderRef ?? relayFocus?.["ref"];
    if (!wantedId && !wantedRef) return;
    const target = list.find(
      (o) => (wantedId && o.id === wantedId) || (wantedRef && o.reference === wantedRef),
    );
    if (!target) return;
    setDetail(target);
    setRelayFocus(null);
    // On retire le paramètre : refermer la fiche ne doit pas la rouvrir au
    // rafraîchissement de la page.
    navigate({ to: "/admin/commandes", search: {}, replace: true });
  }, [focusOrderId, focusOrderRef, relayFocus, list, navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const mapped = await fetchOrders();
        if (mounted) setList(mapped);
      } catch (err) {
        console.error(err);
        toast.error("Impossible de charger les commandes depuis Supabase.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const filtered = list.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      q === "" ||
      o.reference.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      (o.governorate || "").toLowerCase().includes(q);
    const orderDate = o.created_at?.slice(0, 10) ?? "";
    const matchDate = (!dateFrom || orderDate >= dateFrom) && (!dateTo || orderDate <= dateTo);
    const matchStatus = filter === "all" || o.status === filter;
    return matchSearch && matchDate && matchStatus;
  });

  // Apply the selected sort to the filtered orders.
  const sorted = (() => {
    if (sortDir) {
      return [...filtered].sort((a, b) => (sortDir === "asc" ? a.total - b.total : b.total - a.total));
    }
    if (dateSortDir) {
      return [...filtered].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateSortDir === "asc" ? dateA - dateB : dateB - dateA;
      });
    }
    return filtered;
  })();

  // Pagination (client-side)
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const deleteOrder = async (id: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) {
        console.error(error);
        toast.error("Impossible de supprimer la commande.");
        return;
      }
      setList((prev) => prev.filter((o) => o.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success("Commande supprimée.");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSelectedOrders = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await supabase.from("orders").delete().in("id", selectedIds);
      if (error) {
        console.error(error);
        toast.error("Impossible de supprimer les commandes sélectionnées.");
        return;
      }
      const removed = selectedIds.length;
      setList((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
      setSelectedIds([]);
      toast.success(`${removed} commande(s) supprimée(s).`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openStatusNote = (id: string, status: OrderStatus) => {
    setPendingStatusChange({ id, status });
    setStatusNote("");
    setStatusNoteOpen(true);
  };

  const requestStatusChange = (id: string, status: OrderStatus) => {
    if (status === "cancelled") {
      openStatusNote(id, status);
      return;
    }
    void changeStatus(id, status, "");
  };

  const changeStatus = async (id: string, status: OrderStatus, note: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", {
      p_order_id: id,
      p_new_status: status,
      p_note: note.trim() || null,
    });
    if (error) {
      console.error(error);
      toast.error("Impossible de mettre à jour le statut.");
      // revert en rechargeant la liste avec le mapping complet
      try {
        setList(await fetchOrders());
      } catch (e) {
        console.error(e);
      }
      return;
    }
    setList((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setDetail((d: Order | null) => (d && d.id === id ? { ...d, status } : d));
    toast.success(`Statut mis à jour : ${(ORDER_STATUS_LABELS as any)[status] ?? status}`);
  };

  const submitStatusChange = async () => {
    if (!pendingStatusChange) return;
    await changeStatus(pendingStatusChange.id, pendingStatusChange.status, statusNote);
    setStatusNoteOpen(false);
    setPendingStatusChange(null);
  };

  const exportPDF = (rows: Order[]) => {
    const dateLabel = new Date().toLocaleString();
    const rowsHtml = rows
      .map((r) => {
        const items = r.items.map((it) => `${it.name} x${it.quantity}`).join("; ");
        const date = r.created_at ? new Date(r.created_at).toLocaleString() : "";
        return `
          <tr>
            <td>${escapeHtml(r.reference)}</td>
            <td>${escapeHtml(r.customer_name)}</td>
            <td>${escapeHtml(r.governorate)}</td>
            <td>${escapeHtml(date)}</td>
            <td style="text-align:right">${escapeHtml(String(r.total))}</td>
            <td>${escapeHtml(String(r.status))}</td>
            <td>${escapeHtml(items)}</td>
          </tr>`;
      })
      .join("\n");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Export commandes</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:6px;font-size:12px}th{background:#f3f4f6;text-align:left}</style></head><body><h1>Export commandes — ${escapeHtml(dateLabel)}</h1><table><thead><tr><th>Référence</th><th>Client</th><th>Gouvernorat</th><th>Date</th><th>Total</th><th>Statut</th><th>Articles</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Impossible d'ouvrir la fenêtre d'export.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const exportOrderPDF = (order: Order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Bon de commande", 14, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Artisanat", pageWidth - 14, y, { align: "right" });
    y += 10;
    doc.setDrawColor(210, 210, 210);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text(`Commande : ${order.reference}`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Date : ${order.created_at ? `${new Date(order.created_at).toLocaleDateString("fr-FR")} à ${new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "-"}`,
      pageWidth - 14,
      y,
      { align: "right" },
    );
    y += 9;
    doc.text(`Statut : ${(ORDER_STATUS_LABELS as any)[order.status] ?? order.status}`, 14, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.text("Client", 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    [
      ["Nom", order.customer_name],
      ["Téléphone", order.customer_phone],
      ["E-mail", order.customer_email],
      ["Adresse", order.address_line],
      ["Ville / Gouvernorat", [order.city, order.governorate].filter(Boolean).join(", ")],
    ].forEach(([label, value]) => {
      if (value) {
        doc.text(`${label} : ${String(value)}`, 14, y);
        y += 5;
      }
    });
    y += 8;

    if (order.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Note", 14, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      const noteLines = doc.splitTextToSize(order.notes, pageWidth - 28);
      doc.text(noteLines, 14, y);
      y += noteLines.length * 5 + 8;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Articles", 14, y);
    y += 7;
    doc.setFontSize(9);
    doc.text("Produit", 14, y);
    doc.text("Qté", 125, y);
    doc.text("Prix", 145, y);
    doc.text("Total", pageWidth - 14, y, { align: "right" });
    y += 4;
    doc.line(14, y, pageWidth - 14, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    order.items.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const itemLabel = `${item.name}${item.variant_label ? ` - ${item.variant_label}` : ""}`;
      const nameLines = doc.splitTextToSize(
        item.sku ? `${itemLabel}\nSKU : ${item.sku}` : itemLabel,
        100,
      );
      doc.text(nameLines, 14, y);
      doc.text(String(item.quantity), 125, y);
      doc.text(formatPrice(item.unit_price), 145, y);
      doc.text(formatPrice(item.unit_price * item.quantity), pageWidth - 14, y, { align: "right" });
      y += Math.max(7, nameLines.length * 5);
    });

    y += 5;
    doc.line(110, y, pageWidth - 14, y);
    y += 7;
    doc.text("Sous-total", 110, y);
    doc.text(formatPrice(order.subtotal), pageWidth - 14, y, { align: "right" });
    y += 6;
    doc.text("Livraison", 110, y);
    doc.text(formatPrice(order.shipping), pageWidth - 14, y, { align: "right" });
    if (order.discount > 0) {
      y += 6;
      doc.text("Remise", 110, y);
      doc.text(`-${formatPrice(order.discount)}`, pageWidth - 14, y, { align: "right" });
    }
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Total à payer", 110, y);
    doc.text(formatPrice(order.total), pageWidth - 14, y, { align: "right" });
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Paiement à la livraison", 14, y);
    doc.save(`bon-commande-${order.reference}.pdf`);
  };

  const openEdit = (o: Order) => {
    // populate draft and items for editing
    setDraft((d) => ({
      ...d,
      customer_name: o.customer_name || "",
      customer_email: o.customer_email || "",
      customer_phone: o.customer_phone || "",
      governorate: o.governorate || "",
      address_line: o.address_line || "",
      city: o.city || "",
      payment_method: o.payment_method || "cod",
      status: o.status || "pending",
      coupon_code: "",
      note: (o as any).notes ?? "",
    }));

    setSelectedOrderItems((o.items || []).map((it: OrderItem) => ({
      product_id: it.product_id,
      variant_id: it.variant_id ?? null,
      name: it.name,
      sku: it.sku ?? null,
      variant_label: it.variant_label ?? null,
      image: it.image ?? null,
      unit_price: it.unit_price ?? 0,
      quantity: it.quantity ?? 1,
    })));

    setAddOpen(true);
    setEditingOrderId(o.id);
    setCreateStep(1);
  };

  const addOrderItem = (product: CatalogProduct) => {
    const variant =
      product.variants && product.variants.length > 0
        ? product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0]
        : null;
    if (variant && (variant.stock ?? 0) <= 0) {
      toast.error("La variation sélectionnée est en rupture de stock.");
      return;
    }
    if ((product.stock ?? 0) <= 0) {
      toast.error("Le produit est en rupture de stock.");
      return;
    }
    const price = Number(variant ? variant.price : product.price ?? 0);
    const image = product.images?.find((img) => img.is_main)?.url ?? product.images?.[0]?.url ?? null;
    const sku = variant?.sku ?? product.sku ?? null;
    const variantLabel = getVariantLabel(product, variant) || sku;
    const itemQty = Math.max(1, Number(selectedQty) || 1);
    const stockQty = variant ? Number(variant.stock ?? 0) : Number(product.stock ?? 0);
    if (stockQty <= 0) {
      toast.error("Article en rupture de stock.");
      return;
    }
    if (itemQty > stockQty) {
      toast.error(`Quantité demandée (${itemQty}) supérieure au stock disponible (${stockQty}).`);
      return;
    }

    const existingItem = selectedOrderItems.find(
      (item) => item.product_id === product.id && item.variant_id === (variant?.id ?? null),
    );
    if (existingItem && existingItem.quantity >= stockQty) {
      toast.error(`Stock maximum déjà ajouté au panier (${stockQty}).`);
      return;
    }

    setSelectedOrderItems((prev) => {
      const current = prev.find((item) => item.product_id === product.id && item.variant_id === (variant?.id ?? null));
      if (current) {
        return prev.map((item) => item.product_id === product.id && item.variant_id === (variant?.id ?? null)
          ? { ...item, quantity: itemQty }
          : item);
      }
      return [
        ...prev,
        {
          product_id: product.id,
          variant_id: variant?.id ?? null,
          name: product.name,
          sku,
          variant_label: variantLabel,
          image,
          unit_price: price,
          quantity: itemQty,
        },
      ];
    });

    setSelectedQty(1);
    setSelectedVariantId("");
  };

  const selectedProductIds = selectedOrderItems.map((item) => item.product_id);
  const selectedProduct = catalogProducts.find((product) => product.id === selectedProductId) ?? null;
  const selectedProductVariants = selectedProduct?.variants ?? [];
  const availableStock = (() => {
    if (!selectedProduct) return 0;
    if (selectedProduct.variants && selectedProduct.variants.length > 0) {
      const v = selectedProduct.variants.find((vv) => vv.id === selectedVariantId) ?? null;
      return v ? Number(v.stock ?? 0) : 0;
    }
    return Number(selectedProduct.stock ?? 0);
  })();
  const filteredCatalogProducts = catalogProducts.filter((product) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) ||
      (product.sku || "").toLowerCase().includes(q)
    );
  });
  const displayedProductValue = selectedProduct ? selectedProduct.name : productSearch;

  // Tarif unique pour toute la Tunisie (cf. database/shipping-flat-rate.sql) :
  // la table shipping_rates n'existe plus. On reconstitue la meme forme de
  // donnees a partir de la liste des gouvernorats et du tarif de la boutique,
  // ce qui laisse le selecteur et sa recherche fonctionner a l'identique.
  const shippingRates = useMemo<ShippingRate[]>(
    () =>
      GOVERNORATES.map((g) => ({
        id: g,
        governorate: g,
        price: Number(settings?.shipping_price ?? 0),
        is_active: true,
      })),
    [settings],
  );

  const selectedShippingRate = shippingRates.find(
    (r) => r.governorate.toLowerCase() === draft.governorate.trim().toLowerCase(),
  ) ?? null;
  const shippingCost = selectedShippingRate?.price ?? 0;

  const filteredShippingRates = shippingRates.filter((r) =>
    r.governorate.toLowerCase().includes(governorateSearch.trim().toLowerCase()),
  );
  const displayedGovernorateValue = draft.governorate || governorateSearch;

  const updateOrderItemQty = (productId: string | null, variantId: string | null, delta: number) => {
    if (!productId) return;
    if (delta > 0) {
      const product = catalogProducts.find((item) => item.id === productId);
      const stock = variantId
        ? Number(product?.variants.find((variant) => variant.id === variantId)?.stock ?? 0)
        : Number(product?.stock ?? 0);
      const currentItem = selectedOrderItems.find(
        (item) => item.product_id === productId && (item.variant_id ?? null) === (variantId ?? null),
      );
      if (currentItem && currentItem.quantity >= stock) {
        toast.error(`Stock maximum atteint (${stock}).`);
        return;
      }
    }
    setSelectedOrderItems((prev) =>
      prev
        .map((item) => (item.product_id === productId && (item.variant_id ?? null) === (variantId ?? null)
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const removeOrderItem = (productId: string | null, variantId: string | null) => {
    if (!productId) return;
    setSelectedOrderItems((prev) => prev.filter((item) => !(item.product_id === productId && (item.variant_id ?? null) === (variantId ?? null))));
  };

  const createOrder = async () => {
    if (!validateOrderAddress()) {
      return;
    }
    const customerName = draft.customer_name.trim();
    if (selectedOrderItems.length === 0) {
      toast.error("Ajoute au moins un article pour créer la commande.");
      return;
    }
    if (!selectedShippingRate) {
      toast.error("Sélectionne un gouvernorat valide pour calculer les frais de livraison.");
      return;
    }

    const subtotal = selectedOrderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const shipping = selectedShippingRate.price;
    const couponDiscount = validatedCoupon
      ? (validatedCoupon.discount_type === 'percentage'
          ? Math.round(subtotal * (Number(validatedCoupon.discount_value) / 100))
          : Number(validatedCoupon.discount_value ?? 0))
      : 0;
    const total = subtotal + shipping - couponDiscount;
    const paymentMethodValue = "cod";
    const orderAddress = {
      full_name: customerName,
      email: draft.customer_email.trim() || null,
      phone: draft.customer_phone,
      governorate: draft.governorate,
      city: draft.city,
      address_line: draft.address_line,
    };

    const payload = {
      status: draft.status,
      coupon_id: validatedCoupon?.id ?? null,
      user_id: profile?.id ?? null,
      subtotal,
      discount_amount: couponDiscount,
      shipping_amount: shipping,
      total,
      payment_method: paymentMethodValue,
      shipping_address: orderAddress,
      billing_address: orderAddress,
      notes: draft.note.trim() || null,
      created_at: new Date().toISOString(),
    };

    setIsSubmitting(true);
    const decrementedStock: Array<{ table: "products" | "product_variants"; id: string; quantity: number }> = [];
    let createdOrderId: string | null = null;
    try {

    if (!editingOrderId) {
      const { data, error } = await supabase.from("orders").insert(payload).select().single();
      if (error) {
        console.error(error);
        toast.error("Impossible de créer la commande.");
        return;
      }

      const orderItemsPayload = selectedOrderItems.map((item) => ({
        order_id: data.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.name,
        variant_label: item.variant_label,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.unit_price * item.quantity,
        sku: item.sku,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
      if (itemsError) {
        console.error(itemsError);
        toast.error("La commande a été créée mais les articles n'ont pas pu être enregistrés.");
        return;
      }

      for (const item of selectedOrderItems) {
        if (!item.product_id) continue;
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Quantité de commande invalide.");
        }

        const table = item.variant_id ? "product_variants" : "products";
        const stockId = item.variant_id ?? item.product_id;
        const { data: stockRow, error: stockReadError } = await supabase
          .from(table)
          .select("stock_quantity")
          .eq("id", stockId)
          .maybeSingle();
        if (stockReadError) throw stockReadError;
        const currentStock = Number(stockRow?.stock_quantity ?? 0);
        if (!stockRow || currentStock < quantity) {
          throw new Error(`Stock insuffisant pour ${item.name}.`);
        }
        const { data: updatedRows, error: stockError } = await supabase
          .from(table)
          .update({ stock_quantity: currentStock - quantity })
          .eq("id", stockId)
          .gte("stock_quantity", quantity)
          .select("id");
        if (stockError) throw stockError;
        if (!updatedRows?.length) throw new Error(`Stock insuffisant pour ${item.name}.`);
        decrementedStock.push({ table, id: stockId, quantity });
      }

      var result = data as any;
      createdOrderId = data.id;
    } else {
      // Update existing order
      const orderId = editingOrderId;
      const updatePayload: any = {
        status: draft.status,
        coupon_id: validatedCoupon?.id ?? null,
        user_id: profile?.id ?? null,
        subtotal,
        discount_amount: couponDiscount,
        shipping_amount: shipping,
        total,
        payment_method: paymentMethodValue,
        shipping_address: orderAddress,
        billing_address: orderAddress,
        notes: draft.note.trim() || null,
      };

      const { data: updatedData, error: updateError } = await supabase.from("orders").update(updatePayload).eq("id", orderId).select().single();
      if (updateError) {
        console.error(updateError);
        toast.error("Impossible de mettre à jour la commande.");
        return;
      }

      // Replace order items (simple approach)
      const { error: delErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (delErr) {
        console.error(delErr);
        toast.error("Impossible de remplacer les articles de la commande.");
        return;
      }

      const orderItemsPayload = selectedOrderItems.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.name,
        variant_label: item.variant_label,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.unit_price * item.quantity,
        sku: item.sku,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
      if (itemsError) {
        console.error(itemsError);
        toast.error("Les articles n'ont pas pu être enregistrés pour la commande mise à jour.");
        return;
      }

      var result = updatedData as any;
    }
    } catch (e) {
      console.error(e);
      for (const stock of decrementedStock) {
        const { data: stockRow } = await supabase
          .from(stock.table)
          .select("stock_quantity")
          .eq("id", stock.id)
          .maybeSingle();
        if (stockRow) {
          await supabase
            .from(stock.table)
            .update({ stock_quantity: Number(stockRow.stock_quantity ?? 0) + stock.quantity })
            .eq("id", stock.id);
        }
      }
      if (createdOrderId) {
        await supabase.from("orders").delete().eq("id", createdOrderId);
      }
      toast.error("Une erreur est survenue.");
      return;
    } finally {
      setIsSubmitting(false);
    }
    const shippingAddress = (result?.shipping_address ?? {}) as Record<string, any>;

    const created: Order = {
      id: result.id,
      reference: result.order_number,
      customer_name: shippingAddress["full_name"] || shippingAddress["name"] || customerName,
      customer_email: shippingAddress["email"] || draft.customer_email,
      customer_phone: shippingAddress["phone"] || shippingAddress["mobile"] || draft.customer_phone,
      address_line: shippingAddress["address_line"] || draft.address_line,
      city: shippingAddress["city"] || draft.city,
      status: (result.status as OrderStatus) || "pending",
      payment_method: result.payment_method || "cod",
      subtotal: result.subtotal ?? subtotal,
      shipping: result.shipping_amount ?? shipping,
      discount: result.discount_amount ?? couponDiscount,
      total: result.total ?? total,
      governorate: shippingAddress["governorate"] || shippingAddress["city"] || draft.governorate,
      created_at: result.created_at,
      items: selectedOrderItems.map((item) => ({
        id: `${result.id}-${item.product_id}`,
        product_id: item.product_id,
        variant_id: item.variant_id,
        name: item.name,
        sku: item.sku,
        variant_label: item.variant_label,
        image: item.image,
        unit_price: item.unit_price,
        quantity: item.quantity,
      })),
    };

    const wasEditing = Boolean(editingOrderId);
    setList((prev) => (wasEditing ? prev.map((p) => (p.id === created.id ? created : p)) : [created, ...prev]));
    setAddOpen(false);
    setCreateStep(1);
    setSelectedOrderItems([]);
    setDraft(emptyOrderDraft());
    setGovernorateSearch("");
    setEditingOrderId(null);
    toast.success(wasEditing ? `Commande ${created.reference} mise à jour.` : `Commande ${created.reference} créée.`);
  };

  const validateCoupon = async () => {
    const code = draft.coupon_code.trim().toUpperCase();
    if (!code) {
      toast.error("Saisis un code coupon.");
      setValidatedCoupon(null);
      return;
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, discount_type, discount_value, starts_at, expires_at, is_active")
      .eq("code", code)
      .maybeSingle();
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la vérification du coupon.");
      setValidatedCoupon(null);
      return;
    }
    if (!data) {
      toast.error("Coupon invalide.");
      setValidatedCoupon(null);
      return;
    }
    if (!data.is_active) {
      toast.error("Coupon désactivé.");
      setValidatedCoupon(null);
      return;
    }
    const now = new Date();
    if (data.starts_at && new Date(data.starts_at) > now) {
      toast.error("Coupon pas encore actif.");
      setValidatedCoupon(null);
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < now) {
      toast.error("Coupon expiré.");
      setValidatedCoupon(null);
      return;
    }
    toast.success(`Coupon valide — ${data.discount_type === 'percentage' ? Number(data.discount_value ?? 0) + '%' : formatPrice(Number(data.discount_value ?? 0))}`);
    setValidatedCoupon(data);
  };

  const summarySubtotal = selectedOrderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const summaryCoupon = validatedCoupon
    ? (validatedCoupon.discount_type === "percentage"
        ? Math.round(summarySubtotal * (Number(validatedCoupon.discount_value) / 100))
        : Number(validatedCoupon.discount_value ?? 0))
    : 0;
  const summaryShipping = shippingCost;
  const summaryTotal = summarySubtotal + summaryShipping - summaryCoupon;

  const escapeHtml = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return (
    <div className="space-y-6 bg-white">

      {/* HEADER — style moderne */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#123b25]">Gestion des commandes</h1>
            <p className="mt-1 text-sm text-gray-500">Consultez, gérez et suivez toutes les commandes de votre boutique.</p>
            <p className="mt-1 text-xs font-medium text-gray-400">{list.length} commande{list.length > 1 ? "s" : ""} au total</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportPDF(filtered)} className="h-10 gap-2 border-green-200 text-green-700 hover:bg-green-50">
            <Download className="h-4 w-4" /> Exporter PDF
          </Button>
          <Button
            onClick={() => { setEditingOrderId(null); setAddOpen(true); }}
            className="h-10 gap-2 bg-green-700 text-white shadow-sm hover:bg-green-800"
          >
            <Plus className="h-4 w-4" /> Nouvelle commande
          </Button>
        </div>
      </div>

      {/* FILTRES */}
      <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#123b25]">Filtres et recherche</h2>
            <p className="text-xs text-gray-500">Retrouvez rapidement une commande.</p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Référence, client ou gouvernorat..."
                className="h-10 border-green-200 bg-gray-50 pl-3 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>
            <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 w-full border-green-200 bg-gray-50 text-gray-600">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{(ORDER_STATUS_LABELS as any)[s] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Période :</span>
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Du</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-10 min-w-0 rounded-md border border-green-200 bg-gray-50 px-2 text-sm outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Au</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-10 min-w-0 rounded-md border border-green-200 bg-gray-50 px-2 text-sm outline-none focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </label>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <Trash2 className="h-4 w-4" />
                <span className="font-semibold">{selectedIds.length} commande(s) sélectionnée(s)</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" /> Supprimer la sélection
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#123b25]">Liste des commandes</h2>
            <p className="mt-1 text-xs text-gray-500">{filtered.length} résultat(s) correspondant à vos critères</p>
          </div>
          <div className="text-xs text-gray-400">Page {page} sur {Math.max(totalPages, 1)}</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50/50 hover:bg-green-50/50">
                <TableHead className="w-12 pl-5">
                  <Checkbox
                    aria-label="Sélectionner tout"
                    checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                    onCheckedChange={(v) => toggleSelectAll(Boolean(v))}
                    className="border-green-300 data-[state=checked]:bg-green-600"
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">Référence</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">Client</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">Gouvernorat</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">
                  <button
                    type="button"
                    onClick={() => { setSortDir((s) => (s === "asc" ? "desc" : "asc")); setDateSortDir(null); setPage(1); }}
                    className="inline-flex items-center gap-2 transition hover:text-green-900"
                  >
                    Total <SortArrow dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">Statut</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-green-700/80">
                  <button
                    type="button"
                    onClick={() => { setDateSortDir((current) => (current === "asc" ? "desc" : "asc")); setSortDir(null); setPage(1); }}
                    className="inline-flex items-center gap-2 transition hover:text-green-900"
                  >
                    Date <SortArrow dir={dateSortDir} ariaLabel="Trier par date" />
                  </button>
                </TableHead>
                <TableHead className="pr-5 text-right font-semibold text-green-700/80">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Spinner showLabel />
                      <span className="text-sm">Chargement des commandes...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                        <FileText className="h-7 w-7 text-gray-300" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#123b25]">Aucune commande trouvée</p>
                        <p className="mt-1 text-sm text-gray-500">Aucune commande ne correspond aux critères sélectionnés.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((o) => (
                  <TableRow key={o.id} className="group transition-colors hover:bg-green-50/30">
                    <TableCell className="pl-5">
                      <Checkbox
                        checked={selectedIds.includes(o.id)}
                        onCheckedChange={(v) => toggleSelect(o.id, Boolean(v))}
                        className="border-green-300 data-[state=checked]:bg-green-600"
                      />
                    </TableCell>
                    <TableCell><span className="whitespace-nowrap font-semibold text-green-700">{o.reference}</span></TableCell>
                    <TableCell>
                      <div className="flex min-w-[160px] items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{o.customer_name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{o.customer_phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><span className="whitespace-nowrap text-sm text-gray-500">{o.governorate || "—"}</span></TableCell>
                    <TableCell><span className="whitespace-nowrap font-semibold text-[#123b25]">{formatPrice(o.total)}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold", ORDER_STATUS_STYLES[o.status])}>
                          {(ORDER_STATUS_LABELS as any)[o.status] ?? o.status}
                        </span>
                        {o.status !== "delivered" && o.status !== "cancelled" && (
                          <Popover open={editingStatusId === o.id} onOpenChange={(open) => setEditingStatusId(open ? o.id : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Modifier le statut"
                                className="h-8 w-8 rounded-lg text-gray-400 opacity-60 transition hover:bg-green-50 hover:text-green-700 hover:opacity-100"
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 border-green-100 p-2">
                              <p className="px-2 pb-2 text-xs font-semibold text-gray-400">Changer le statut</p>
                              <div className="flex flex-col gap-1">
                                {statuses
                                  .filter((s) => s === o.status || (allowedTransitions[o.status] || []).includes(s))
                                  .map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      className={cn(
                                        "w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-green-50",
                                        s === o.status && "bg-green-50 font-semibold text-green-700",
                                      )}
                                      onClick={() => { requestStatusChange(o.id, s as OrderStatus); setEditingStatusId(null); }}
                                    >
                                      {(ORDER_STATUS_LABELS as any)[s] ?? s}
                                    </button>
                                  ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-sm text-gray-500">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDetail(o)}
                          aria-label="Voir les détails"
                          className="h-9 w-9 rounded-lg text-gray-400 transition hover:bg-green-50 hover:text-green-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => exportOrderPDF(o)}
                          aria-label="Télécharger le bon de commande"
                          className="h-9 w-9 rounded-lg text-gray-400 transition hover:bg-green-50 hover:text-green-700"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(o)}
                          aria-label="Éditer"
                          className="h-9 w-9 rounded-lg text-gray-400 transition hover:bg-green-50 hover:text-green-700"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                          onClick={() => setOrderToDelete(o.id)}
                          aria-label="Supprimer"
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
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-green-50/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Affichage{" "}
            <span className="font-semibold text-[#123b25]">
              {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}
              {"–"}
              {Math.min(page * pageSize, filtered.length)}
            </span>{" "}
            sur <span className="font-semibold text-[#123b25]">{filtered.length}</span> commande(s)
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationPrevious
                href="#"
                className={page === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                onClick={(event) => { event.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                aria-disabled={page === 1}
              />
              {(() => {
                const pages: number[] = [];
                const maxShown = 7;
                if (totalPages <= maxShown) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  const start = Math.max(1, page - 3);
                  const end = Math.min(totalPages, start + maxShown - 1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (end < totalPages) pages.push(totalPages);
                }
                return pages.map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      className={cn("cursor-pointer", p === page && "border-green-600 bg-green-50 text-green-700")}
                      onClick={(e) => { e.preventDefault(); setPage(p); }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ));
              })()}
              <PaginationNext
                href="#"
                className={page === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                onClick={(event) => { event.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                aria-disabled={page === totalPages}
              />
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* DIALOG AJOUT / ÉDITION — style moderne */}
      <Dialog open={addOpen} onOpenChange={(o) => {
        setAddOpen(o);
        if (!o) {
          setCreateStep(1);
          setSelectedOrderItems([]);
          setDraft(emptyOrderDraft());
          setGovernorateSearch("");
          setEditingOrderId(null);
        }
      }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-green-100">
          <DialogHeader>
            <DialogTitle className="text-[#123b25]">{editingOrderId ? `Éditer commande` : `Nouvelle commande`}</DialogTitle>
          </DialogHeader>

          {createStep === 1 && (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Input
                  id="order-customer_name"
                  value={draft.customer_name}
                  onChange={(e) => { setDraft({ ...draft, customer_name: e.target.value }); setOrderFieldErrors((errors) => ({ ...errors, customer_name: "" })); }}
                  placeholder="Nom et prénom"
                  className={orderFieldErrors["customer_name"] ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"}
                />
                {orderFieldErrors["customer_name"] && <p className="text-sm text-red-600">{orderFieldErrors["customer_name"]}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email client</Label>
                  <Input
                    type="email"
                    value={draft.customer_email}
                    onChange={(e) => setDraft({ ...draft, customer_email: e.target.value })}
                    placeholder="client@email.com"
                    className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    id="order-customer_phone"
                    value={draft.customer_phone}
                    onChange={(e) => { setDraft({ ...draft, customer_phone: e.target.value }); setOrderFieldErrors((errors) => ({ ...errors, customer_phone: "" })); }}
                    placeholder="+216 ..."
                    className={orderFieldErrors["customer_phone"] ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"}
                  />
                  {orderFieldErrors["customer_phone"] && <p className="text-sm text-red-600">{orderFieldErrors["customer_phone"]}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gouvernorat</Label>
                  <div className="relative">
                    <Input
                      id="order-governorate"
                      value={displayedGovernorateValue}
                      onFocus={() => setIsGovernorateMenuOpen(true)}
                      onBlur={() => window.setTimeout(() => setIsGovernorateMenuOpen(false), 120)}
                      onChange={(e) => {
                        setGovernorateSearch(e.target.value);
                        setDraft((d) => ({ ...d, governorate: "" }));
                        setOrderFieldErrors((errors) => ({ ...errors, governorate: "" }));
                        setIsGovernorateMenuOpen(true);
                      }}
                      placeholder="Rechercher un gouvernorat…"
                      className={orderFieldErrors["governorate"] ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"}
                    />
                    {isGovernorateMenuOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-green-100 bg-white shadow-md">
                        {filteredShippingRates.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">Aucun tarif trouvé.</div>
                        ) : (
                          filteredShippingRates.map((rate) => (
                            <button
                              type="button"
                              key={rate.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setDraft((d) => ({ ...d, governorate: rate.governorate }));
                                setGovernorateSearch(rate.governorate);
                                setIsGovernorateMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-green-50 ${draft.governorate === rate.governorate ? "bg-green-50 text-green-700" : "text-gray-700"}`}
                            >
                              <span className="truncate">{rate.governorate}</span>
                              <span className="shrink-0 text-xs text-gray-400">{formatPrice(rate.price)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {orderFieldErrors["governorate"] && <p className="text-sm text-red-600">{orderFieldErrors["governorate"]}</p>}
                  {selectedShippingRate && (
                    <p className="text-xs text-gray-500">Frais de livraison : {formatPrice(selectedShippingRate.price)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as OrderStatus })}>
                    <SelectTrigger className="border-green-200 bg-gray-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{(ORDER_STATUS_LABELS as any)[s] ?? s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Adresse de livraison</Label>
                  <Input
                    id="order-address_line"
                    value={draft.address_line}
                    onChange={(e) => { setDraft({ ...draft, address_line: e.target.value }); setOrderFieldErrors((errors) => ({ ...errors, address_line: "" })); }}
                    placeholder="Rue, numéro, bâtiment..."
                    className={orderFieldErrors["address_line"] ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"}
                  />
                  {orderFieldErrors["address_line"] && <p className="text-sm text-red-600">{orderFieldErrors["address_line"]}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    id="order-city"
                    value={draft.city}
                    onChange={(e) => { setDraft({ ...draft, city: e.target.value }); setOrderFieldErrors((errors) => ({ ...errors, city: "" })); }}
                    placeholder="Ville"
                    className={orderFieldErrors["city"] ? "border-red-500 focus-visible:ring-red-500" : "border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"}
                  />
                  {orderFieldErrors["city"] && <p className="text-sm text-red-600">{orderFieldErrors["city"]}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  rows={3}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="Indications de livraison, point de repère..."
                  className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                />
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <div className="relative">
                    <Input
                      value={displayedProductValue}
                      onFocus={() => setIsProductMenuOpen(true)}
                      onBlur={() => { window.setTimeout(() => setIsProductMenuOpen(false), 120); }}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setSelectedProductId("");
                        setSelectedVariantId("");
                        setIsProductMenuOpen(true);
                      }}
                      placeholder="Rechercher un produit"
                      className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                    />
                    {isProductMenuOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-green-100 bg-white shadow-md">
                        {filteredCatalogProducts.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">Aucun produit trouvé.</div>
                        ) : (
                          filteredCatalogProducts.map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setProductSearch(product.name);
                                setIsProductMenuOpen(false);
                                const firstVariant = product?.variants?.[0];
                                if (firstVariant) {
                                  setSelectedVariantId(firstVariant.id);
                                } else {
                                  setSelectedVariantId("");
                                }
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-green-50 ${selectedProductId === product.id ? "bg-green-50 text-green-700" : "text-gray-700"}`}
                            >
                              <span className="truncate">{product.name}</span>
                              {product.sku && (
                                <span className="shrink-0 text-xs text-gray-400">{product.sku}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    min={1}
                    max={availableStock || undefined}
                    value={selectedQty}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      setSelectedQty(v);
                    }}
                    className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                  />
                  <p className="text-xs text-gray-400">
                    {availableStock > 0 ? `En stock: ${availableStock}` : "Rupture de stock"}
                  </p>
                </div>
              </div>

              {selectedProduct && (
                <div className="flex items-center gap-3 rounded-lg border border-green-100 bg-green-50/30 p-3">
                  {selectedProduct.images?.find((image) => image.is_main)?.url ?? selectedProduct.images?.[0]?.url ? (
                    <img
                      src={selectedProduct.images?.find((image) => image.is_main)?.url ?? selectedProduct.images?.[0]?.url}
                      alt={selectedProduct.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#123b25]">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-500">
                      {selectedProduct.sku ? `${selectedProduct.sku} · ` : ""}{formatPrice(selectedProduct.price)}
                    </p>
                  </div>
                </div>
              )}

              {selectedProductVariants.length > 0 && (
                <div className="space-y-2 rounded-lg border border-green-100 p-3">
                  <p className="text-sm font-medium text-[#123b25]">Variantes</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProductVariants.map((variant) => {
                      const vStock = Number(variant.stock ?? 0);
                      const disabled = vStock <= 0;
                      return (
                        <button
                          type="button"
                          key={variant.id}
                          onClick={() => !disabled && setSelectedVariantId(variant.id)}
                          disabled={disabled}
                          className={`rounded-full border px-3 py-1.5 text-xs ${selectedVariantId === variant.id ? "border-green-600 bg-green-50 text-green-700" : "border-green-200 bg-white text-gray-700"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {getVariantLabel(selectedProduct, variant)}{disabled ? " — rupture" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-green-700 text-white hover:bg-green-800"
                  disabled={!selectedProduct}
                  onClick={() => {
                    if (!selectedProduct) return;
                    addOrderItem(selectedProduct);
                  }}
                >
                  Ajouter au panier
                </Button>
              </div>

              <div className="rounded-lg border border-green-100 p-3">
                <p className="mb-3 text-sm font-medium text-[#123b25]">Articles sélectionnés</p>
                {selectedOrderItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun article sélectionné.</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {selectedOrderItems.map((item) => (
                      <div key={`${item.product_id}-${item.variant_id ?? "base"}`} className="flex items-center justify-between gap-3 rounded-md bg-green-50/50 p-2">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-gray-100" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-[#123b25]">{item.name}</p>
                            {item.variant_label && (
                              <p className="text-xs text-gray-500">{item.variant_label}</p>
                            )}
                            {item.sku && (
                              <p className="text-xs text-gray-400">SKU : {item.sku}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" className="border-green-200" onClick={() => updateOrderItemQty(item.product_id, item.variant_id ?? null, -1)}>-</Button>
                          <span className="w-5 text-center text-sm">{item.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="border-green-200" onClick={() => updateOrderItemQty(item.product_id, item.variant_id ?? null, 1)}>+</Button>
                          <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeOrderItem(item.product_id, item.variant_id ?? null)}>
                            Retirer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {createStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-green-100 bg-green-50/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-[#123b25]">Données du client</span>
                  <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium", ORDER_STATUS_STYLES[draft.status])}>
                    {(ORDER_STATUS_LABELS as any)[draft.status] ?? draft.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-1"><span className="font-semibold text-gray-700">Nom:</span>&nbsp;{draft.customer_name || "—"}</p>
                <p className="text-sm text-gray-500 mb-1"><span className="font-semibold text-gray-700">Email:</span>&nbsp;{draft.customer_email || "—"}</p>
                <p className="text-sm text-gray-500 mb-1"><span className="font-semibold text-gray-700">Téléphone:</span>&nbsp;{draft.customer_phone || "—"}</p>
                <p className="text-sm text-gray-500 mb-1"><span className="font-semibold text-gray-700">Gouvernorat:</span>&nbsp;{draft.governorate || "—"}</p>
                {draft.address_line && <p className="text-sm text-gray-500 mb-1"><span className="font-semibold text-gray-700">Adresse:</span>&nbsp;{draft.address_line}</p>}

                <div className="mt-4">
                  <Label className="text-[#123b25]">Coupon</Label>
                  <div className="flex gap-2">
                    <Input
                      value={draft.coupon_code}
                      onChange={(e) => {
                        setDraft({ ...draft, coupon_code: e.target.value.toUpperCase() });
                        setValidatedCoupon(null);
                      }}
                      placeholder="EX: SAVE10"
                      className="border-green-200 bg-white focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    />
                    <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={validateCoupon}>Valider</Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-green-100 p-4">
                <p className="mb-3 font-semibold text-[#123b25]">Résumé</p>
                <div className="max-h-56 overflow-y-auto pr-1">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50/50">
                        <TableHead className="text-xs font-semibold uppercase text-green-700/70">Produit</TableHead>
                        <TableHead className="w-28 text-right text-xs font-semibold uppercase text-green-700/70">Prix/unité</TableHead>
                        <TableHead className="w-20 text-center text-xs font-semibold uppercase text-green-700/70">Quantité</TableHead>
                        <TableHead className="w-28 text-right text-xs font-semibold uppercase text-green-700/70">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrderItems.map((item) => (
                        <TableRow key={`${item.product_id}-${item.variant_id ?? "base"}`}>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="h-8 w-8 shrink-0 rounded object-cover" />
                              ) : (
                                <div className="h-8 w-8 shrink-0 rounded bg-gray-100" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#123b25]">{item.name}</p>
                                {item.variant_label && (
                                  <p className="text-xs text-gray-500">{item.variant_label}</p>
                                )}
                                {item.sku && (
                                  <p className="text-xs text-gray-400">SKU : {item.sku}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-28 text-right text-sm text-gray-500">{formatPrice(item.unit_price)}</TableCell>
                          <TableCell className="w-20 text-center">{item.quantity}</TableCell>
                          <TableCell className="w-28 text-right font-semibold text-[#123b25]">{formatPrice(item.unit_price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span className="text-[#123b25]">{formatPrice(summarySubtotal)}</span></div>
                  {summaryCoupon > 0 && (
                    <div className="flex justify-between text-green-700"><span>Coupon</span><span>-{formatPrice(summaryCoupon)}</span></div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Livraison{selectedShippingRate ? ` (${selectedShippingRate.governorate})` : ""}</span>
                    <span className="text-[#123b25]">{formatPrice(summaryShipping)}</span>
                  </div>
                  <div className="flex justify-between font-semibold"><span className="text-[#123b25]">Total</span><span className="text-[#123b25]">{formatPrice(summaryTotal)}</span></div>
                </div>
                {!selectedShippingRate && (
                  <p className="mt-2 text-xs text-red-600">
                    Aucun gouvernorat valide sélectionné : les frais de livraison ne sont pas calculés.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 border-t border-green-100 pt-4">
            {createStep === 1 && (
              <>
                <Button variant="outline" onClick={() => setAddOpen(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
                <Button
                  className="bg-green-700 text-white hover:bg-green-800"
                  onClick={() => {
                    if (!validateOrderAddress()) {
                      return;
                    }
                    setCreateStep(2);
                  }}
                >
                  Suivant
                </Button>
              </>
            )}

            {createStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setCreateStep(1)} className="border-gray-200 text-gray-600 hover:bg-gray-50">Retour</Button>
                <Button
                  className="bg-green-700 text-white hover:bg-green-800"
                  onClick={() => {
                    if (selectedOrderItems.length === 0) {
                      toast.error("Ajoute au moins un article.");
                      return;
                    }
                    setCreateStep(3);
                  }}
                >
                  Suivant
                </Button>
              </>
            )}

            {createStep === 3 && (
              <>
                <Button variant="outline" onClick={() => setCreateStep(2)} disabled={isSubmitting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Retour</Button>
                <Button
                  className="bg-green-700 text-white hover:bg-green-800"
                  onClick={createOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" /> {editingOrderId ? "Modification..." : "Création..."}
                    </span>
                  ) : (
                    editingOrderId ? "Modifier" : "Créer"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGS SUPPRESSION */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm border-green-100">
          <DialogHeader>
            <DialogTitle className="text-[#123b25]">Supprimer les commandes sélectionnées</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-500">
            Êtes-vous sûr de vouloir supprimer <strong>{selectedIds.length}</strong> commande(s) ? Cette action est irréversible.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button
              onClick={async () => { await deleteSelectedOrders(); setBulkDeleteOpen(false); }}
              disabled={isBulkDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isBulkDeleting ? (
                <span className="flex items-center gap-2"><Spinner className="h-4 w-4" /> Suppression...</span>
              ) : ("Supprimer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderToDelete !== null} onOpenChange={(o) => { if (!o) setOrderToDelete(null); }}>
        <DialogContent className="max-w-sm border-green-100">
          <DialogHeader>
            <DialogTitle className="text-[#123b25]">Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-500">Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderToDelete(null)} disabled={isDeleting} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button
              onClick={async () => {
                if (!orderToDelete) return;
                await deleteOrder(orderToDelete);
                setOrderToDelete(null);
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2"><Spinner className="h-4 w-4" /> Suppression...</span>
              ) : ("Supprimer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DÉTAIL */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden border-green-100 pb-0">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle className="text-[#123b25]">Commande {detail?.reference}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Tabs defaultValue="details" className="space-y-2">
                <TabsList className="w-full bg-gray-100">
                  <TabsTrigger value="details" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-green-700">Détails</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-green-700">Suivi</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4">
                  <p className="text-sm text-gray-500">Passée le : {detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR") : "Date non renseignée"}</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <p className="font-semibold text-[#123b25]">{detail.customer_name || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-500">{detail.customer_phone || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-500">{detail.customer_email || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-500">
                          {[
                            detail.address_line,
                            [detail.postal_code, detail.city].filter(Boolean).join(" "),
                            detail.governorate,
                          ].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      {detail.notes ? (
                        <div className="mt-2 flex items-start gap-2">
                          <FileText className="mt-1 h-4 w-4 text-gray-400" />
                          <p className="text-sm italic text-gray-500">{detail.notes}</p>
                        </div>
                      ) : null}
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", ORDER_STATUS_STYLES[detail.status])}>
                      {(ORDER_STATUS_LABELS as any)[detail.status] ?? detail.status}
                    </span>
                  </div>

                  <ul className="space-y-3 border-t border-gray-100 pt-4">
                    {detail.items.map((item: OrderItem) => (
                      <li key={item.id} className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-12 w-12 rounded-md border border-green-100 object-cover" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-md border border-green-100 bg-gray-50" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#123b25]">{item.name}</p>
                          {item.variant_label && <p className="text-xs text-gray-500">{item.variant_label}</p>}
                          {item.sku && <p className="text-xs text-gray-400">SKU : {item.sku}</p>}
                        </div>
                        <span className="text-sm text-gray-500">×{item.quantity}</span>
                        <span className="text-sm font-semibold text-[#123b25]">{formatPrice(item.unit_price * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>

                  <dl className="space-y-1 border-t border-gray-100 pt-4 text-sm">
                    <div className="flex justify-between"><dt className="text-gray-500">Sous-total</dt><dd className="text-[#123b25]">{formatPrice(detail.subtotal)}</dd></div>
                    {detail.discount > 0 && (
                      <div className="flex justify-between text-green-700"><dt>Remise</dt><dd>-{formatPrice(detail.discount)}</dd></div>
                    )}
                    <div className="flex justify-between"><dt className="text-gray-500">Livraison</dt><dd className="text-[#123b25]">{formatPrice(detail.shipping)}</dd></div>
                    <div className="flex justify-between font-bold"><dt className="text-[#123b25]">Total (COD)</dt><dd className="text-[#123b25]">{formatPrice(detail.total)}</dd></div>
                  </dl>
                </TabsContent>
                <TabsContent value="history">
                  <OrderStatusTimeline orderId={detail.id} className="border-t-0 pt-2" />
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter className="shrink-0 -mx-6 mt-4 border-t border-green-100 bg-green-50/30 px-6 py-3">
            {detail && (
              <div className="flex w-full items-end gap-3">
                {detail.status !== "delivered" && detail.status !== "cancelled" && (
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-sm font-medium text-[#123b25]">Changer le statut</p>
                    <Select value={detail.status} onValueChange={(v) => requestStatusChange(detail.id, v as OrderStatus)}>
                      <SelectTrigger className="h-8 w-full border-green-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses
                          .filter((s) => s === detail.status || (allowedTransitions[detail.status] || []).includes(s))
                          .map((s) => (
                            <SelectItem key={s} value={s}>{(ORDER_STATUS_LABELS as any)[s] ?? s}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => {
                    openEdit(detail);
                    setDetail(null);
                  }}
                  aria-label="Modifier la commande"
                >
                  <Edit2 className="h-4 w-4" /> Modifier
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG MOTIF ANNULATION */}
      <Dialog open={statusNoteOpen} onOpenChange={(open) => {
        setStatusNoteOpen(open);
        if (!open) {
          setPendingStatusChange(null);
          setStatusNote("");
        }
      }}>
        <DialogContent className="max-w-md border-green-100">
          <DialogHeader>
            <DialogTitle className="text-[#123b25]">Cause de l'annulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Sélectionnez une cause ou écrivez une note personnalisée.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal border-gray-200 text-left text-gray-600 hover:bg-gray-50"
                onClick={() => setStatusNote("Annulation demandée par le client.")}
              >
                Annulation demandée par le client
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal border-gray-200 text-left text-gray-600 hover:bg-gray-50"
                onClick={() => setStatusNote("Le client ne répond pas au téléphone lors de la confirmation.")}
              >
                Client ne répond pas au téléphone lors de la confirmation
              </Button>
            </div>
            <Textarea
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              placeholder="Indiquez la cause de l'annulation"
              rows={4}
              className="border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusNoteOpen(false)} className="border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
            <Button
              className="bg-green-700 text-white hover:bg-green-800"
              onClick={submitStatusChange}
              disabled={!pendingStatusChange || !statusNote.trim()}
            >
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}