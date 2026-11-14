import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  PackageSearch,
  Tag,
  Layers3,
  Wallet,
  CheckCircle2,
  Sparkles,
  X,
  ArrowUpDown,
  ShoppingBag,
  Filter,
} from "lucide-react";

import { StoreLayout } from "@/components/store/StoreLayout";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/store/ProductCard";

import {
  categoryPath,
  categoryWithDescendants,
  findCategoryBySlug,
} from "@/data/categories";

import {
  fetchActiveProducts,
  fetchCategories,
} from "@/lib/catalog";

import type { Product } from "@/types";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/categorie/$slug")({
  loader: async ({ params }) => {
    const categories = await fetchCategories();
    const category = findCategoryBySlug(params.slug, categories);

    if (!category) throw notFound();

    return {
      name: category.name,
      description: category.description ?? "",
      categories,
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Catégorie introuvable — Bufanda" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const title = `${loaderData.name} — Bufanda`;

    const description =
      loaderData.description ||
      `Tous nos produits ${loaderData.name} en Tunisie, paiement à la livraison.`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },

  component: CategoryPage,
});

const PAGE_SIZE = 6;

function CategoryPage() {
  const { slug } = Route.useParams();
  const { categories } = Route.useLoaderData();

  const category = findCategoryBySlug(slug, categories)!;

  const ids = useMemo(
    () => categoryWithDescendants(category.id, categories),
    [category.id, categories],
  );

  const path = categoryPath(category.id, categories);

  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id === category.id),
    [categories, category.id],
  );

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [priceRange, setPriceRange] = useState<number[]>([0, 1000]);
  const [brands, setBrands] = useState<string[]>([]);
  const [subCategoryIds, setSubCategoryIds] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);

  const [sort, setSort] = useState("popularite");
  const [page, setPage] = useState(1);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Chargement des produits
  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setPage(1);

    fetchActiveProducts()
      .then((data) => {
        if (mounted) {
          setAllProducts(data);
        }
      })
      .catch((err) => {
        console.error("load category products", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Produits de la catégorie
  const base = useMemo(
    () =>
      allProducts.filter(
        (p) => p.category_id && ids.includes(p.category_id),
      ),
    [allProducts, ids],
  );

  const maxPrice = Math.max(
    1000,
    ...base.map((p) => p.price),
  );

  // Réinitialisation des filtres au changement de catégorie
  useEffect(() => {
    setPriceRange([0, maxPrice]);
    setBrands([]);
    setSubCategoryIds([]);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, maxPrice]);

  // Marques disponibles
  const availableBrands = useMemo(
    () =>
      [
        ...new Set(
          base
            .map((p) => p.brand.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [base],
  );

  // Sous-catégories disponibles
  const availableSubCategories = useMemo(
    () =>
      subCategories
        .map((sub) => ({
          category: sub,
          ids: categoryWithDescendants(sub.id, categories),
        }))
        .filter(({ ids }) =>
          allProducts.some(
            (p) => p.category_id && ids.includes(p.category_id),
          ),
        ),
    [subCategories, categories, allProducts],
  );

  // Sous-catégories sélectionnées avec descendants
  const allowedSubCategoryIds = useMemo(() => {
    if (subCategoryIds.length === 0) return null;

    return new Set(
      subCategoryIds.flatMap((id) =>
        categoryWithDescendants(id, categories),
      ),
    );
  }, [subCategoryIds, categories]);

  // Filtrage et tri
  const filtered = useMemo(() => {
    const list = base.filter((p) => {
      if (
        p.price < (priceRange[0] ?? 0) ||
        p.price > (priceRange[1] ?? maxPrice)
      ) {
        return false;
      }

      if (
        allowedSubCategoryIds &&
        (!p.category_id ||
          !allowedSubCategoryIds.has(p.category_id))
      ) {
        return false;
      }

      if (
        brands.length > 0 &&
        !brands.includes(p.brand.trim())
      ) {
        return false;
      }

      if (inStockOnly && p.stock === 0) {
        return false;
      }

      if (
        onSaleOnly &&
        !(p.compare_at_price && p.compare_at_price > p.price)
      ) {
        return false;
      }

      return true;
    });

    switch (sort) {
      case "prix-asc":
        return [...list].sort((a, b) => a.price - b.price);

      case "prix-desc":
        return [...list].sort((a, b) => b.price - a.price);

      case "nouveaute":
        return [...list].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );

      case "note":
        return [...list].sort((a, b) => b.rating - a.rating);

      default:
        return [...list].sort(
          (a, b) => b.reviews_count - a.reviews_count,
        );
    }
  }, [
    base,
    priceRange,
    brands,
    allowedSubCategoryIds,
    inStockOnly,
    onSaleOnly,
    sort,
    maxPrice,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE),
  );

  const visible = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Nombre de filtres actifs
  const activeFiltersCount =
    brands.length +
    subCategoryIds.length +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0);

  const toggleBrand = (brand: string) => {
    setBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((b) => b !== brand)
        : [...prev, brand],
    );

    setPage(1);
  };

  const toggleSubCategory = (id: string) => {
    setSubCategoryIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id],
    );

    setPage(1);
  };

  const resetFilters = () => {
    setPriceRange([0, maxPrice]);
    setBrands([]);
    setSubCategoryIds([]);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setPage(1);
  };

  // Panneau des filtres
  const filtersPanel = (
    <div className="space-y-6">
      {/* Sous-catégories */}
      {availableSubCategories.length > 0 && (
        <FilterSection
          icon={<Layers3 className="h-4 w-4" />}
          title="Sous-catégories"
          count={subCategoryIds.length}
        >
          <div className="space-y-3">
            {availableSubCategories.map(({ category: sub }) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Checkbox
                    id={`sub-${sub.id}`}
                    checked={subCategoryIds.includes(sub.id)}
                    onCheckedChange={() =>
                      toggleSubCategory(sub.id)
                    }
                  />

                  <Label
                    htmlFor={`sub-${sub.id}`}
                    className="cursor-pointer truncate text-sm font-normal"
                  >
                    {sub.name}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Prix */}
      <FilterSection
        icon={<Wallet className="h-4 w-4" />}
        title="Fourchette de prix"
      >
        <Slider
          className="mt-2"
          min={0}
          max={maxPrice}
          step={10}
          value={priceRange}
          onValueChange={(value) => {
            setPriceRange(value);
            setPage(1);
          }}
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <span className="text-[10px] text-muted-foreground">
              Minimum
            </span>

            <p className="text-sm font-bold tabular-nums">
              {priceRange[0]} DT
            </p>
          </div>

          <span className="text-muted-foreground">—</span>

          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right">
            <span className="text-[10px] text-muted-foreground">
              Maximum
            </span>

            <p className="text-sm font-bold tabular-nums">
              {priceRange[1]} DT
            </p>
          </div>
        </div>
      </FilterSection>

      {/* Marques */}
      {availableBrands.length > 0 && (
        <FilterSection
          icon={<Tag className="h-4 w-4" />}
          title="Marques"
          count={brands.length}
        >
          <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
            {availableBrands.map((brand) => (
              <div
                key={brand}
                className="flex items-center gap-2.5"
              >
                <Checkbox
                  id={`brand-${brand}`}
                  checked={brands.includes(brand)}
                  onCheckedChange={() => toggleBrand(brand)}
                />

                <Label
                  htmlFor={`brand-${brand}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {brand}
                </Label>
              </div>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Disponibilité */}
      <FilterSection
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="Disponibilité"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="stock"
              checked={inStockOnly}
              onCheckedChange={(value) => {
                setInStockOnly(Boolean(value));
                setPage(1);
              }}
            />

            <Label
              htmlFor="stock"
              className="cursor-pointer text-sm font-normal"
            >
              En stock uniquement
            </Label>
          </div>

          <div className="flex items-center gap-2.5">
            <Checkbox
              id="sale"
              checked={onSaleOnly}
              onCheckedChange={(value) => {
                setOnSaleOnly(Boolean(value));
                setPage(1);
              }}
            />

            <Label
              htmlFor="sale"
              className="cursor-pointer text-sm font-normal"
            >
              En promotion
            </Label>
          </div>
        </div>
      </FilterSection>

      {/* Réinitialisation */}
      {activeFiltersCount > 0 && (
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={resetFilters}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );

  return (
    <StoreLayout>
      <div className="container-page py-6 pb-16">
        {/* Fil d'Ariane */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
        </nav>

        {/* En-tête */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent-strong/5 blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-strong/15 bg-accent-strong/5 px-3 py-1.5 text-xs font-bold text-accent-strong">
              <Sparkles className="h-3.5 w-3.5" />
              Collection Bufanda
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {category.name}
            </h1>

            {category.description && (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {category.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <ShoppingBag className="h-4 w-4 text-accent-strong" />

                <span className="font-bold">
                  {loading ? "…" : filtered.length}
                </span>

                <span className="text-muted-foreground">
                  produit{filtered.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <TruckIcon />

                <span className="font-medium">
                  Livraison en Tunisie
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Barre de résultats */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Découvrez nos produits
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Chargement des produits..."
                : `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} trouvé${filtered.length > 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtres mobiles */}
            <Sheet
              open={mobileFiltersOpen}
              onOpenChange={setMobileFiltersOpen}
            >
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="relative rounded-xl lg:hidden"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filtres

                  {activeFiltersCount > 0 && (
                    <span className="ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-bold text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="w-[320px] max-w-[90vw] overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-accent-strong" />
                    Filtrer les produits
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-7">
                  {filtersPanel}
                </div>

                <div className="sticky bottom-0 mt-6 border-t border-border bg-background pt-4">
                  <Button
                    variant="accent"
                    className="w-full rounded-xl"
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    Voir {filtered.length} produit
                    {filtered.length > 1 ? "s" : ""}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Tri */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />

              <Select
                value={sort}
                onValueChange={(value) => {
                  setSort(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[190px] rounded-xl bg-card">
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="popularite">
                    Popularité
                  </SelectItem>

                  <SelectItem value="nouveaute">
                    Nouveautés
                  </SelectItem>

                  <SelectItem value="prix-asc">
                    Prix croissant
                  </SelectItem>

                  <SelectItem value="prix-desc">
                    Prix décroissant
                  </SelectItem>

                  <SelectItem value="note">
                    Meilleures notes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Filtres actifs */}
        {activeFiltersCount > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
              Filtres actifs :
            </span>

            {brands.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => toggleBrand(brand)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-accent-strong hover:text-accent-strong"
              >
                {brand}
                <X className="h-3 w-3" />
              </button>
            ))}

            {subCategoryIds.map((id) => {
              const sub = categories.find((c) => c.id === id);

              if (!sub) return null;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSubCategory(id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-accent-strong hover:text-accent-strong"
                >
                  {sub.name}
                  <X className="h-3 w-3" />
                </button>
              );
            })}

            {inStockOnly && (
              <ActiveFilter
                label="En stock"
                onRemove={() => setInStockOnly(false)}
              />
            )}

            {onSaleOnly && (
              <ActiveFilter
                label="En promotion"
                onRemove={() => setOnSaleOnly(false)}
              />
            )}

            {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
              <ActiveFilter
                label={`${priceRange[0]} – ${priceRange[1]} DT`}
                onRemove={() => setPriceRange([0, maxPrice])}
              />
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="ml-1 text-xs font-bold text-accent-strong transition hover:underline"
            >
              Tout effacer
            </button>
          </div>
        )}

        {/* Contenu principal */}
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">
          {/* Sidebar desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-accent-strong" />

                  <h2 className="font-bold">
                    Filtres
                  </h2>
                </div>

                {activeFiltersCount > 0 && (
                  <span className="rounded-full bg-accent-strong/10 px-2 py-1 text-[10px] font-bold text-accent-strong">
                    {activeFiltersCount}
                  </span>
                )}
              </div>

              {filtersPanel}
            </div>
          </aside>

          {/* Produits */}
          <main className="min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-5 py-16 text-center">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-surface">
                  <PackageSearch className="h-9 w-9 text-muted-foreground" />
                </div>

                <h3 className="mt-6 text-lg font-bold">
                  Aucun produit trouvé
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Aucun produit ne correspond à vos critères.
                  Essayez de modifier vos filtres pour découvrir davantage de produits.
                </p>

                <Button
                  variant="accent"
                  className="mt-6 rounded-xl"
                  onClick={resetFilters}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Réinitialiser les filtres
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                  {visible.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pageCount > 1 && (
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Précédent
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: pageCount },
                        (_, i) => i + 1,
                      ).map((pageNumber) => (
                        <Button
                          key={pageNumber}
                          size="sm"
                          variant={
                            page === pageNumber
                              ? "accent"
                              : "outline"
                          }
                          className="h-9 min-w-9 rounded-xl px-3"
                          onClick={() => setPage(pageNumber)}
                        >
                          {pageNumber}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={page === pageCount}
                      onClick={() =>
                        setPage((p) =>
                          Math.min(pageCount, p + 1),
                        )
                      }
                    >
                      Suivant
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Résumé pagination */}
                {filtered.length > 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Affichage de{" "}
                    {Math.min(
                      (page - 1) * PAGE_SIZE + 1,
                      filtered.length,
                    )}{" "}
                    à {Math.min(page * PAGE_SIZE, filtered.length)}{" "}
                    sur {filtered.length} produits
                  </p>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </StoreLayout>
  );
}

// Section de filtre
function FilterSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-6 last:border-b-0 last:pb-0">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-accent-strong">
            {icon}
          </span>

          <h3 className="text-sm font-bold">
            {title}
          </h3>
        </div>

        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-accent-strong/10 px-2 py-0.5 text-[10px] font-bold text-accent-strong">
            {count}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

// Badge filtre actif
function ActiveFilter({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-accent-strong hover:text-accent-strong"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}

function TruckIcon() {
  return (
    <ShoppingBag className="h-4 w-4 text-accent-strong" />
  );
}