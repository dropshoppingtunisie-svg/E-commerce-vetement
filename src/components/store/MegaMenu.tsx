
import { Link } from "@tanstack/react-router";

import {
  ChevronDown,
  MoreHorizontal,
  Home,
  Tag,
  ArrowRight,
} from "lucide-react";

import { useEffect, useState } from "react";

import { categoryTreeWithProducts } from "@/data/categories";

import { isOnSale } from "@/data/products";

import {
  fetchActiveProducts,
  fetchCategories,
} from "@/lib/catalog";

import { cn } from "@/lib/utils";

import type { CategoryNode } from "@/types";

export function MegaMenu() {
  const [open, setOpen] = useState<string | null>(null);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [hasPromos, setHasPromos] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([fetchCategories(), fetchActiveProducts()])
      .then(([categories, products]) => {
        if (!mounted) return;

        setTree(categoryTreeWithProducts(categories, products));
        setHasPromos(products.some(isOnSale));
      })
      .catch((err) =>
        console.error("load mega menu categories", err)
      );

    return () => {
      mounted = false;
    };
  }, []);

  const visibleCategories = tree.slice(0, 6);
  const remainingCategories = tree.slice(6);

  return (
    <nav className="relative hidden border-y border-border/70 bg-card lg:block">
      <div
        className="container-page flex items-center gap-2"
        onMouseLeave={() => setOpen(null)}
      >
        {/* ======================== ACCUEIL ======================== */}

        <Link
          to="/"
          onMouseEnter={() => setOpen(null)}
          className={cn(
            "relative flex shrink-0 items-center gap-2 whitespace-nowrap",
            "px-4 py-4 text-[15px] font-semibold transition-colors",
            "after:absolute after:inset-x-4 after:bottom-2.5",
            "after:h-0.5 after:origin-left after:scale-x-0",
            "after:bg-accent-strong after:transition-transform",
            "hover:text-accent-strong hover:after:scale-x-100",
            "text-foreground",
            "mr-5"
          )}
        >
          <Home className="h-[17px] w-[17px]" />

          <span>Accueil</span>
        </Link>

        {/* ======================== CATÉGORIES ======================== */}

        {visibleCategories.map((cat: CategoryNode) => (
          <div key={cat.id} className="static">
            <Link
              to="/categorie/$slug"
              params={{ slug: cat.slug }}
              onMouseEnter={() => setOpen(cat.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-4 text-[15px] font-semibold transition-colors",
                "after:absolute after:inset-x-4 after:bottom-2.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent-strong after:transition-transform hover:after:scale-x-100",
                open === cat.id
                  ? "text-accent-strong after:scale-x-100"
                  : "text-foreground hover:text-accent-strong"
              )}
            >
              {cat.name}

              {cat.children.length > 0 && (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Link>

            {/* ======================== MENU DÉROULANT ======================== */}

            {open === cat.id && cat.children.length > 0 && (
              <div className="absolute inset-x-0 top-full z-40 max-h-[75vh] overflow-y-auto border-b border-border bg-card shadow-pop">
                <div className="container-page grid gap-8 py-8 lg:grid-cols-[30rem_minmax(0,1fr)]">

                  {/* VISUEL DE LA CATÉGORIE */}

                  <Link
                    to="/categorie/$slug"
                    params={{ slug: cat.slug }}
                    onClick={() => setOpen(null)}
                    className="group relative flex min-h-56 flex-col justify-end overflow-hidden rounded-lg bg-surface p-5"
                  >
                    {cat.image_url && (
                      <>
                        <img
                          src={cat.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-foreground/5"
                        />
                      </>
                    )}

                    <span className="relative block">
                      <span
                        className={cn(
                          "block text-xs font-semibold uppercase tracking-[0.1em]",
                          cat.image_url
                            ? "text-background/85"
                            : "text-accent-strong"
                        )}
                      >
                        Sélection
                      </span>

                      <span
                        className={cn(
                          "mt-1 block font-display text-base font-semibold",
                          cat.image_url
                            ? "text-background"
                            : "text-foreground"
                        )}
                      >
                        {cat.name}
                      </span>

                      <span
                        className={cn(
                          "mt-1 line-clamp-2 block text-sm",
                          cat.image_url
                            ? "text-background/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {cat.description ??
                          "Nos meilleures offres du moment."}
                      </span>

                      <span
                        className={cn(
                          "mt-3 inline-block text-sm font-semibold group-hover:underline",
                          cat.image_url
                            ? "text-background"
                            : "text-accent-strong"
                        )}
                      >
                        Voir tout →
                      </span>
                    </span>
                  </Link>

                  {/* SOUS-CATÉGORIES */}

                  <div
                    className="grid grid-flow-col gap-x-5 gap-y-3"
                    style={{ gridTemplateRows: "repeat(4, auto)" }}
                  >
                    {(cat.children as CategoryNode[]).map(
                      (sub: CategoryNode) => (
                        <Link
                          key={sub.id}
                          to="/categorie/$slug"
                          params={{ slug: sub.slug }}
                          onClick={() => setOpen(null)}
                          className="flex items-center gap-3 border-b border-border/60 pb-1 transition-colors hover:text-accent-strong"
                        >
                          {sub.image_url && (
                            <img
                              src={sub.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-md object-cover"
                            />
                          )}

                          <span className="truncate font-display text-sm font-semibold text-foreground">
                            {sub.name}
                          </span>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ======================== AUTRES CATÉGORIES ======================== */}

        {remainingCategories.length > 0 && (
          <div className="static">
            <button
              type="button"
              onMouseEnter={() => setOpen("more")}
              aria-label="Voir les autres catégories"
              className={cn(
                "flex items-center gap-1 px-4 py-4 text-[15px] font-semibold transition-colors",
                open === "more"
                  ? "text-accent-strong"
                  : "text-foreground hover:text-accent-strong"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {open === "more" && (
              <div className="absolute inset-x-0 top-full z-40 max-h-[75vh] overflow-y-auto border-b border-border bg-card shadow-pop">
                <div className="container-page grid grid-cols-2 gap-x-8 gap-y-8 py-8 sm:grid-cols-3 lg:grid-cols-4">
                  {remainingCategories.map((cat: CategoryNode) => (
                    <div key={cat.id}>
                      <Link
                        to="/categorie/$slug"
                        params={{ slug: cat.slug }}
                        onClick={() => setOpen(null)}
                        className="flex items-center gap-2 border-b border-border/70 pb-2 font-display text-sm font-bold text-foreground transition-colors hover:text-accent-strong"
                      >
                        {cat.image_url && (
                          <img
                            src={cat.image_url}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover"
                          />
                        )}

                        <span className="truncate">{cat.name}</span>
                      </Link>

                      {cat.children.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {(cat.children as CategoryNode[]).map(
                            (sub: CategoryNode) => (
                              <li key={sub.id}>
                                <Link
                                  to="/categorie/$slug"
                                  params={{ slug: sub.slug }}
                                  onClick={() => setOpen(null)}
                                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent-strong"
                                >
                                  {sub.image_url && (
                                    <img
                                      src={sub.image_url}
                                      alt=""
                                      className="h-5 w-5 shrink-0 rounded object-cover"
                                    />
                                  )}

                                  <span className="truncate">
                                    {sub.name}
                                  </span>
                                </Link>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================== BOUTON PROMOS ======================== */}

        {hasPromos && (
          <Link
            to="/promotions"
            onMouseEnter={() => setOpen(null)}
            className={cn(
              "group relative ml-auto my-2 inline-flex shrink-0",
              "items-center justify-center gap-2",
              "overflow-hidden rounded-lg px-5 py-3",
              "bg-gradient-to-r from-accent-strong to-deep",
              "text-[13px] font-bold uppercase tracking-[0.08em]",
              "text-accent-strong-foreground",
              "shadow-sm transition-all duration-300",
              "hover:-translate-y-0.5 hover:shadow-lg",
              "active:translate-y-0"
            )}
          >
            <Tag className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />

            <span>Promos</span>

            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </nav>
  );
}
