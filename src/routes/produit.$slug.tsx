import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { useEffect, useMemo, useState } from "react";

import {
  Check,
  Heart,
  Maximize2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  ChevronRight,
  MessageCircle,
  Sparkles,
  RotateCcw,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { Stars } from "@/components/store/Stars";
import { categoryPath } from "@/data/categories";
import {
  fetchActiveProducts,
  fetchCategories,
  fetchProductBySlug,
} from "@/lib/catalog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/placeholder";
import { useStore } from "@/context/StoreContext";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/ui/rich-text";

type LiveReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  user_id: string | null;
  is_approved: boolean | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type ReviewProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
          aria-pressed={i <= value}
          onClick={() => onChange(i)}
          className="rounded-md p-1 transition hover:scale-110"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              i <= value
                ? "fill-warning text-warning"
                : "text-muted-foreground/30 hover:text-warning",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function getVariantOption(
  variant: Product["variants"][number],
  attribute: Product["attributes"][number],
): string | undefined {
  return variant.options?.[attribute.id] ?? variant.options?.[attribute.code];
}

function ProductPage() {
  const { product } = Route.useLoaderData();

  const { addItem, toggleWishlist, isWishlisted } = useStore();
  const { user, openAuth } = useAuth();

  // =========================================================
  // INITIALISATION DES VARIANTES
  // =========================================================

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const firstAvailableVariant =
      product.variants.find((item) => item.stock > 0) ?? product.variants[0];

    product.attributes.forEach((attribute) => {
      const variantValue = firstAvailableVariant
        ? getVariantOption(firstAvailableVariant, attribute)
        : undefined;
      const firstValue = attribute.values[0]?.id;
      const selectedValue = attribute.values.some(
        (value) => value.id === variantValue,
      ) ? variantValue : firstValue;

      if (selectedValue) initial[attribute.code] = selectedValue;
    });

    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);

  // =========================================================
  // STOCK EN TEMPS RÉEL
  // =========================================================

  const [liveProductStock, setLiveProductStock] = useState(
    product.stock,
  );

  const [liveVariantStocks, setLiveVariantStocks] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      product.variants.map((variant) => [
        variant.id,
        variant.stock,
      ]),
    ),
  );

  useEffect(() => {
    const channel = supabase
      .channel(`product-stock-${product.id}`)

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `id=eq.${product.id}`,
        },
        (payload) => {
          const row = payload.new as {
            stock_quantity?: number | null;
          };

          setLiveProductStock(
            Number(row.stock_quantity ?? 0),
          );
        },
      )

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "product_variants",
          filter: `product_id=eq.${product.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            stock_quantity?: number | null;
          };

          if (!row.id) return;

          setLiveVariantStocks((previous) => ({
            ...previous,
            [row.id!]: Number(row.stock_quantity ?? 0),
          }));
        },
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [product.id]);

  // =========================================================
  // VALIDATION DES OPTIONS
  // =========================================================

  const isOptionAvailable = (
    attributeCode: string,
    valueId: string,
  ): boolean => {
    if (product.variants.length === 0) return true;

    const attribute = product.attributes.find(
      (item) => item.code === attributeCode || item.id === attributeCode,
    );
    if (!attribute) return false;

    return product.variants.some((item) => {
      const currentStock = liveVariantStocks[item.id] ?? item.stock;
      return getVariantOption(item, attribute) === valueId && currentStock > 0;
    });
  };

  const handleAttributeChange = (attributeCode: string, valueId: string) => {
    const changedAttribute = product.attributes.find(
      (item) => item.code === attributeCode || item.id === attributeCode,
    );
    if (!changedAttribute) return;

    const candidates = product.variants.filter((item) => {
      const currentStock = liveVariantStocks[item.id] ?? item.stock;
      return getVariantOption(item, changedAttribute) === valueId && currentStock > 0;
    });
    if (candidates.length === 0) return;

    setSelection((previous) => {
      const score = (item: Product["variants"][number]) =>
        product.attributes.reduce((total, attribute) => {
          if (attribute.id === changedAttribute.id) return total;
          const selected = previous[attribute.code];
          return selected && getVariantOption(item, attribute) === selected
            ? total + 1
            : total;
        }, 0);

      const bestVariant = candidates.reduce((best, candidate) =>
        score(candidate) > score(best) ? candidate : best,
      );

      const next = { ...previous };
      product.attributes.forEach((attribute) => {
        const optionValue = getVariantOption(bestVariant, attribute);
        if (optionValue) next[attribute.code] = optionValue;
      });
      return next;
    });
  };

  // =========================================================
  // VARIANTE SÉLECTIONNÉE
  // =========================================================

  const variant = useMemo(() => {
    if (product.variants.length === 0) {
      return null;
    }

    const allSelected = product.attributes.every(
      (attr) => Boolean(selection[attr.code]),
    );

    if (!allSelected) {
      return null;
    }

    return (
      product.variants.find((item) =>
        product.attributes.every(
          (attribute) =>
            getVariantOption(item, attribute) === selection[attribute.code],
        ),
      ) ?? null
    );
  }, [
    product.variants,
    product.attributes,
    selection,
  ]);

  const hasValidVariant =
    product.variants.length === 0 || variant !== null;

  // =========================================================
  // PRIX ET STOCK
  // =========================================================

  const price = variant?.price ?? product.price;

  const compareAt =
    variant?.compare_at_price ??
    product.compare_at_price;

  const stock = variant
    ? liveVariantStocks[variant.id] ?? variant.stock
    : liveProductStock;

  const onSale =
    compareAt !== null && compareAt > price;

  const discount = onSale
    ? Math.round(
        ((compareAt! - price) / compareAt!) * 100,
      )
    : 0;

  const variantLabel = product.attributes
    .map((attr) =>
      attr.values.find(
        (value) => value.id === selection[attr.code],
      )?.label,
    )
    .filter(Boolean)
    .join(" / ");

  // Réinitialiser la quantité lorsque le stock change.
  useEffect(() => {
    setQuantity(1);
  }, [variant?.id, stock]);

  // =========================================================
  // GALERIE
  // =========================================================

  const gallery = product.images;

  const mainImageIndex = () => {
    const index = gallery.findIndex(
      (image) => image.is_main,
    );

    return index >= 0 ? index : 0;
  };

  const [activeImage, setActiveImage] = useState(
    mainImageIndex,
  );

  useEffect(() => {
    const selectedValueIds = Object.values(selection);

    const matchIndex = gallery.findIndex(
      (image) =>
        image.variant_value &&
        selectedValueIds.includes(image.variant_value),
    );

    setActiveImage(
      matchIndex >= 0 ? matchIndex : mainImageIndex(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, gallery]);

  const currentImage =
    gallery[Math.min(activeImage, gallery.length - 1)];

  // =========================================================
  // CATÉGORIES ET PRODUITS SIMILAIRES
  // =========================================================

  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof fetchCategories>>
  >([]);

  const [related, setRelated] = useState<Product[]>([]);

  useEffect(() => {
    let mounted = true;

    fetchCategories()
      .then((data) => {
        if (mounted) {
          setCategories(data);
        }
      })
      .catch((error) =>
        console.error("load categories", error),
      );

    return () => {
      mounted = false;
    };
  }, []);

  const path = useMemo(
    () =>
      product.category_id
        ? categoryPath(product.category_id, categories)
        : [],
    [product.category_id, categories],
  );

  useEffect(() => {
    let mounted = true;

    if (!product.category_id) {
      setRelated([]);
      return;
    }

    fetchActiveProducts()
      .then((data) => {
        if (!mounted) return;

        setRelated(
          data
            .filter(
              (item) =>
                item.id !== product.id &&
                item.category_id === product.category_id,
            )
            .slice(0, 4),
        );
      })
      .catch((error) =>
        console.error("load related products", error),
      );

    return () => {
      mounted = false;
    };
  }, [product.id, product.category_id]);

  // =========================================================
  // AVIS CLIENTS
  // =========================================================

  const [productReviews, setProductReviews] = useState<
    LiveReview[]
  >([]);

  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");

  const [submittingReview, setSubmittingReview] =
    useState(false);

  const [visibleReviewCount, setVisibleReviewCount] =
    useState(10);

  const loadReviews = async () => {
    let query = supabase
      .from("reviews")
      .select(
        "id, rating, comment, created_at, user_id, is_approved",
      )
      .eq("product_id", product.id);

    query = user
      ? query.or(
          `is_approved.eq.true,user_id.eq.${user.id}`,
        )
      : query.eq("is_approved", true);

    const { data, error } = await query.order(
      "created_at",
      { ascending: false },
    );

    if (error) {
      console.error("load reviews", error);
      return;
    }

    const reviews = (data ?? []) as LiveReview[];

    const userIds = [
      ...new Set(
        reviews
          .map((review) => review.user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (userIds.length === 0) {
      setProductReviews(reviews);
      return;
    }

    const { data: profiles, error: profilesError } =
      await supabase
        .from("review_profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

    if (profilesError) {
      console.error(
        "load review profiles",
        profilesError,
      );

      setProductReviews(reviews);
      return;
    }

    const profilesById = new Map(
      ((profiles ?? []) as ReviewProfile[]).map(
        (profile) => [profile.id, profile],
      ),
    );

    setProductReviews(
      reviews.map((review) => ({
        ...review,
        profile: review.user_id
          ? profilesById.get(review.user_id) ?? null
          : null,
      })),
    );
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      await loadReviews();
    };

    if (mounted) {
      void load();
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, user?.id]);

  const myReview =
    productReviews.find(
      (review) => review.user_id === user?.id,
    ) ?? null;

  const otherReviews = productReviews.filter(
    (review) => review.id !== myReview?.id,
  );

  const visibleReviews = otherReviews.slice(
    0,
    visibleReviewCount,
  );

  const hasMoreReviews =
    visibleReviewCount < otherReviews.length;

  // =========================================================
  // PUBLICATION D'UN AVIS
  // =========================================================

  const submitReview = async () => {
    if (!user) {
      openAuth("signin");
      return;
    }

    if (myRating < 1) {
      toast.error("Choisissez une note.");
      return;
    }

    setSubmittingReview(true);

    try {
      const { error } = await supabase
        .from("reviews")
        .insert({
          product_id: product.id,
          user_id: user.id,
          rating: myRating,
          comment: myComment.trim() || null,
        });

      if (error) {
        throw error;
      }

      toast.success(
        "Merci pour votre avis ! Il sera visible après modération.",
      );

      setMyRating(0);
      setMyComment("");

      await loadReviews();
    } catch (error) {
      console.error("submit review", error);

      toast.error(
        "Impossible d'enregistrer votre avis.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  // =========================================================
  // FAVORIS
  // =========================================================

  const liked = isWishlisted(product.id);

  // =========================================================
  // AJOUT AU PANIER
  // =========================================================

  const handleAdd = () => {
    if (!hasValidVariant) {
      toast.error(
        "Veuillez sélectionner toutes les options du produit.",
      );
      return;
    }

    if (stock <= 0) {
      toast.error("Ce produit est en rupture de stock.");
      return;
    }

    if (quantity > stock) {
      toast.error(
        "La quantité demandée dépasse le stock disponible.",
      );
      return;
    }

    addItem(
      {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        slug: product.slug,
        name: product.name,
        variant_label: variantLabel || null,
        image: currentImage?.url ?? "",
        unit_price: price,
        compare_at_price: compareAt,
        max_stock: stock,
      },
      quantity,
    );

    toast.success("Produit ajouté au panier !");
  };

  // =========================================================
  // RENDU
  // =========================================================

  return (
    <StoreLayout>
      <div className="container-page py-6 pb-16">

        {/* FIL D'ARIANE */}

        <nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/"
            className="transition hover:text-accent-strong"
          >
            Accueil
          </Link>

          {path.map((category) => (
            <span
              key={category.id}
              className="flex items-center gap-2"
            >
              <ChevronRight className="h-3 w-3" />

              <Link
                to="/categorie/$slug"
                params={{ slug: category.slug }}
                className="transition hover:text-accent-strong"
              >
                {category.name}
              </Link>
            </span>
          ))}

          <ChevronRight className="h-3 w-3" />

          <span className="font-medium text-foreground">
            {product.name}
          </span>
        </nav>

        {/* PRODUIT */}

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">

          {/* GALERIE */}

          <section className="min-w-0">
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">

              {onSale && (
                <div className="absolute left-4 top-4 z-10 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  -{discount}%
                </div>
              )}

              <div className="absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent-strong" />
                  Collection Bufanda
                </span>
              </div>

              {currentImage ? (
                <img
                  src={currentImage.url}
                  alt={currentImage.alt ?? product.name}
                  className="aspect-square w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                />
              ) : (
                <div className="grid aspect-square place-items-center text-sm text-muted-foreground">
                  Aucune image disponible
                </div>
              )}

              {currentImage && (
                <button
                  type="button"
                  aria-label="Agrandir l'image"
                  onClick={() => setZoomOpen(true)}
                  className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-border/50 bg-card/95 text-foreground shadow-lg transition hover:scale-105 hover:text-accent-strong"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* MINIATURES */}

            {gallery.length > 0 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {gallery.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Afficher l'image ${index + 1}`}
                    aria-pressed={index === activeImage}
                    className={cn(
                      "h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-surface transition sm:h-24 sm:w-24",
                      index === activeImage
                        ? "border-accent-strong shadow-md"
                        : "border-border opacity-75 hover:border-muted-foreground hover:opacity-100",
                    )}
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* AVANTAGES */}

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <Truck className="mx-auto h-5 w-5 text-accent-strong" />
                <p className="mt-2 text-[11px] font-semibold sm:text-xs">
                  Livraison rapide
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-accent-strong" />
                <p className="mt-2 text-[11px] font-semibold sm:text-xs">
                  Paiement sécurisé
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <RotateCcw className="mx-auto h-5 w-5 text-accent-strong" />
                <p className="mt-2 text-[11px] font-semibold sm:text-xs">
                  Service client
                </p>
              </div>
            </div>
          </section>

          {/* ZOOM */}

          <Dialog
            open={zoomOpen}
            onOpenChange={setZoomOpen}
          >
            <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none [&>button]:rounded-full [&>button]:bg-card [&>button]:p-1.5 [&>button]:opacity-100">
              {currentImage && (
                <img
                  src={currentImage.url}
                  alt={currentImage.alt ?? product.name}
                  className="max-h-[85vh] w-full rounded-2xl object-contain"
                />
              )}
            </DialogContent>
          </Dialog>

          {/* INFORMATIONS ET ACHAT */}

          <section className="min-w-0">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {product.brand || "Bufanda"}
                </p>

                {product.sku && (
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    Réf. {variant?.sku ?? product.sku}
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                {product.name}
              </h1>

              {/* NOTE */}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Stars value={product.rating} />

                <span className="text-sm font-semibold">
                  {product.rating.toFixed(1)}
                </span>

                <span className="text-sm text-muted-foreground">
                  ({product.reviews_count} avis)
                </span>

                <span className="h-1 w-1 rounded-full bg-border" />

                <a
                  href="#avis"
                  className="text-sm font-medium text-accent-strong transition hover:underline"
                >
                  Voir les avis
                </a>
              </div>

              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {product.short_description}
              </p>

              <Separator className="my-6" />

              {/* PRIX */}

              <div className="flex flex-wrap items-end gap-3">
                <span
                  className={cn(
                    "font-display text-3xl font-bold tracking-tight sm:text-4xl",
                    onSale && "text-accent-strong",
                  )}
                >
                  {formatPrice(price)}
                </span>

                {onSale && (
                  <>
                    <span className="mb-1 text-lg text-muted-foreground line-through">
                      {formatPrice(compareAt!)}
                    </span>

                    <span className="mb-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-sm font-bold text-destructive">
                      Économisez {discount}%
                    </span>
                  </>
                )}
              </div>

              {/* VARIANTES - AFFICHAGE AMÉLIORÉ */}

              {product.attributes.length > 0 && (
                <div className="mt-7 space-y-6">
                  {product.attributes.map((attribute) => {
                    const currentValue = attribute.values.find(
                      (value) => value.id === selection[attribute.code],
                    );

                    return (
                      <div
                        key={attribute.id}
                        className="rounded-xl border border-border/60 bg-surface/40 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold">
                              {attribute.name}
                            </p>
                            <span className="rounded-full bg-accent-strong/10 px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                              {currentValue?.label ?? "Sélectionner"}
                            </span>
                          </div>

                          <span className="text-[11px] text-muted-foreground">
                            {attribute.values.length} option
                            {attribute.values.length > 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {attribute.values.map((value) => {
                            const active =
                              selection[attribute.code] === value.id;

                            const available =
                              isOptionAvailable(
                                attribute.code,
                                value.id,
                              );

                            if (attribute.type === "swatch") {
                              return (
                                <button
                                  key={value.id}
                                  type="button"
                                  aria-label={value.label}
                                  aria-pressed={active}
                                  aria-disabled={!available}
                                  title={
                                    available
                                      ? value.label
                                      : `${value.label} indisponible`
                                  }
                                  disabled={!available}
                                  onClick={() =>
                                    handleAttributeChange(
                                      attribute.code,
                                      value.id,
                                    )
                                  }
                                  className={cn(
                                    "group relative grid h-12 w-12 place-items-center rounded-full border-2 transition",
                                    active
                                      ? "border-accent-strong ring-2 ring-accent-strong/30 ring-offset-2 ring-offset-card"
                                      : "border-border hover:border-accent-strong/60",
                                    !available &&
                                      "cursor-not-allowed opacity-40 grayscale",
                                  )}
                                >
                                  <span
                                    className="h-9 w-9 rounded-full border border-black/10"
                                    style={{
                                      backgroundColor: value.hex,
                                    }}
                                  />

                                  {active && (
                                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent-strong text-white shadow">
                                      <Check className="h-3 w-3" />
                                    </span>
                                  )}

                                  {!available && (
                                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white shadow">
                                      <X className="h-3 w-3" />
                                    </span>
                                  )}
                                </button>
                              );
                            }

                            return (
                              <button
                                key={value.id}
                                type="button"
                                aria-pressed={active}
                                disabled={!available}
                                onClick={() =>
                                  handleAttributeChange(
                                    attribute.code,
                                    value.id,
                                  )
                                }
                                className={cn(
                                  "relative min-w-16 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition",
                                  active
                                    ? "border-accent-strong bg-accent-strong text-white shadow-md"
                                    : "border-border bg-card text-foreground hover:border-accent-strong/60",
                                  !available &&
                                    "cursor-not-allowed border-dashed border-border/60 bg-surface text-muted-foreground/50 line-through hover:border-border/60",
                                )}
                              >
                                {value.label}

                                {active && (
                                  <span className="ml-1.5 inline-flex align-middle">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* COMBINAISON INVALIDE */}

              {!hasValidVariant &&
                product.variants.length > 0 && (
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p className="text-sm font-medium text-warning">
                      Cette combinaison n'est pas disponible. Choisissez d'autres options.
                    </p>
                  </div>
                )}

              {/* DISPONIBILITÉ */}

              <div className="mt-7 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        stock > 0
                          ? "bg-success shadow-[0_0_0_4px] shadow-success/10"
                          : "bg-destructive",
                      )}
                    />

                    <span
                      className={cn(
                        "text-sm font-bold",
                        stock > 0
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {stock > 0
                        ? "Disponible en stock"
                        : "Rupture de stock"}
                    </span>
                  </div>

                  {stock > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {stock} disponible{stock > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {stock > 0 && stock <= 5 && (
                  <p className="mt-2 text-xs font-medium text-warning">
                    Attention, stock limité !
                  </p>
                )}
              </div>

              {/* QUANTITÉ ET PANIER */}

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="flex h-12 items-center rounded-xl border border-border bg-card">

                  <button
                    type="button"
                    className="grid h-11 w-10 place-items-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                    onClick={() =>
                      setQuantity((value) =>
                        Math.max(1, value - 1),
                      )
                    }
                    disabled={quantity <= 1}
                    aria-label="Diminuer la quantité"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    className="grid h-11 w-10 place-items-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                    disabled={
                      quantity >= stock || !hasValidVariant
                    }
                    onClick={() =>
                      setQuantity((value) =>
                        Math.min(stock, value + 1),
                      )
                    }
                    aria-label="Augmenter la quantité"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Button
                  variant="accent"
                  size="xl"
                  className="h-12 min-w-0 flex-1 rounded-xl font-bold shadow-md transition hover:shadow-lg"
                  disabled={
                    stock <= 0 || !hasValidVariant
                  }
                  onClick={handleAdd}
                >
                  <ShoppingCart className="mr-1 h-5 w-5" />
                  Ajouter au panier
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    liked
                      ? "Retirer des favoris"
                      : "Ajouter aux favoris"
                  }
                  className="h-12 w-12 shrink-0 rounded-xl"
                  onClick={() =>
                    toggleWishlist(product.id)
                  }
                >
                  <Heart
                    className={cn(
                      "h-5 w-5 transition",
                      liked &&
                        "fill-accent-strong text-accent-strong",
                    )}
                  />
                </Button>
              </div>

              {/* LIVRAISON */}

              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-accent-strong/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  Livraison 24/48h
                </div>

                <span className="text-sm font-bold text-foreground">
                  7 DT
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent-strong" />
                Paiement à la livraison uniquement
              </div>

            </div>
          </section>
        </div>

        {/* DESCRIPTION ET AVIS */}

        <section className="mt-14 sm:mt-20">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-strong">
              En savoir plus
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Tout sur ce produit
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Retrouvez les informations détaillées et les retours de nos clients.
            </p>
          </div>

          <Tabs defaultValue="description" className="w-full">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 sm:w-fit">
              <TabsTrigger
                value="description"
                className="rounded-lg px-4 py-2.5 text-sm"
              >
                Description
              </TabsTrigger>

              <TabsTrigger
                value="specs"
                className="rounded-lg px-4 py-2.5 text-sm"
              >
                Caractéristiques
              </TabsTrigger>

              <TabsTrigger
                value="avis"
                className="rounded-lg px-4 py-2.5 text-sm"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Avis ({productReviews.length})
              </TabsTrigger>
            </TabsList>

            {/* DESCRIPTION */}

            <TabsContent
              value="description"
              className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-8"
            >
              <div className="max-w-4xl text-sm leading-8 text-muted-foreground">
                <RichText value={product.description} />
              </div>
            </TabsContent>

            {/* CARACTÉRISTIQUES */}

            <TabsContent value="specs" className="mt-5">
              <dl className="overflow-hidden rounded-2xl border border-border bg-card">
                {[
                  ["Marque", product.brand || "Bufanda"],
                  [
                    "Référence",
                    variant?.sku ?? product.sku,
                  ],
                  ...product.attributes.map(
                    (attribute) =>
                      [
                        attribute.name,
                        attribute.values
                          .map((value) => value.label)
                          .join(", "),
                      ] as [string, string],
                  ),
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={cn(
                      "flex flex-col gap-1 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6",
                      index % 2 === 0 && "bg-surface/70",
                    )}
                  >
                    <dt className="font-medium text-muted-foreground">
                      {label}
                    </dt>

                    <dd className="font-semibold text-foreground sm:text-right">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </TabsContent>

            {/* AVIS */}

            <TabsContent
              value="avis"
              className="mt-5"
              id="avis"
            >
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">

                {/* FORMULAIRE */}

                <div>
                  {!user ? (
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-strong/10">
                        <MessageCircle className="h-6 w-6 text-accent-strong" />
                      </div>

                      <h3 className="font-bold">
                        Partagez votre expérience
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Connectez-vous pour donner votre avis sur ce produit.
                      </p>

                      <Button
                        variant="accent"
                        className="mt-5 w-full"
                        onClick={() =>
                          openAuth("signin")
                        }
                      >
                        Se connecter
                      </Button>
                    </div>
                  ) : myReview ? (
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <p className="text-xs font-bold uppercase tracking-wider text-accent-strong">
                        Votre contribution
                      </p>

                      <h3 className="mt-2 font-bold">
                        Votre avis sur ce produit
                      </h3>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Stars value={myReview.rating} />

                        {myReview.is_approved !== true && (
                          <span className="rounded-full bg-warning/15 px-3 py-1 text-[11px] font-semibold text-warning">
                            En attente de modération
                          </span>
                        )}
                      </div>

                      {myReview.comment && (
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">
                          {myReview.comment}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-strong/10">
                          <Star className="h-5 w-5 text-accent-strong" />
                        </div>

                        <div>
                          <h3 className="font-bold">
                            Laisser un avis
                          </h3>

                          <p className="text-xs text-muted-foreground">
                            Votre opinion compte pour nous
                          </p>
                        </div>
                      </div>

                      <p className="mb-2 text-sm font-medium">
                        Votre note
                      </p>

                      <StarPicker
                        value={myRating}
                        onChange={setMyRating}
                      />

                      <p className="mb-2 mt-5 text-sm font-medium">
                        Votre commentaire
                      </p>

                      <Textarea
                        value={myComment}
                        onChange={(event) =>
                          setMyComment(event.target.value)
                        }
                        placeholder="Décrivez votre expérience avec ce produit..."
                        rows={4}
                        className="resize-none rounded-xl"
                      />

                      <Button
                        variant="accent"
                        className="mt-4 w-full"
                        onClick={submitReview}
                        disabled={submittingReview}
                      >
                        {submittingReview
                          ? "Envoi en cours…"
                          : "Publier mon avis"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* LISTE DES AVIS */}

                <div className="space-y-4">
                  {otherReviews.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-surface">
                        <MessageCircle className="h-6 w-6 text-muted-foreground" />
                      </div>

                      <h3 className="mt-4 font-bold">
                        Aucun avis pour le moment
                      </h3>

                      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        Soyez le premier à partager votre expérience avec ce produit.
                      </p>
                    </div>
                  ) : (
                    <>
                      {visibleReviews.map((review) => {
                        const fullName = [
                          review.profile?.first_name,
                          review.profile?.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <article
                            key={review.id}
                            className="rounded-2xl border border-border bg-card p-5 transition hover:shadow-sm sm:p-6"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-strong/10 text-sm font-bold text-accent-strong">
                                  {(fullName || "C")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <p className="text-sm font-bold">
                                    {fullName || "Client"}
                                  </p>

                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {review.created_at
                                      ? new Date(
                                          review.created_at,
                                        ).toLocaleDateString(
                                          "fr-FR",
                                        )
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <Stars value={review.rating} />
                            </div>

                            {review.comment && (
                              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                                {review.comment}
                              </p>
                            )}
                          </article>
                        );
                      })}

                      {otherReviews.length > 10 && (
                        <div className="pt-2 text-center">
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() =>
                              setVisibleReviewCount((count) =>
                                hasMoreReviews
                                  ? Math.min(
                                      count + 10,
                                      otherReviews.length,
                                    )
                                  : 10,
                              )
                            }
                            aria-expanded={!hasMoreReviews}
                          >
                            {hasMoreReviews
                              ? "Voir plus d'avis"
                              : "Voir moins"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* PRODUITS LIÉS */}

        {related.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <Separator className="mb-10" />

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-strong">
                  À découvrir
                </p>

                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Vous aimerez aussi
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Découvrez d'autres produits de la même catégorie.
                </p>
              </div>

              {path.length > 0 && (
                <Link
                  to="/categorie/$slug"
                  params={{
                    slug: path[path.length - 1].slug,
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong transition hover:gap-2"
                >
                  Voir la catégorie
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}

// =========================================================
// ROUTE TANSTACK
// =========================================================

export const Route = createFileRoute("/produit/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductBySlug(params.slug);

    if (!product) {
      throw notFound();
    }

    return { product };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Produit indisponible : Bufanda" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const { product } = loaderData;

    const title = `${product.name} : Bufanda`;

    return {
      meta: [
        { title },
        {
          name: "description",
          content: product.short_description,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: product.short_description,
        },
      ],
    };
  },

  component: ProductPage,
});