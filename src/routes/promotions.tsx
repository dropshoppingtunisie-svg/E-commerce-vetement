import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Flame,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";

import { StoreLayout } from "@/components/store/StoreLayout";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/store/ProductCard";
import { isOnSale } from "@/data/products";
import { fetchActiveProducts } from "@/lib/catalog";
import type { Product } from "@/types";

export const Route = createFileRoute("/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions en cours : Bufanda" },
      {
        name: "description",
        content:
          "Découvrez toutes les promotions Bufanda sur l'informatique, la téléphonie et la maison.",
      },
      { property: "og:title", content: "Promotions en cours : Bufanda" },
      {
        property: "og:description",
        content:
          "Découvrez notre sélection de produits en promotion chez Bufanda.",
      },
    ],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchActiveProducts()
      .then((data) => {
        if (mounted) {
          setProducts(data);
        }
      })
      .catch((err) => {
        console.error("load promotions products", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const promos = useMemo(
    () => products.filter(isOnSale),
    [products]
  );

  return (
    <StoreLayout>
      <main className="min-h-screen bg-background">
        {/* Hero section */}
        <section className="relative isolate overflow-hidden border-b border-border bg-gradient-to-br from-accent/10 via-background to-background">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

          <div className="container-page relative py-12 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold text-accent-strong">
                <Flame className="h-4 w-4" />
                Les offres du moment
              </div>

              <h1 className="page-title text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Nos{" "}
                <span className="text-accent-strong">
                  Promotions
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Profitez de nos offres sur une sélection de produits.
                Retrouvez vos articles préférés à prix réduit, le tout
                au même endroit.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-4 py-3 shadow-sm">
                  <Tag className="h-5 w-5 text-accent-strong" />
                  <div>
                    <p className="text-lg font-bold leading-none">
                      {loading ? "—" : promos.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Produits en promotion
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-4 py-3 shadow-sm">
                  <Sparkles className="h-5 w-5 text-accent-strong" />
                  <div>
                    <p className="text-sm font-semibold">
                      Offres sélectionnées
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Découvrez notre sélection
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Products section */}
        <section className="container-page py-10 sm:py-12">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent-strong">
                <BadgePercent className="h-4 w-4" />
                Sélection spéciale
              </div>

              <h2 className="text-2xl font-bold tracking-tight">
                Les produits en promotion
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {loading
                  ? "Chargement des offres..."
                  : `${promos.length} ${
                      promos.length > 1
                        ? "produits disponibles"
                        : "produit disponible"
                    }`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : promos.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent-strong">
                <ShoppingBag className="h-8 w-8" />
              </div>

              <h3 className="text-lg font-bold">
                Aucune promotion pour le moment
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Il n'y a actuellement aucun produit en réduction.
                Revenez bientôt pour découvrir nos prochaines offres.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {promos.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </StoreLayout>
  );
}