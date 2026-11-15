import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { AuthDialog } from "./AuthDialog";
import { AmbientCircles } from "./AmbientCircles";
import AnnouncementBar from "@/components/ui/AnnouncementBar";

function HeroTitle() {
  return (
    <section className="relative overflow-hidden bg-[#dcebc5] py-20 sm:py-28">
      {/* Formes organiques de fond avec animation de flottement */}
      <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-[#ded5b5]/70 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/3 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#c8e4df]/70 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#e6efce]/90 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="container-page relative z-10">
        <div className="flex justify-center text-center">
          <h1
            className="text-[18vw] leading-none text-foreground sm:text-[15vw] lg:text-[13rem] animate-in fade-in zoom-in duration-1000 ease-out"
            style={{
              fontFamily: '"Playfair Display", "Fraunces", Georgia, serif',
              fontWeight: 500,
              letterSpacing: "0.08em",
            }}
          >
            BUFANDA
          </h1>
        </div>
      </div>
    </section>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const router = useRouterState();
  const isHomePage = router.location.pathname === "/";

  return (
    <div className="store-layout relative isolate flex min-h-screen flex-col bg-[#fcfbf9]">
      <AmbientCircles />
      
      {/* 1. L'ANNONCE TOUT EN HAUT */}
      <AnnouncementBar />

      {/* 2. LE GRAND BUFANDA (Seulement sur l'accueil) */}
      {isHomePage && <HeroTitle />}

      {/* 3. LE HEADER (Menu, recherche, icônes) */}
      <Header />
      
      {/* 4. LE CONTENU DE LA PAGE */}
      <main className="relative z-10 flex-1">{children}</main>
      
      {/* 5. LE PIED DE PAGE */}
      <Footer />
      
      <CartDrawer />
      <AuthDialog />
    </div>
  );
}