import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Images,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Search,
  Package,
  Check,
  X,
  Upload,
  RefreshCw,
  LayoutGrid,
  Link2,
  Image as ImageIcon,
  Video,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { uploadToBucket } from "@/lib/storage";
import type { Database } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import Spinner from "@/components/ui/spinner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/admin/banners")({
  component: AdminBanners,
});

type BannerRow = Database["public"]["Tables"]["banners"]["Row"];

type BannerDraft = Partial<BannerRow> & {
  product_ids?: string[];
  media_type?: "image" | "video";
};

const bannerLink = (bannerId: string | null | undefined) =>
  bannerId ? `/banniere/${bannerId}` : "";

const emptyBanner: BannerDraft = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  media_type: "image",
  is_active: true,
  product_ids: [],
};

function AdminBanners() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<BannerDraft | null>(null);

  const [products, setProducts] = useState<
    { id: string; sku: string | null; slug: string | null }[]
  >([]);

  const [productSearch, setProductSearch] = useState("");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedBanners = useMemo(
    () => [...banners].sort((a, b) => a.position - b.position),
    [banners]
  );

  const activeCount = useMemo(
    () => banners.filter((banner) => banner.is_active).length,
    [banners]
  );

  const inactiveCount = banners.length - activeCount;

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return products.filter((product) =>
      (product.sku ?? "").toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  const load = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;

      setBanners(data ?? []);

      const { data: productRows, error: productsError } = await supabase
        .from("products")
        .select("id,sku,slug")
        .eq("is_active", true)
        .order("sku")
        .limit(30);

      if (productsError) throw productsError;

      setProducts(productRows ?? []);
    } catch (err) {
      console.error("load banners", err);
      toast.error("Impossible de charger les bannières.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveBannerProducts = async (
    bannerId: string,
    productIds: string[]
  ) => {
    const bannerProducts = supabase.from("banner_products" as never) as any;

    const { error: deleteError } = await bannerProducts
      .delete()
      .eq("banner_id", bannerId);

    if (deleteError) throw deleteError;

    if (productIds.length === 0) return;

    const { error: insertError } = await bannerProducts.insert(
      productIds.map((productId, position) => ({
        banner_id: bannerId,
        product_id: productId,
        position,
      }))
    );

    if (insertError) throw insertError;
  };

  // ENREGISTRER UNE BANNIÈRE
  const save = async () => {
    if (!draft) return;

    if (!draft.image_url) {
      toast.error(
        draft.media_type === "video"
          ? "Ajoutez une vidéo pour la bannière."
          : "Ajoutez une image pour la bannière."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: draft.title?.trim() || null,
        subtitle: draft.subtitle?.trim() || null,
        image_url: draft.image_url,
        media_type: draft.media_type ?? "image",
        is_active: draft.is_active ?? true,
      };

      if (draft.id) {
        const { error } = await supabase
          .from("banners")
          .update({
            ...payload,
            link_url: bannerLink(draft.id),
          })
          .eq("id", draft.id);

        if (error) throw error;

        await saveBannerProducts(draft.id, draft.product_ids ?? []);

        toast.success("Bannière mise à jour.");
      } else {
        const { data: created, error } = await supabase
          .from("banners")
          .insert({
            ...payload,
            link_url: null,
            position: banners.length,
          })
          .select("id")
          .single();

        if (error) throw error;

        const { error: linkError } = await supabase
          .from("banners")
          .update({ link_url: bannerLink(created.id) })
          .eq("id", created.id);

        if (linkError) throw linkError;

        await saveBannerProducts(created.id, draft.product_ids ?? []);

        toast.success("Bannière créée.");
      }

      setDraft(null);
      await load();
    } catch (err) {
      console.error("save banner", err);
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // OUVRIR UNE BANNIÈRE
  const openBanner = async (banner: BannerRow | typeof emptyBanner) => {
    setProductSearch("");

    if (!("id" in banner) || !banner.id) {
      setDraft({
        ...banner,
        media_type: banner.media_type ?? "image",
        product_ids: [],
      });

      return;
    }

    const bannerProducts = supabase.from("banner_products" as never) as any;

    const { data, error } = await bannerProducts
      .select("product_id")
      .eq("banner_id", banner.id)
      .order("position");

    if (error) {
      console.error("load banner products", error);
      toast.error("Impossible de charger les produits associés.");
      return;
    }

    setDraft({
      ...banner,
      media_type: banner.media_type ?? "image",
      product_ids: (data ?? []).map(
        (row: { product_id: string }) => row.product_id
      ),
    });
  };

  // TÉLÉCHARGER UNE IMAGE OU UNE VIDÉO
  const handleUpload = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Sélectionnez une image ou une vidéo valide.");
      return;
    }

    const maxSize = isVideo
      ? 100 * 1024 * 1024
      : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error(
        isVideo
          ? "La vidéo ne doit pas dépasser 100 Mo."
          : "L'image ne doit pas dépasser 10 Mo."
      );
      return;
    }

    setUploading(true);

    try {
      const safeName = file.name
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const path = `${Date.now()}-${safeName}`;

      const publicUrl = await uploadToBucket("banners", path, file);

      setDraft((current) =>
        current
          ? {
              ...current,
              image_url: publicUrl,
              media_type: isVideo ? "video" : "image",
            }
          : current
      );

      toast.success(
        isVideo
          ? "Vidéo téléchargée avec succès."
          : "Image téléchargée avec succès."
      );
    } catch (err) {
      console.error("upload banner media", err);
      toast.error("Échec du téléchargement du média.");
    } finally {
      setUploading(false);
    }
  };

  // ACTIVER / DÉSACTIVER
  const toggleActive = async (banner: BannerRow) => {
    const next = !banner.is_active;

    setBanners((prev) =>
      prev.map((b) =>
        b.id === banner.id ? { ...b, is_active: next } : b
      )
    );

    const { error } = await supabase
      .from("banners")
      .update({ is_active: next })
      .eq("id", banner.id);

    if (error) {
      console.error("toggle banner", error);

      setBanners((prev) =>
        prev.map((b) =>
          b.id === banner.id
            ? { ...b, is_active: banner.is_active }
            : b
        )
      );

      toast.error("Impossible de changer le statut.");
    } else {
      toast.success(
        next ? "Bannière activée." : "Bannière désactivée."
      );
    }
  };

  // CHANGER L'ORDRE
  const move = async (banner: BannerRow, direction: -1 | 1) => {
    const sorted = [...banners].sort(
      (a, b) => a.position - b.position
    );

    const idx = sorted.findIndex((b) => b.id === banner.id);
    const swapWith = sorted[idx + direction];

    if (!swapWith) return;

    try {
      const { error: firstError } = await supabase
        .from("banners")
        .update({ position: swapWith.position })
        .eq("id", banner.id);

      if (firstError) throw firstError;

      const { error: secondError } = await supabase
        .from("banners")
        .update({ position: banner.position })
        .eq("id", swapWith.id);

      if (secondError) throw secondError;

      await load();

      toast.success("Ordre des bannières mis à jour.");
    } catch (err) {
      console.error("reorder banner", err);
      toast.error("Impossible de réordonner.");
    }
  };

  // SUPPRIMER
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("banners")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBanners((prev) => prev.filter((b) => b.id !== id));

      toast.success("Bannière supprimée.");
    } catch (err) {
      console.error("delete banner", err);
      toast.error("Impossible de supprimer la bannière.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // SÉLECTIONNER UN PRODUIT
  const toggleProduct = (productId: string, checked: boolean) => {
    if (!draft) return;

    setDraft((current) => {
      if (!current) return current;

      const currentIds = current.product_ids ?? [];

      return {
        ...current,
        product_ids: checked
          ? [...new Set([...currentIds, productId])]
          : currentIds.filter((id) => id !== productId),
      };
    });
  };

  return (
    <div className="min-h-full space-y-7 bg-white pb-8">

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700">
            <Images className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#123b25] sm:text-3xl">
                Gestion des bannières
              </h1>

              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                Accueil
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Gérez les images et vidéos du carrousel affiché en haut de votre boutique.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-green-200 text-green-700 hover:bg-green-50"
            onClick={load}
            disabled={loading}
            title="Actualiser"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>

          <Button
            className="h-10 rounded-xl bg-green-700 px-4 text-white shadow-sm hover:bg-green-800"
            onClick={() => {
              setProductSearch("");
              setDraft({ ...emptyBanner, product_ids: [] });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle bannière
          </Button>
        </div>
      </div>

      {/* STATISTIQUES */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total des bannières
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[#123b25]">
                {banners.length}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Bannières enregistrées
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <LayoutGrid className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Bannières actives
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-green-700">
                {activeCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Visibles sur la boutique
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <Eye className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Bannières inactives
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-400">
                {inactiveCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Masquées de la boutique
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <EyeOff className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* TITRE SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#123b25]">
            Vos bannières
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Organisez leur ordre d'affichage et gérez leur visibilité.
          </p>
        </div>

        {banners.length > 0 && (
          <span className="rounded-lg border border-green-100 bg-white px-3 py-1.5 text-xs font-medium text-gray-500">
            {banners.length} élément{banners.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* LISTE DES BANNIÈRES */}
      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-green-100 bg-white">
          <Spinner showLabel />
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-green-200 bg-white px-5 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-700">
            <ImageIcon className="h-8 w-8" />
          </div>

          <h3 className="text-lg font-bold text-[#123b25]">
            Aucune bannière pour le moment
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
            Créez votre première bannière pour mettre en avant vos collections,
            vos nouveautés ou vos offres sur la page d'accueil.
          </p>

          <Button
            className="mt-6 rounded-xl bg-green-700 text-white hover:bg-green-800"
            onClick={() => {
              setProductSearch("");
              setDraft({ ...emptyBanner, product_ids: [] });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Créer ma première bannière
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedBanners.map((banner, idx) => (
            <div
              key={banner.id}
              className="group overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative overflow-hidden bg-gray-100">

                {banner.media_type === "video" ? (
                  <video
                    src={banner.image_url}
                    muted
                    autoPlay
                    loop
                    playsInline
                    preload="metadata"
                    className="aspect-[21/9] w-full object-contain"
                  />
                ) : (
                  <img
                    src={banner.image_url}
                    alt={banner.title ?? "Bannière"}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[21/9] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                )}

                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-lg border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    #{idx + 1}
                  </span>

                  <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${
                    banner.is_active
                      ? "bg-green-600/90 text-white"
                      : "bg-black/60 text-white"
                  }`}>
                    {banner.is_active ? "Active" : "Inactive"}
                  </span>

                  <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    {banner.media_type === "video" ? (
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        Vidéo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        Image
                      </span>
                    )}
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => move(banner, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Monter"
                    title="Monter"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={idx === sortedBanners.length - 1}
                    onClick={() => move(banner, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Descendre"
                    title="Descendre"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="min-h-[58px]">
                  <h3 className="line-clamp-1 font-bold text-[#123b25]">
                    {banner.title || "(Sans titre)"}
                  </h3>

                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {banner.subtitle || "Aucun sous-titre renseigné."}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => toggleActive(banner)}
                    />

                    <div>
                      <p className="text-sm font-medium text-[#123b25]">
                        {banner.is_active ? "Activée" : "Désactivée"}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Visibilité boutique
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-green-200 text-green-700 hover:bg-green-50"
                      onClick={() => openBanner(banner)}
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-red-100 text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDeleteId(banner.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG CRÉATION / MODIFICATION */}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) =>
          !open && !saving && !uploading && setDraft(null)
        }
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[620px]">
          <div className="border-b border-green-100 bg-green-50/50 px-6 py-5">
            <DialogHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
                {draft?.id ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </div>

              <DialogTitle className="text-xl font-bold text-[#123b25]">
                {draft?.id ? "Modifier la bannière" : "Nouvelle bannière"}
              </DialogTitle>

              <DialogDescription className="mt-1 text-gray-500">
                Personnalisez le visuel et les produits affichés sur cette bannière.
              </DialogDescription>
            </DialogHeader>
          </div>

          {draft && (
            <div className="space-y-6 px-6 py-5">

              {/* SÉLECTION IMAGE OU VIDÉO */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-[#123b25]">
                    Média de la bannière
                  </Label>
                  <span className="text-xs text-gray-400">Obligatoire</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        media_type: "image",
                        image_url: "",
                      })
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                      (draft.media_type ?? "image") === "image"
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <ImageIcon className="h-5 w-5" />
                    Image
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        media_type: "video",
                        image_url: "",
                      })
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                      draft.media_type === "video"
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Video className="h-5 w-5" />
                    Vidéo
                  </button>
                </div>

                {/* ZONE DE SÉLECTION ET APERÇU */}
                <label
                  className={`group relative flex min-h-[190px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                    draft.image_url
                      ? "border-green-100 bg-gray-50"
                      : "border-green-200 bg-green-50/30 hover:border-green-400 hover:bg-green-50/50"
                  }`}
                >
                  {draft.image_url ? (
                    <>
                      {draft.media_type === "video" ? (
                        <video
                          src={draft.image_url}
                          controls
                          muted
                          playsInline
                          className="absolute inset-0 h-full w-full bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={draft.image_url}
                          alt="Aperçu de la bannière"
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      )}

                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Upload className="h-7 w-7 text-white" />
                        <span className="mt-2 text-sm font-semibold text-white">
                          Remplacer le média
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                        {draft.media_type === "video" ? (
                          <Video className="h-6 w-6" />
                        ) : (
                          <ImagePlus className="h-6 w-6" />
                        )}
                      </div>

                      <p className="text-sm font-semibold text-[#123b25]">
                        Cliquez pour ajouter{" "}
                        {draft.media_type === "video"
                          ? "une vidéo"
                          : "une image"}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {draft.media_type === "video"
                          ? "MP4, WebM — maximum 100 Mo"
                          : "Formats image acceptés — maximum 10 Mo"}
                      </p>
                    </>
                  )}

                  {uploading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85">
                      <Spinner />
                      <p className="mt-2 text-sm font-medium text-gray-600">
                        Téléchargement en cours...
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept={
                      draft.media_type === "video"
                        ? "video/mp4,video/webm"
                        : "image/*"
                    }
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) handleUpload(file);

                      e.target.value = "";
                    }}
                  />
                </label>

                <p className="text-xs text-gray-400">
                  {draft.media_type === "video"
                    ? "Privilégiez une vidéo horizontale, courte et optimisée. Elle sera configurée pour une lecture automatique sur la page d'accueil."
                    : "Utilisez une image horizontale pour un meilleur rendu dans le carrousel."}
                </p>
              </div>

              {/* TITRE */}
              <div className="space-y-2">
                <Label
                  htmlFor="banner-title"
                  className="font-semibold text-[#123b25]"
                >
                  Titre{" "}
                  <span className="ml-1 font-normal text-gray-400">
                    (optionnel)
                  </span>
                </Label>

                <Input
                  id="banner-title"
                  value={draft.title ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Ex. : Nouvelle collection"
                  className="h-11 rounded-xl border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* SOUS-TITRE */}
              <div className="space-y-2">
                <Label
                  htmlFor="banner-subtitle"
                  className="font-semibold text-[#123b25]"
                >
                  Sous-titre{" "}
                  <span className="ml-1 font-normal text-gray-400">
                    (optionnel)
                  </span>
                </Label>

                <Input
                  id="banner-subtitle"
                  value={draft.subtitle ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, subtitle: e.target.value })
                  }
                  placeholder="Ex. : Découvrez nos dernières nouveautés"
                  className="h-11 rounded-xl border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* LIEN AUTOMATIQUE */}
              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/50 p-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <Link2 className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#123b25]">
                    Lien automatique
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Un clic sur la bannière ouvre sa page dédiée, qui affiche les produits associés ci-dessous.
                  </p>
                </div>
              </div>

              {/* PRODUITS ASSOCIÉS */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="font-semibold text-[#123b25]">
                      Produits associés
                    </Label>
                    <p className="mt-1 text-xs text-gray-500">
                      Sélectionnez les produits de cette bannière.
                    </p>
                  </div>

                  <span className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {draft.product_ids?.length ?? 0} sélectionné
                    {(draft.product_ids?.length ?? 0) > 1 ? "s" : ""}
                  </span>
                </div>

                <Popover
                  open={productSelectOpen}
                  onOpenChange={setProductSelectOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-between rounded-xl border-green-200 font-normal text-gray-600 hover:bg-green-50"
                    >
                      <span className="flex items-center gap-2 text-gray-500">
                        <Package className="h-4 w-4" />
                        {draft.product_ids?.length
                          ? `${draft.product_ids.length} produit(s) sélectionné(s)`
                          : "Sélectionner des produits"}
                      </span>

                      <Plus className="h-4 w-4 text-gray-400" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] rounded-xl border-green-100 p-3"
                    align="start"
                  >
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Rechercher par SKU..."
                        className="h-10 rounded-lg border-green-200 bg-gray-50 pl-9 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                        autoFocus
                      />
                    </div>

                    <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="py-7 text-center">
                          <Package className="mx-auto h-7 w-7 text-gray-300" />
                          <p className="mt-2 text-sm text-gray-400">
                            Aucun produit actif trouvé.
                          </p>
                        </div>
                      ) : (
                        filteredProducts.map((product) => {
                          const checked =
                            draft.product_ids?.includes(product.id) ?? false;

                          return (
                            <label
                              key={product.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-green-50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  toggleProduct(product.id, value === true)
                                }
                                className="border-green-300 data-[state=checked]:bg-green-600"
                              />

                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                                {product.sku || "SKU non défini"}
                              </span>

                              {checked && (
                                <Check className="h-4 w-4 shrink-0 text-green-600" />
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-green-100 pt-2">
                      <span className="text-xs text-gray-400">
                        {filteredProducts.length} produit(s)
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-green-700 hover:bg-green-50"
                        onClick={() => setProductSelectOpen(false)}
                      >
                        Terminer
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {!!draft.product_ids?.length && (
                  <div className="flex flex-wrap gap-2">
                    {draft.product_ids.map((productId) => {
                      const product = products.find(
                        (item) => item.id === productId
                      );

                      return (
                        <span
                          key={productId}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700"
                        >
                          <Package className="h-3 w-3 shrink-0" />

                          <span className="max-w-[150px] truncate">
                            {product?.sku || "Produit sélectionné"}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleProduct(productId, false)}
                            className="ml-1 rounded p-0.5 hover:bg-green-100"
                            aria-label="Retirer ce produit"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STATUT ACTIF */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-green-100 bg-green-50/30 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      draft.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {draft.is_active ? (
                      <Eye className="h-5 w-5" />
                    ) : (
                      <EyeOff className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#123b25]">
                      Bannière active
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {draft.is_active
                        ? "Visible sur la boutique"
                        : "Masquée de la boutique"}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={draft.is_active ?? true}
                  onCheckedChange={(value) =>
                    setDraft({ ...draft, is_active: value })
                  }
                />
              </div>
            </div>
          )}

          {/* FOOTER */}
          <DialogFooter className="sticky bottom-0 border-t border-green-100 bg-white px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setDraft(null)}
              disabled={saving || uploading}
            >
              Annuler
            </Button>

            <Button
              className="min-w-[140px] rounded-xl bg-green-700 text-white hover:bg-green-800"
              onClick={save}
              disabled={saving || uploading}
            >
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION SUPPRESSION */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-[420px] rounded-2xl border-green-100">
          <DialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>

            <DialogTitle className="text-lg font-bold text-[#123b25]">
              Supprimer cette bannière ?
            </DialogTitle>

            <DialogDescription className="leading-6 text-gray-500">
              Cette action est irréversible. La bannière sera supprimée de votre carrousel.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-3 gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setConfirmDeleteId(null)}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={() =>
                confirmDeleteId && handleDelete(confirmDeleteId)
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
