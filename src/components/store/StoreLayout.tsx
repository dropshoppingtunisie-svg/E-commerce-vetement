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
      {/* Formes organiques de fond (Ambiance générale) */}
      <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-[#ded5b5]/70 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/3 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#c8e4df]/70 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#e6efce]/90 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="container-page relative z-10">
        <div className="flex justify-center text-center">
          
          {/* CONTENEUR RELATIF : C'est la boîte exacte du texte */}
          <div className="relative inline-block">
            
            {/* ======================================================= */}
            {/* CERCLE DERRIÈRE LE "B"                                   */}
            {/* Placé à gauche (left-[8%]) et un peu vers le haut        */}
            {/* ======================================================= */}
            <div
              aria-hidden="true"
              className="absolute left-[8%] top-[60%] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#cdbb9e]/80"
            />

            {/* ======================================================= */}
            {/* CERCLE DERRIÈRE LE "N"                                   */}
            {/* Placé à droite (left-[68%]) et PLUS BAS (top-[55%])      */}
            {/* ======================================================= */}
            <div
              aria-hidden="true"
              className="absolute left-[78%] top-[25%] h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#cdbb9e]/80"
            />

            {/* LE TEXTE BUFANDA */}
            <h1
              className="relative z-10 text-[18vw] leading-none text-foreground sm:text-[15vw] lg:text-[13rem]"
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
      </div>
    </section>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const router = useRouterState();
  const isHomePage = router.location.pathname === "/";

  return (
    <div className="store-layout relative isolate flex min-h-screen flex-col bg-white">
      <AmbientCircles />
      
      <AnnouncementBar />
      {isHomePage && <HeroTitle />}
      <Header />
      <main className="relative z-10 flex-1 bg-white">{children}</main>
      <Footer />
      <CartDrawer />
      <AuthDialog />
    </div>
  );
}