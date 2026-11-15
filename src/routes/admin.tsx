import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  BadgePercent,
  ChevronLeft,
  Image,
  LayoutDashboard,
  ListTree,
  Menu,
  Package,
  ShoppingBag,
  Store,
  Bell,
  User,
  LogOut,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration : Bufanda" },
      {
        name: "description",
        content:
          "Administration Bufanda : catalogue, promotions et commandes.",
      },
      { property: "og:title", content: "Administration : Bufanda" },
      {
        property: "og:description",
        content: "Interface d'administration de la boutique Bufanda.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

// Seuil des alertes de stock
const LOW_STOCK_THRESHOLD = 5;

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/banners", label: "Bannières", icon: Image, exact: false },
  {
    to: "/admin/announcements",
    label: "Annonces",
    icon: Megaphone,
    exact: false,
  },
  { to: "/admin/produits", label: "Produits", icon: Package, exact: false },
  {
    to: "/admin/commandes",
    label: "Commandes",
    icon: ShoppingBag,
    exact: false,
  },
  {
    to: "/admin/promotions",
    label: "Promotions & coupons",
    icon: BadgePercent,
    exact: false,
  },
  {
    to: "/admin/categories",
    label: "Catégories",
    icon: ListTree,
    exact: false,
  },
  { to: "/admin/clients", label: "Clients", icon: User, exact: false },
  {
    to: "/admin/avis",
    label: "Avis clients",
    icon: MessageCircle,
    exact: false,
  },
  {
    to: "/admin/parametres",
    label: "Paramètres",
    icon: User,
    exact: false,
  },
] as const;

