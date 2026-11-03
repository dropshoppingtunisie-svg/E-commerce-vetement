
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
} from "lucide-react";

import { StoreLayout } from "@/components/store/StoreLayout";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/store/ProductCard";

import { isOnSale } from "@/data/products";
import { buildCategoryTree } from "@/data/categories";

import {
  fetchActiveBanners,
  fetchActiveProducts,
  fetchCategories,
  type Banner,
} from "@/lib/catalog";

import { isSafeUrl } from "@/lib/utils";

import type { CategoryNode, Product } from "@/types";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Mode | Boutique de vêtements en Tunisie" },
      {
        name: "description",
        content:
          "Découvrez notre collection de vêtements tendance pour femme, homme et enfant. Nouveautés, styles élégants et livraison partout en Tunisie.",
      },
      {
        property: "og:title",
        content: "Maison Mode | Boutique de vêtements",
      },
      {
        property: "og:description",
        content:
          "Découvrez notre collection de vêtements et les dernières tendances mode.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  // Chargement des données depuis Supabase
  useEffect(() => {
    let mounted = true;

    fetchActiveProducts()
      .then((data) => {
        if (mounted) {
          setProducts(data);
        }
      })
      .catch((err) => {
        console.error("load home products", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    fetchCategories()
      .then((data) => {
        if (mounted) {
          setCategoryTree(buildCategoryTree(data));
        }
      })
      .catch((err) => {
        console.error("load home categories", err);
      });

    fetchActiveBanners()
      .then((data) => {
        if (mounted) {
          setBanners(data);
        }
      })
      .catch((err) => {
        console.error("load home banners", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Défilement automatique des bannières
  useEffect(() => {
    if (!carouselApi || banners.length <= 1) {
      return;
    }

    const id = setInterval(() => {
      carouselApi.scrollNext();
    }, 6000);

    return () => clearInterval(id);
  }, [carouselApi, banners.length]);

  const promos = products.filter(isOnSale).slice(0, 4);

  const nouveautes = products
    .filter((product) => product.is_new)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);

  return (
    <StoreLayout>
      {/* HERO / COLLECTION */}
      {banners.length > 0 ? (
        <section className="container-page pt-5 sm:pt-8">
          <div className="overflow-hidden rounded-sm">
            <Carousel setApi={setCarouselApi} opts={{ loop: true }}>
              <CarouselContent>
                {banners.map((banner) => {
                  const slide = (
                    <div className="group relative aspect-[4/5] w-full overflow-hidden bg-surface sm:aspect-[16/7] lg:aspect-[21/8]">
                      <img
                        src={banner.image_url}
                        alt={banner.title ?? "Collection de vêtements"}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

                      {(banner.title || banner.subtitle) && (
                        <div className="absolute inset-0 flex flex-col items-start justify-center p-6 text-white sm:p-12 lg:p-16">
                          <span className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/80 sm:text-sm">
                            Maison Mode
                          </span>

                          {banner.title && (
                            <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                              {banner.title}
                            </h1>
                          )}

                          {banner.subtitle && (
                            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">
                              {banner.subtitle}
                            </p>
                          )}

                          <span className="mt-7 inline-flex items-center gap-3 border border-white px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-white hover:text-black sm:mt-9">
                            Découvrir la collection
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <CarouselItem key={banner.id}>
                      {banner.products_count > 0 ? (
                        <Link
                          to="/banniere/$id"
                          params={{ id: banner.id }}
                          className="block"
                        >
                          {slide}
                        </Link>
                      ) : (
                        <a
                          href={
                            isSafeUrl(banner.link_url)
                              ? banner.link_url
                              : "/promotions"
                          }
                          className="block"
                        >
                          {slide}
                        </a>
                      )}
                    </CarouselItem>
                  );
                })}
              </CarouselContent>

              {banners.length > 1 && (
                <>
                  <CarouselPrevious className="left-3 border-white/50 bg-white/90 text-black hover:bg-white sm:left-6" />
                  <CarouselNext className="right-3 border-white/50 bg-white/90 text-black hover:bg-white sm:right-6" />
                </>
              )}
            </Carousel>
          </div>
        </section>
      ) : (
        <section className="container-page pt-5 sm:pt-8">
          <div className="relative overflow-hidden bg-[#e9e3da] px-6 py-16 sm:px-12 sm:py-24 lg:px-16">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/30 blur-3xl" />

            <div className="relative max-w-2xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-600">
                Maison Mode
              </p>

              <h1 className="font-display text-4xl font-semibold leading-tight text-neutral-900 sm:text-6xl">
                Le style qui
                <br />
                vous ressemble.
              </h1>

              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base">
                Découvrez notre sélection de vêtements et trouvez les pièces
                qui accompagnent votre quotidien.
              </p>

              <Link
                to="/promotions"
                className="mt-8 inline-flex items-center gap-3 bg-neutral-900 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-700"
              >
                Découvrir la collection
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="container-page border-b border-border/70 py-6 sm:py-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-8">
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <Truck className="h-5 w-5 shrink-0 text-accent-strong" />
            <div>
              <p className="text-sm font-semibold">Livraison en Tunisie</p>
              <p className="text-xs text-muted-foreground">
                Recevez votre commande chez vous
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <ShieldCheck className="h-5 w-5 shrink-0 text-accent-strong" />
            <div>
              <p className="text-sm font-semibold">Paiement sécurisé</p>
              <p className="text-xs text-muted-foreground">
                Paiement à la livraison
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <Headphones className="h-5 w-5 shrink-0 text-accent-strong" />
            <div>
              <p className="text-sm font-semibold">Service client</p>
              <p className="text-xs text-muted-foreground">
                Nous sommes là pour vous aider
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      {categoryTree.length > 0 && (
        <section className="container-page py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Explorez nos univers
              </p>
              <h2 className="section-title">Nos catégories</h2>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryTree.map((cat) => (
              <Link
                key={cat.id}
                to="/categorie/$slug"
                params={{ slug: cat.slug }}
                className="group flex min-h-36 flex-col justify-between border border-border/70 bg-card p-4 transition-all duration-300 hover:border-foreground hover:shadow-card sm:min-h-44 sm:p-6"
              >
                <div>
                  <h3 className="font-display text-lg font-semibold transition-colors group-hover:text-accent-strong sm:text-xl">
                    {cat.name}
                  </h3>

                  {cat.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {cat.description}
                    </p>
                  )}
                </div>

                <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* PROMOTIONS */}
      {(loading || promos.length > 0) && (
        <section className="bg-surface/60 py-12 sm:py-16">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Les bonnes affaires
                </p>
                <h2 className="section-title">À prix doux</h2>
              </div>

              <Link
                to="/promotions"
                className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-accent-strong sm:text-sm"
              >
                Tout voir
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))
                : promos.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* NOUVEAUTES */}
      {(loading || nouveautes.length > 0) && (
        <section className="container-page py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Tout juste arrivés
              </p>
              <h2 className="section-title">Nouvelle collection</h2>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : nouveautes.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
          </div>
        </section>
      )}

      {/* TOUS LES PRODUITS */}
      {(loading || products.length > 0) && (
        <section className="border-t border-border/60 py-12 sm:py-16">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Notre sélection
                </p>
                <h2 className="section-title">À découvrir</h2>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))
                : products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
            </div>
          </div>
        </section>
      )}
    </StoreLayout>
  );
}
