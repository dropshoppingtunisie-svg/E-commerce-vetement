import { Link } from "@tanstack/react-router";
import { Eye, Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/types";
import { discountPercent, isOnSale } from "@/data/products";
import { formatPrice } from "@/lib/placeholder";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";
import { Stars } from "./Stars";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, toggleWishlist, isWishlisted } = useStore();
  const liked = isWishlisted(product.id);
  const outOfStock = product.stock === 0;
  const hasVariants = product.variants.length > 0;
  const mainImage = product.images.find((img) => img.is_main) ?? product.images[0];
  const hoverImage = product.images.find((img) => img.id !== mainImage?.id);

  const quickAdd = () => {
    if (outOfStock || hasVariants) return;
    addItem({
      product_id: product.id,
      variant_id: null,
      slug: product.slug,
      name: product.name,
      variant_label: null,
      image: mainImage?.url ?? "",
      unit_price: product.price,
      compare_at_price: product.compare_at_price,
      max_stock: product.stock,
    });
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-border hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.28)]",
        outOfStock && "opacity-95",
      )}
    >
      <div className="relative overflow-hidden bg-surface">
        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
          {isOnSale(product) && (
            <span className="craft-label craft-label-sale shadow-sm ring-1 ring-black/5">
              -{discountPercent(product)}%
            </span>
          )}
          {product.is_new && (
            <span className="craft-label craft-label-new shadow-sm ring-1 ring-black/5">
              Nouveau
            </span>
          )}
          {outOfStock && (
            <span className="craft-label craft-label-muted shadow-sm ring-1 ring-black/5">
              Rupture
            </span>
          )}
        </div>

        {/* Image */}
        <Link
          to="/produit/$slug"
          params={{ slug: product.slug }}
          className="relative block aspect-square overflow-hidden"
          aria-label={product.name}
        >
          <img
            src={mainImage?.url}
            alt={mainImage?.alt ?? product.name}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-all duration-700 ease-out",
              "group-hover:scale-[1.04]",
              hoverImage && "group-hover:opacity-0",
            )}
          />
          {hoverImage && (
            <img
              src={hoverImage.url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100"
            />
          )}
          {/* Dégradé subtil en bas pour lisibilité du prix au survol */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </Link>

        {/* Actions rapides */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
            onClick={() => toggleWishlist(product.id)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card/95 backdrop-blur",
              "text-foreground shadow-sm transition-all duration-300",
              "hover:scale-105 hover:border-accent-strong hover:bg-accent-strong hover:text-accent-strong-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/50",
              liked && "border-accent-strong bg-accent-strong text-accent-strong-foreground",
            )}
          >
            <Heart className={cn("h-4 w-4 transition-transform", liked && "fill-current scale-110")} />
          </button>
          <Link
            to="/produit/$slug"
            params={{ slug: product.slug }}
            aria-label="Voir le produit"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card/95 backdrop-blur",
              "text-foreground shadow-sm",
              "translate-x-3 opacity-0 transition-all duration-300",
              "hover:border-accent-strong hover:bg-accent-strong hover:text-accent-strong-foreground",
              "group-hover:translate-x-0 group-hover:opacity-100",
              "focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/50",
            )}
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {product.brand}
        </p>

        <Link
          to="/produit/$slug"
          params={{ slug: product.slug }}
          className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-6 text-foreground transition-colors hover:text-accent-strong"
        >
          {product.name}
        </Link>

        <div className="mt-1.5 flex items-center gap-1.5">
          <Stars value={product.rating} />
          <span className="text-xs text-muted-foreground">({product.reviews_count})</span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold tracking-tight text-accent-strong">
            {formatPrice(product.price)}
          </span>
          {isOnSale(product) && (
            <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
              {formatPrice(product.compare_at_price!)}
            </span>
          )}
        </div>

        <div className="mt-3.5">
          {hasVariants && !outOfStock ? (
            <Link
              to="/produit/$slug"
              params={{ slug: product.slug }}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-2 rounded-lg",
                "bg-accent text-xs font-bold uppercase tracking-[0.1em] text-accent-foreground",
                "transition-all duration-300",
                "hover:bg-accent-strong hover:text-accent-strong-foreground hover:shadow-md",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/50",
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              Choisir
            </Link>
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={quickAdd}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-2 rounded-lg",
                "bg-accent text-xs font-bold uppercase tracking-[0.1em] text-accent-foreground",
                "transition-all duration-300",
                "hover:bg-accent-strong hover:text-accent-strong-foreground hover:shadow-md",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/50",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent disabled:hover:text-accent-foreground disabled:hover:shadow-none disabled:active:scale-100",
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? "Indisponible" : "Ajouter"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="aspect-square animate-pulse bg-surface" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-surface" />
        <div className="h-4 w-full animate-pulse rounded bg-surface" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
      </div>
    </div>
  );
}