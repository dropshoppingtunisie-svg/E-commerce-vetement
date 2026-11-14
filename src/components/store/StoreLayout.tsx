
import type { ReactNode } from "react";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { AuthDialog } from "./AuthDialog";

/**
 * Background décoratif avec des cercles flottants.
 * Il est partagé par toutes les pages du StoreLayout.
 */
function AmbientBackground() {
  return (
    <div className="ambient-background" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className={`ambient-circle ambient-circle-${index + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * Layout principal de la boutique.
 */
export function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="store-layout flex min-h-screen flex-col bg-background">
      {/* Background animé global */}
      <AmbientBackground />

      {/* En-tête */}
      <Header />

      {/* Contenu des pages */}
      <main className="relative z-10 flex-1">
        {children}
      </main>

      {/* Pied de page */}
      <Footer />

      {/* Panneaux et fenêtres */}
      <CartDrawer />
      <AuthDialog />
    </div>
  );
}
