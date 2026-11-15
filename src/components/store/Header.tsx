import { Link, useNavigate } from "@tanstack/react-router";
import { Facebook, Heart, Instagram, Menu, Search, ShoppingCart, User } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { categoryTreeWithProducts } from "@/data/categories";
import { fetchActiveProducts, fetchCategories } from "@/lib/catalog";
import { formatPrice } from "@/lib/placeholder";
import { cn } from "@/lib/utils";
import type { CategoryNode, Product } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MegaMenu } from "./MegaMenu";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.4 2.2 2 3.9 4.2 4.2v2.9c-1.5 0-2.9-.4-4.2-1.2v6.7a5.9 5.9 0 1 1-5.1-5.8v2.9a3 3 0 1 0 2.2 2.9V3h2.9Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.4.1.2 1.6 2.5 3.9 3.5.5.2 1 .4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

function HeaderActions({
  isCustomer, user, profile, openAuth, navigate, wishlist, count, setCartOpen,
}: {
  isCustomer: boolean;
  user: { email?: string | null } | null;
  profile: { first_name?: string | null; role?: string | null } | null;
  openAuth: (mode: "signin") => void;
  navigate: ReturnType<typeof useNavigate>;
  wishlist: unknown[];
  count: number;
  setCartOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {isCustomer ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium sm:block text-foreground/80">
            {profile?.first_name ?? user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/compte" })} aria-label="Mon compte" className="hover:bg-black/5 hover:text-accent-strong">
            <User className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="icon" aria-label="Se connecter" onClick={() => openAuth("signin")} className="hover:bg-black/5 hover:text-accent-strong">
          <User className="h-5 w-5" />
        </Button>
      )}

      <Button variant="ghost" size="icon" asChild aria-label="Mes favoris" className="relative hover:bg-black/5 hover:text-accent-strong">
        <Link to="/favoris">
          <Heart className="h-5 w-5" />
          {wishlist.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
              {wishlist.length}
            </span>
          )}
        </Link>
      </Button>

      <button
        onClick={() => setCartOpen(true)}
        aria-label="Ouvrir le panier"
        className="relative grid h-10 w-10 place-items-center rounded-md transition-colors hover:bg-black/5 hover:text-accent-strong"
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-bold text-accent-strong-foreground">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}

export function Header() {
  const { count, setCartOpen, wishlist } = useStore();
  const { user, profile, isCustomer, openAuth } = useAuth();
  const { settings } = useSiteSettings();
  const [query, setQuery] = useState("");
  const [searchReady, setSearchReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchCategories(), fetchActiveProducts()])
      .then(([categories, activeProducts]) => {
        if (!mounted) return;
        setProducts(activeProducts);
        setTree(categoryTreeWithProducts(categories, activeProducts));
      })
      .catch((err) => console.error("load header catalog", err));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setQuery("");
    setSearchReady(false);
  }, [user?.id]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, query]);

  const socialLinks = useMemo(() => {
    const all: {
      key: string; href: string | null | undefined; label: string; Icon: ComponentType<{ className?: string }>;
    }[] = [
      { key: "instagram", href: settings?.instagram_url, label: "Instagram", Icon: Instagram },
      { key: "facebook", href: settings?.facebook_url, label: "Facebook", Icon: Facebook },
      { key: "tiktok", href: settings?.tiktok_url, label: "TikTok", Icon: TikTokIcon },
      { key: "whatsapp", href: settings?.whatsapp_url, label: "WhatsApp", Icon: WhatsAppIcon },
    ];
    return all.flatMap((link) => link.href?.trim() ? [{ ...link, href: link.href.trim() }] : []);
  }, [settings]);

  return (
    // FOND TRANSPARENT (Vert Sauge) avec EFFET DE FLOU
    <header className="sticky top-0 z-50 bg-[#dcebc5]/85 backdrop-blur-md border-b border-[#c9d6b5]/50 transition-all duration-300">
      <div className="container-page">
        {/* DESKTOP */}
        <div className="hidden h-20 items-center justify-between gap-8 lg:flex">
          <button 
            className="text-foreground hover:text-accent-strong transition-colors" 
            aria-label="Ouvrir le menu" 
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Barre de recherche centrale */}
          <div className="relative flex-1 max-w-2xl mx-auto">
            <Input
              name="search"
              autoComplete="off"
              readOnly={!searchReady}
              onFocus={() => setSearchReady(true)}
              data-lpignore="true"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une pièce, une marque..."
              // Fond de la recherche ajusté pour coller au header
              className="h-11 w-full rounded-full border-transparent bg-white/60 px-5 pr-14 text-sm shadow-sm transition-all focus:bg-white focus:border-white focus:ring-0 placeholder:text-foreground/50"
              aria-label="Rechercher"
            />
            <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition-colors hover:bg-accent-strong">
              <Search className="h-3.5 w-3.5" />
            </span>

            {query.trim().length > 0 && (
              <div className="absolute inset-x-0 top-full z-50 mt-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                {results.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Aucun résultat pour « {query} »
                  </p>
                ) : (
                  <ul>
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            setQuery("");
                            navigate({ to: "/produit/$slug", params: { slug: p.slug } });
                          }}
                          className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <img src={p.images[0]?.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-sm text-foreground">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">{p.brand}</span>
                          </span>
                          <span className="font-semibold text-accent-strong">{formatPrice(p.price)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <HeaderActions
            isCustomer={isCustomer}
            user={user}
            profile={profile}
            openAuth={openAuth}
            navigate={navigate}
            wishlist={wishlist}
            count={count}
            setCartOpen={setCartOpen}
          />
        </div>

        {/* MOBILE */}
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 lg:hidden">
          <div className="flex items-center">
            <button className="text-foreground" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <div className="flex justify-center"></div>
          <HeaderActions
            isCustomer={isCustomer}
            user={user}
            profile={profile}
            openAuth={openAuth}
            navigate={navigate}
            wishlist={wishlist}
            count={count}
            setCartOpen={setCartOpen}
          />
        </div>

        {/* RECHERCHE MOBILE */}
        <div className="pb-4 lg:hidden">
          <div className="relative">
            <Input
              name="search"
              autoComplete="off"
              readOnly={!searchReady}
              onFocus={() => setSearchReady(true)}
              data-lpignore="true"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="h-10 w-full rounded-full border-transparent bg-white/60 px-4 pr-12 text-sm shadow-sm placeholder:text-foreground/50"
              aria-label="Rechercher"
            />
            <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-foreground text-background">
              <Search className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      <MegaMenu />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b border-gray-100 px-5 py-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-3 py-2">
            <Accordion type="multiple">
              {tree.map((cat: CategoryNode) => {
                const subCategories: CategoryNode[] = cat.children ?? [];
                return (
                  <AccordionItem key={cat.id} value={cat.id} className="border-none">
                    <AccordionTrigger className="text-sm font-semibold hover:text-primary">{cat.name}</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 pl-2 border-l border-gray-100 ml-2">
                        <li>
                          <Link
                            to="/categorie/$slug"
                            params={{ slug: cat.slug }}
                            onClick={() => setMobileOpen(false)}
                            className="block py-1.5 pl-4 text-sm font-medium text-accent-strong hover:text-primary"
                          >
                            Tout {cat.name}
                          </Link>
                        </li>
                        {subCategories.map((sub) => (
                          <li key={sub.id}>
                            <Link
                              to="/categorie/$slug"
                              params={{ slug: sub.slug }}
                              onClick={() => setMobileOpen(false)}
                              className="block py-1.5 pl-4 text-sm text-gray-600 hover:text-primary"
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="mt-6 space-y-1 border-t border-gray-100 pt-4">
              <Link to="/promotions" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-semibold text-accent-strong hover:text-primary">
                Promotions
              </Link>
              <Link to="/compte" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-primary">
                Mon compte
              </Link>
              <Link to="/favoris" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-primary">
                Mes favoris
              </Link>
            </div>

            {socialLinks.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Suivez-nous</p>
                <div className="flex items-center gap-3">
                  {socialLinks.map(({ key, href, label, Icon }) => (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-9 w-9 place-items-center rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-primary hover:text-white">
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}