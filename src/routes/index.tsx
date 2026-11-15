import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Truck, ShieldCheck, Headphones } from "lucide-react";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard, ProductCardSkeleton } from "@/components/store/ProductCard";
import { isOnSale } from "@/data/products";
import { buildCategoryTree } from "@/data/categories";
import { fetchActiveBanners, fetchActiveProducts, fetchCategories, type Banner } from "@/lib/catalog";
import { isSafeUrl } from "@/lib/utils";
import type { CategoryNode, Product } from "@/types";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";

const PRODUCTS_PER_PAGE = 8;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bufanda | Boutique de vêtements en Tunisie" },
      { name: "description", content: "Découvrez notre collection de vêtements tendance pour femme, homme et enfant." },
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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    fetchActiveProducts().then(data => { if (mounted) { setProducts(data); setCurrentPage(1); } }).catch(console.error).finally(() => { if (mounted) setLoading(false); });
    fetchCategories().then(data => { if (mounted) setCategoryTree(buildCategoryTree(data)); }).catch(console.error);
    fetchActiveBanners().then(data => { if (mounted) setBanners(data); }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!carouselApi || banners.length <= 1) return;
    const id = setInterval(() => carouselApi.scrollNext(), 6000);
    return () => clearInterval(id);
  }, [carouselApi, banners.length]);

  const promos = products.filter(isOnSale).slice(0, 4);
  const nouveautes = products.filter(p => p.is_new).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const totalProducts = products.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = Math.min(startIndex + PRODUCTS_PER_PAGE, totalProducts);
  const displayedProducts = products.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <StoreLayout>
      {/* 1. BANNIÈRES CAROUSEL (Arrondies et modernes) */}
      {banners.length > 0 && (
        <section className="container-page pt-6 pb-12">
          <div className="overflow-hidden rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <Carousel setApi={setCarouselApi} opts={{ loop: true }}>
              <CarouselContent>
                {banners.map((banner) => {
                  const slide = (
                    <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[#edf3ed] sm:aspect-[16/7] lg:aspect-[21/8]">
                      <img
                        src={banner.image_url}
                        alt={banner.title ?? "Collection Bufanda"}
                        loading="eager"
                        className="absolute inset-0 h-full w-full object-contain object-center"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
                      {(banner.title || banner.subtitle) && (
                        <div className="absolute inset-0 flex flex-col items-start justify-center p-8 text-white sm:p-14 lg:p-20">
                          <span className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 sm:text-sm">
                            Bufanda
                          </span>
                          {banner.title && (
                            <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                              {banner.title}
                            </h2>
                          )}
                          {banner.subtitle && (
                            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">
                              {banner.subtitle}
                            </p>
                          )}
                          <span className="mt-8 inline-flex items-center gap-3 border border-white/50 bg-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm transition-all hover:bg-white hover:text-black sm:mt-10">
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
                        <Link to="/banniere/$id" params={{ id: banner.id }} className="block">{slide}</Link>
                      ) : (
                        <a href={isSafeUrl(banner.link_url) ? banner.link_url : "/promotions"} className="block">{slide}</a>
                      )}
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              {banners.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 border-none bg-white/80 text-black backdrop-blur-sm hover:bg-white sm:left-8" />
                  <CarouselNext className="right-4 border-none bg-white/80 text-black backdrop-blur-sm hover:bg-white sm:right-8" />
                </>
              )}
            </Carousel>
          </div>
        </section>
      )}

      {/* 2. SERVICES (Avec des icônes plus douces) */}
      <section className="container-page py-8 border-b border-gray-100 mb-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-12">
          {[
            { icon: Truck, title: "Livraison en Tunisie", desc: "Recevez votre commande chez vous" },
            { icon: ShieldCheck, title: "Paiement sécurisé", desc: "Paiement à la livraison" },
            { icon: Headphones, title: "Service client", desc: "Nous sommes là pour vous aider" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-4 sm:justify-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f0ede3] text-accent-strong">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. CATÉGORIES (Cartes très modernes) */}
      {categoryTree.length > 0 && (
        <section className="container-page py-12 sm:py-16">
          <div className="flex flex-col items-center text-center mb-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent-strong">
              Explorez nos univers
            </p>
            <h2 className="font-display text-3xl font-semibold text-gray-900 sm:text-4xl">Nos catégories</h2>
            <div className="mt-4 h-1 w-12 rounded-full bg-accent-strong/30" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categoryTree.map((cat) => (
              <Link
                key={cat.id}
                to="/categorie/$slug"
                params={{ slug: cat.slug }}
                className="group relative flex min-h-[10rem] flex-col justify-between overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-lg sm:min-h-[12rem]"
              >
                <div className="relative z-10">
                  <h3 className="font-display text-xl font-semibold text-gray-900 transition-colors group-hover:text-accent-strong">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
                      {cat.description}
                    </p>
                  )}
                </div>
                <span className="relative z-10 mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-900">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
                {/* Effet de fond au survol */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#f0ede3]/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. PROMOTIONS (Section beige avec un titre élégant) */}
      {(loading || promos.length > 0) && (
        <section className="relative bg-[#ecdcc6] py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#8b7355]">
                  Les bonnes affaires
                </p>
                <h2 className="font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
                  À prix doux
                </h2>
              </div>
              <Link
                to="/promotions"
                className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 transition-colors hover:text-accent-strong"
              >
                Tout voir
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : promos.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {/* 5. NOUVEAUTÉS (Section bleue) */}
      {(loading || nouveautes.length > 0) && (
        <section className="relative bg-[#dcebf5] py-16 sm:py-24 dark:bg-[#1c2733]">
          <div className="container-page">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#6b8a9e]">
                  Tout juste arrivés
                </p>
                <h2 className="font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
                  Nouvelle collection
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : nouveautes.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {/* 6. TOUS LES PRODUITS (Fond blanc, typographie aérée) */}
      {(loading || products.length > 0) && (
        <section id="all-products" className="relative scroll-mt-24 bg-white py-16 sm:py-24">
          <div className="container-page">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Notre sélection
                </p>
                <h2 className="font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
                  À découvrir
                </h2>
                {!loading && (
                  <p className="mt-3 text-sm text-gray-500">
                    {totalProducts} produit{totalProducts > 1 ? "s" : ""} disponible{totalProducts > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {!loading && totalProducts > 0 && (
                <span className="text-xs font-medium text-gray-400">
                  Page {safeCurrentPage} sur {totalPages}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {loading ? (
                Array.from({ length: PRODUCTS_PER_PAGE }).map((_, i) => <ProductCardSkeleton key={i} />)
              ) : (
                displayedProducts.map((product) => <ProductCard key={product.id} product={product} />)
              )}
            </div>

            {/* PAGINATION */}
            {!loading && totalPages > 1 && (
              <div className="mt-16">
                <div className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0ede3]">
                        <span className="h-2.5 w-2.5 rounded-full bg-accent-strong" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Nos produits</p>
                        <p className="text-xs text-gray-500">
                          Affichage de <span className="font-bold text-accent-strong">{startIndex + 1}–{endIndex}</span> sur <span className="font-semibold">{totalProducts}</span> produits
                        </p>
                      </div>
                    </div>
                    <div className="rounded-full border border-gray-100 bg-gray-50 px-4 py-2">
                      <span className="text-xs font-semibold text-gray-900">Page {safeCurrentPage} / {totalPages}</span>
                    </div>
                  </div>
                  <div className="mb-6 h-px w-full bg-gray-100" />
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                      className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 sm:px-5"
                    >
                      <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                      <span className="hidden sm:inline">Précédent</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1)
                        .reduce<(number | "dots")[]>((res, page, idx, arr) => {
                          if (idx > 0 && page - arr[idx - 1] > 1) res.push("dots");
                          res.push(page);
                          return res;
                        }, [])
                        .map((page, idx) =>
                          page === "dots" ? (
                            <span key={`dots-${idx}`} className="flex h-10 w-8 items-center justify-center text-sm font-bold tracking-widest text-gray-300">···</span>
                          ) : (
                            <button
                              key={page}
                              type="button"
                              onClick={() => goToPage(page)}
                              className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all duration-300 ${
                                safeCurrentPage === page
                                  ? "bg-accent-strong text-white shadow-md"
                                  : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              {page}
                            </button>
                          )
                        )}
                    </div>
                    <button
                      type="button"
                      onClick={() => goToPage(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                      className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 sm:px-5"
                    >
                      <span className="hidden sm:inline">Suivant</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loading && totalProducts === 0 && (
              <div className="py-20 text-center">
                <p className="text-lg text-gray-500">Aucun produit disponible pour le moment.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </StoreLayout>
  );
}