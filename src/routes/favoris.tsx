
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  HeartOff,
  Package,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { StoreLayout } from "@/components/store/StoreLayout";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/store/ProductCard";

import { fetchActiveProducts } from "@/lib/catalog";
import type { Product } from "@/types";

import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "Mes favoris : Bufanda" },
      {
        name: "description",
        content:
          "Retrouvez les produits que vous avez enregistrés dans votre liste d'envies.",
      },
      {
        property: "og:title",
        content: "Mes favoris : Bufanda",
      },
      {
        property: "og:description",
        content: "Votre liste d'envies Bufanda.",
      },
    ],
  }),
  component: FavorisPage,
});

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyWishlist() {
  return (
    <div className="relative mt-10 overflow-hidden rounded-3xl border border-dashed border-border bg-card px-5 py-16 text-center sm:py-20">
      {/* DECORATION */}

      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />

      {/* ICON */}

      <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary/10">
        <HeartOff className="h-11 w-11 text-primary" />

        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground">
          <Heart className="h-4 w-4 fill-current" />
        </div>
      </div>

      {/* TEXT */}

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          Votre sélection
        </span>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Votre liste d'envies est vide
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Vous n'avez pas encore enregistré de produits.
          Explorez notre collection et ajoutez vos articles préférés
          en cliquant sur l'icône cœur.
        </p>

        <Button
          asChild
          variant="accent"
          className="mt-7 h-11 gap-2 rounded-xl px-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <Link to="/">
            <ShoppingBag className="h-4 w-4" />
            Découvrir la boutique
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// LOADING STATE
// ============================================================

function WishlistSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

// ============================================================
// ERROR STATE
// ============================================================

function WishlistError({
  onRetry,
  refreshing,
}: {
  onRetry: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="mt-10 rounded-2xl border border-destructive/20 bg-card px-5 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>

      <h2 className="mt-4 text-lg font-bold text-foreground">
        Impossible de charger les produits
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Une erreur est survenue lors du chargement de votre liste de favoris.
        Veuillez réessayer.
      </p>

      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        disabled={refreshing}
        className="mt-5 gap-2 rounded-xl"
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Réessayer
      </Button>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function FavorisPage() {
  const { wishlist } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ----------------------------------------------------------
  // LOAD PRODUCTS
  // ----------------------------------------------------------

  const loadProducts = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError(false);

    try {
      const data = await fetchActiveProducts();
      setProducts(data);
    } catch (error) {
      console.error("load favoris products:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await fetchActiveProducts();

        if (mounted) {
          setProducts(data);
          setLoadError(false);
        }
      } catch (error) {
        console.error("load favoris products:", error);

        if (mounted) {
          setLoadError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  // ----------------------------------------------------------
  // FILTER WISHLIST
  // ----------------------------------------------------------

  const liked = useMemo(
    () => products.filter((product) => wishlist.includes(product.id)),
    [products, wishlist]
  );

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <StoreLayout>
      <div className="container-page py-8 sm:py-10 lg:py-12">

        {/* HEADER */}

        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-7 shadow-sm sm:px-8 sm:py-9">

          {/* DECORATIVE BACKGROUND */}

          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />

          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">

            {/* TITLE */}

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm sm:h-16 sm:w-16">
                <Heart className="h-7 w-7 fill-current sm:h-8 sm:w-8" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                    Mes favoris
                  </h1>

                  {!loading && !loadError && (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {liked.length}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                  Retrouvez tous vos produits préférés au même endroit.
                </p>
              </div>
            </div>

            {/* RIGHT INFO */}

            {!loading && !loadError && (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingBag className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground">
                    {liked.length} produit{liked.length > 1 ? "s" : ""}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Dans votre sélection
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* INTRODUCTION */}

        {!loading && !loadError && liked.length > 0 && (
          <div className="mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Votre sélection personnelle
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Les articles que vous avez ajoutés à vos favoris.
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Heart className="h-3.5 w-3.5 text-primary" />
              Liste d'envies
            </span>
          </div>
        )}

        {/* PRODUCTS */}

        {loading ? (
          <WishlistSkeleton />
        ) : loadError ? (
          <WishlistError
            onRetry={() => void loadProducts()}
            refreshing={refreshing}
          />
        ) : liked.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {liked.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}

        {/* FOOTER */}

        {!loading && !loadError && liked.length > 0 && (
          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Heart className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-bold text-foreground">
                  Continuez votre découverte
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Découvrez encore plus de produits dans notre boutique.
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              className="h-10 gap-2 rounded-xl"
            >
              <Link to="/">
                Explorer la boutique
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
