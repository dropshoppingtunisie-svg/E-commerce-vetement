import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  PackageCheck,
  ChevronRight,
  MessageCircle,
  Sparkles,
  RotateCcw,
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

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
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

function ProductPage() {
  const { product } = Route.useLoaderData();

  const { addItem, toggleWishlist, isWishlisted } = useStore();
  const { user, openAuth } = useAuth();

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    product.attributes.forEach((attr) => {
      const first = attr.values[0];
      if (first) initial[attr.code] = first.id;
    });

    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);

  const [liveProductStock, setLiveProductStock] = useState(product.stock);

  const [liveVariantStocks, setLiveVariantStocks] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      product.variants.map((item) => [item.id, item.stock]),
    ),
  );

  const gallery = product.images;

  const mainImageIndex = () => {
    const idx = gallery.findIndex((img) => img.is_main);
    return idx >= 0 ? idx : 0;
  };

  const [activeImage, setActiveImage] = useState(mainImageIndex);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const selectedValueIds = Object.values(selection);

    const matchIndex = gallery.findIndex(
      (img) =>
        img.variant_value &&
        selectedValueIds.includes(img.variant_value),
    );

    setActiveImage(
      matchIndex >= 0 ? matchIndex : mainImageIndex(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, gallery]);

  const variant = useMemo(() => {
    if (product.variants.length === 0) return null;

    return (
      product.variants.find((v) =>
        Object.entries(selection).every(
          ([code, value]) => v.options[code] === value,
        ),
      ) ?? null
    );
  }, [product.variants, selection]);

  const price = variant?.price ?? product.price;
  const compareAt =
    variant?.compare_at_price ?? product.compare_at_price;

  const stock = variant
    ? liveVariantStocks[variant.id] ?? variant.stock
    : liveProductStock;

  const onSale = compareAt !== null && compareAt > price;

  const discount = onSale
    ? Math.round(((compareAt! - price) / compareAt!) * 100)
    : 0;

  const variantLabel = product.attributes
    .map(
      (attr) =>
        attr.values.find((v) => v.id === selection[attr.code])?.label,
    )
    .filter(Boolean)
    .join(" / ");

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
          const nextStock = Number(
            (payload.new as {
              stock_quantity?: number | null;
            }).stock_quantity ?? 0,
          );

          setLiveProductStock(nextStock);
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

  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof fetchCategories>>
  >([]);

  const [related, setRelated] = useState<Product[]>([]);
  const [productReviews, setProductReviews] = useState<LiveReview[]>([]);

  useEffect(() => {
    let mounted = true;

    fetchCategories()
      .then((data) => {
        if (mounted) setCategories(data);
      })
      .catch((err) => console.error("load categories", err));

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

    const rootId = path[0]?.id;

    if (!rootId) {
      setRelated([]);
      return;
    }

    fetchActiveProducts()
      .then((data) => {
        if (!mounted) return;

        setRelated(
          data
            .filter(
              (p) =>
                p.id !== product.id &&
                p.category_id === product.category_id,
            )
            .slice(0, 4),
        );
      })
      .catch((err) =>
        console.error("load related products", err),
      );

    return () => {
      mounted = false;
    };
  }, [path, product.id, product.category_id]);

  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadReviews = () => {
    let query = supabase
      .from("reviews")
      .select(
        "id, rating, comment, created_at, user_id, is_approved",
      )
      .eq("product_id", product.id);

    query = user
      ? query.or(`is_approved.eq.true,user_id.eq.${user.id}`)
      : query.eq("is_approved", true);

    return query
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          console.error("load reviews", error);
          return;
        }

        const reviews = (data ?? []) as LiveReview[];

        const userIds = [
          ...new Set(
            reviews
              .map((review) => review.user_id)
              .filter(Boolean),
          ),
        ] as string[];

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
          (profiles ?? []).map((profile: any) => [
            profile.id,
            profile,
          ]),
        );

        setProductReviews(
          reviews.map((review) => ({
            ...review,
            profile: review.user_id
              ? profilesById.get(review.user_id) ?? null
              : null,
          })),
        );
      });
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, user?.id]);

  const myReview =
    productReviews.find((r) => r.user_id === user?.id) ?? null;

  const [visibleReviewCount, setVisibleReviewCount] = useState(10);

  const otherReviews = productReviews.filter(
    (r) => r.id !== myReview?.id,
  );

  const visibleReviews = otherReviews.slice(
    0,
    visibleReviewCount,
  );

  const hasMoreReviews =
    visibleReviewCount < otherReviews.length;

  const submitReview = async () => {
    if (!user) return;

    if (myRating < 1) {
      toast.error("Choisissez une note.");
      return;
    }

    setSubmittingReview(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        product_id: product.id,
        user_id: user.id,
        rating: myRating,
        comment: myComment.trim() || null,
      });

      if (error) throw error;

      toast.success(
        "Merci pour votre avis ! Il sera visible après modération.",
      );

      setMyRating(0);
      setMyComment("");

      await loadReviews();
    } catch (err) {
      console.error("submit review", err);
      toast.error("Impossible d'enregistrer votre avis.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const liked = isWishlisted(product.id);

  const currentImage =
    gallery[Math.min(activeImage, gallery.length - 1)];

  const handleAdd = () => {
    if (stock === 0) return;

    if (quantity > stock) {
      toast.error("La quantité demandée dépasse le stock disponible.");
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

    toast.success("Produit ajouté au panier");
  };

  return (
    <StoreLayout>
      <div className="container-page py-6 pb-16">
        {/* Fil d'Ariane */}
        <nav className="mb-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/"
            className="transition hover:text-accent-strong"
          >
            Accueil
          </Link>

          {path.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-2"
            >
              <ChevronRight className="h-3 w-3" />

              <Link
                to="/categorie/$slug"
                params={{ slug: c.slug }}
                className="transition hover:text-accent-strong"
              >
                {c.name}
              </Link>
            </span>
          ))}

          <ChevronRight className="h-3 w-3" />

          <span className="font-medium text-foreground">
            {product.name}
          </span>
        </nav>

        {/* Produit */}
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* Galerie */}
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

            {/* Miniatures */}
            {gallery.length > 0 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {gallery.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Afficher l'image ${i + 1}`}
                    aria-pressed={i === activeImage}
                    className={cn(
                      "h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-surface transition sm:h-24 sm:w-24",
                      i === activeImage
                        ? "border-accent-strong shadow-md"
                        : "border-border opacity-75 hover:border-muted-foreground hover:opacity-100",
                    )}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

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

          {/* Zoom */}
          <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
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

          {/* Informations et achat */}
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

              {/* Prix */}
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

              {/* Variantes */}
              {product.attributes.length > 0 && (
                <div className="mt-7 space-y-6">
                  {product.attributes.map((attr) => (
                    <div key={attr.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold">
                          {attr.name}
                        </p>

                        <span className="text-sm text-muted-foreground">
                          {attr.values.find(
                            (v) => v.id === selection[attr.code],
                          )?.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {attr.values.map((value) => {
                          const active =
                            selection[attr.code] === value.id;

                          if (attr.type === "swatch") {
                            return (
                              <button
                                key={value.id}
                                type="button"
                                aria-label={value.label}
                                aria-pressed={active}
                                title={value.label}
                                onClick={() =>
                                  setSelection((s) => ({
                                    ...s,
                                    [attr.code]: value.id,
                                  }))
                                }
                                className={cn(
                                  "grid h-11 w-11 place-items-center rounded-full border-2 transition",
                                  active
                                    ? "border-accent-strong ring-2 ring-accent-strong/20"
                                    : "border-border hover:border-muted-foreground",
                                )}
                              >
                                <span
                                  className="h-8 w-8 rounded-full border border-black/10"
                                  style={{
                                    backgroundColor: value.hex,
                                  }}
                                />
                              </button>
                            );
                          }

                          return (
                            <button
                              key={value.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setSelection((s) => ({
                                  ...s,
                                  [attr.code]: value.id,
                                }))
                              }
                              className={cn(
                                "min-w-16 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                                active
                                  ? "border-accent-strong bg-accent-strong/10 text-accent-strong shadow-sm"
                                  : "border-border bg-card text-foreground hover:border-accent-strong/60",
                              )}
                            >
                              {value.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Disponibilité */}
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

              {/* Quantité et panier */}
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="flex h-12 items-center rounded-xl border border-border bg-card">
                  <button
                    type="button"
                    className="grid h-11 w-10 place-items-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                    onClick={() =>
                      setQuantity((q) => Math.max(1, q - 1))
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
                    disabled={quantity >= stock}
                    onClick={() =>
                      setQuantity((q) => Math.min(stock, q + 1))
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
                  disabled={stock === 0}
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
                  onClick={() => toggleWishlist(product.id)}
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

        {/* Description et avis */}
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

            <TabsContent
              value="description"
              className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-8"
            >
              <div className="max-w-4xl text-sm leading-8 text-muted-foreground">
                <RichText value={product.description} />
              </div>
            </TabsContent>

            <TabsContent value="specs" className="mt-5">
              <dl className="overflow-hidden rounded-2xl border border-border bg-card">
                {[
                  ["Marque", product.brand || "Bufanda"],
                  [
                    "Référence",
                    variant?.sku ?? product.sku,
                  ],
                  ...product.attributes.map(
                    (a) =>
                      [
                        a.name,
                        a.values.map((v) => v.label).join(", "),
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

            <TabsContent
              value="avis"
              className="mt-5"
              id="avis"
            >
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                {/* Formulaire / Mon avis */}
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
                        onClick={() => openAuth("signin")}
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
                        onChange={(e) =>
                          setMyComment(e.target.value)
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

                {/* Liste des avis */}
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
                      {visibleReviews.map((r) => {
                        const fullName = [
                          r.profile?.first_name,
                          r.profile?.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <article
                            key={r.id}
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
                                    {r.created_at
                                      ? new Date(
                                          r.created_at,
                                        ).toLocaleDateString(
                                          "fr-FR",
                                        )
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <Stars value={r.rating} />
                            </div>

                            {r.comment && (
                              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                                {r.comment}
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

        {/* Produits liés */}
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
                  params={{ slug: path[path.length - 1].slug }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong transition hover:gap-2"
                >
                  Voir la catégorie
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}

export const Route = createFileRoute("/produit/$slug")({
  loader: async ({ params }) => {
    const product = await fetchProductBySlug(params.slug);

    if (!product) throw notFound();

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
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: product.short_description,
        },
      ],
    };
  },

  component: ProductPage,
});