function AdminLayout() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.first_name
    ? `${profile.first_name}${
        profile?.last_name ? ` ${profile.last_name}` : ""
      }`
    : user?.email;

  const isAdmin = Boolean(user && profile && profile.role === "admin");

  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [navBadges, setNavBadges] = useState<Record<string, number>>({});

  // ==========================================
  // CHARGER LES NOTIFICATIONS NON LUES
  // ==========================================

  const loadUnreadNotifications = useCallback(async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);

    if (error) {
      console.error("Erreur chargement notifications :", error);
      return;
    }

    setUnreadNotifications(count ?? 0);
  }, []);

  // ==========================================
  // CHARGER LES BADGES DU SIDEBAR
  // ==========================================

  const loadNavBadges = useCallback(async () => {
    const countOf = async (
      build: () => any,
      label: string
    ): Promise<number> => {
      const { count, error } = await build();

      if (error) {
        console.warn(`Erreur badge ${label} :`, error);
        return 0;
      }

      return count ?? 0;
    };

    const [orders, reviews] = await Promise.all([
      // Commandes en attente
      countOf(
        () =>
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        "commandes"
      ),

      // Avis non approuvés
      countOf(
        () =>
          supabase
            .from("reviews")
            .select("id", { count: "exact", head: true })
            .is("is_approved", null),
        "avis"
      ),

      // Le stock faible peut être ajouté ici si nécessaire
      countOf(
        () =>
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .lte("stock_quantity", LOW_STOCK_THRESHOLD),
        "stock"
      ),
    ]);

    setNavBadges({
      "/admin/commandes": orders,
      "/admin/avis": reviews,
    });
  }, []);

  // ==========================================
  // CLIQUER SUR LA CLOCHE DE NOTIFICATIONS
  // ==========================================

  const handleNotificationsClick = async () => {
    // Masquer immédiatement le compteur
    setUnreadNotifications(0);

    // Marquer les notifications comme lues
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      console.error("Erreur notifications :", error);

      toast.error(
        "Impossible de marquer les notifications comme lues."
      );

      await loadUnreadNotifications();
      return;
    }

    // Actualiser le compteur
    await loadUnreadNotifications();

    // Ouvrir la page des notifications
    navigate({ to: "/admin/notifications" });
  };

  // ==========================================
  // SUPABASE REALTIME
  // NOTIFICATIONS + COMMANDES + AVIS
  // ==========================================

  useEffect(() => {
    if (!isAdmin) return;

    loadUnreadNotifications();
    loadNavBadges();

    const channel = supabase
      .channel("admin-live-updates")

      // NOUVELLES NOTIFICATIONS
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const row = payload.new as {
            title?: string;
            body?: string | null;
          };

          toast.info(row.title ?? "Nouvelle notification", {
            position: "bottom-right",
            icon: (
              <img
                src="/favicon.ico"
                alt=""
                className="h-5 w-5 rounded-sm object-contain"
              />
            ),
            ...(row.body ? { description: row.body } : {}),
          });

          loadUnreadNotifications();
          loadNavBadges();
        }
      )

      // MODIFICATION NOTIFICATIONS
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadUnreadNotifications();
        }
      )

      // SUPPRESSION NOTIFICATIONS
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadUnreadNotifications();
        }
      )

      // NOUVELLE COMMANDE
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        () => {
          loadNavBadges();
        }
      )

      // MODIFICATION COMMANDE
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          loadNavBadges();
        }
      )

      // SUPPRESSION COMMANDE
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
        },
        () => {
          loadNavBadges();
        }
      )

      // NOUVEL AVIS
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
        },
        () => {
          loadNavBadges();
        }
      )

      // APPROBATION / MODIFICATION AVIS
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reviews",
        },
        () => {
          loadNavBadges();
        }
      )

      // SUPPRESSION AVIS
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reviews",
        },
        () => {
          loadNavBadges();
        }
      )

      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Erreur connexion Supabase Realtime");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    isAdmin,
    loadUnreadNotifications,
    loadNavBadges,
  ]);

  // ==========================================
  // ACTUALISER LES BADGES AU CHANGEMENT DE PAGE
  // ==========================================

  useEffect(() => {
    if (!isAdmin) return;

    loadNavBadges();
  }, [pathname, isAdmin, loadNavBadges]);

  // ==========================================
  // AUTHENTIFICATION ET REDIRECTION
  // ==========================================

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname !== "/admin/login") {
        navigate({ to: "/admin/login" });
      }
      return;
    }

    if (
      (!profile || profile.role !== "admin") &&
      pathname !== "/admin/login"
    ) {
      navigate({ to: "/admin/login" });
    }
  }, [loading, user, profile, pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  // Page de connexion sans Sidebar ni Header
  if (pathname === "/admin/login") {
    return <Outlet />;
  }

  if (!user || !profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-500">Redirection…</p>
      </div>
    );
  }

  // ==========================================
  // INTERFACE ADMIN
  // ==========================================

  return (
    // 1. FOND GÉNÉRAL BLANC
    <div className="flex min-h-screen bg-white">

      {/* SIDEBAR */}
      <aside
        className={cn(
          // 2. BORDURE VERTE CLAIRE + FOND BLANC
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-green-100 bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative flex h-16 items-center gap-2 border-b border-green-100 px-5">
          {/* LOGO */}
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-extrabold text-[#123b25]">
            <span className="text-green-700">Bufanda</span>
          </span>

          <button
            className="ml-auto text-gray-500 hover:text-gray-900 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === to
              : pathname.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-green-50 text-green-800"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4" />

                {label}

                {(navBadges[to] ?? 0) > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-green-600 px-1.5 text-[11px] font-bold text-white shadow-sm">
                    {navBadges[to]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <Button
            variant="outline"
            className="w-full border-green-200 text-green-800 hover:bg-green-50 hover:text-green-900"
            asChild
          >
            <Link to="/">
              <Store className="h-4 w-4" />
              Voir la boutique
            </Link>
          </Button>
        </div>
      </aside>

      {/* OVERLAY MOBILE */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* CONTENU PRINCIPAL */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">

        {/* HEADER */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-green-100 bg-white/95 px-4 backdrop-blur-sm lg:px-8">

          <button
            className="text-gray-500 hover:text-gray-900 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="ml-auto flex items-center gap-3">

            {/* NOTIFICATIONS */}
            <button
              aria-label="Notifications"
              onClick={handleNotificationsClick}
              className="relative rounded-full p-2 text-gray-500 transition-colors hover:bg-green-50 hover:text-green-700"
            >
              <Bell className="h-5 w-5" />

              {unreadNotifications > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-green-600 px-0.5 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* MENU COMPTE */}
            <div className="relative">
              <button
                aria-label="Compte"
                onClick={() =>
                  setUserMenuOpen((s) => !s)
                }
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 text-sm transition-colors hover:bg-green-50"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">
                  {user?.email?.charAt(0).toUpperCase() ?? "U"}
                </span>

                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {displayName}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-green-100 bg-white shadow-lg">

                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate({ to: "/admin/parametres" });
                    }}
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Paramètres
                  </button>

                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      setUserMenuOpen(false);

                      try {
                        await signOut();
                        toast.success("Déconnecté");
                        navigate({ to: "/admin/login" });
                      } catch (e) {
                        console.error(e);
                        toast.error("Erreur déconnexion");
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>

                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE */}
        <main className="flex-1 bg-[#fcfbf9] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}