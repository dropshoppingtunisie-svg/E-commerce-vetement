
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
    <section className="relative overflow-hidden bg-[#dcebc5] py-16 sm:py-24">
      {/* Formes organiques de fond */}
      <div
        className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-[#ded5b5]/70 blur-3xl animate-pulse"
        style={{ animationDuration: "8s" }}
      />

      <div
        className="absolute top-1/3 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#c8e4df]/70 blur-3xl animate-pulse"
        style={{ animationDuration: "10s" }}
      />

      <div
        className="absolute top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#e6efce]/90 blur-3xl animate-pulse"
        style={{ animationDuration: "6s" }}
      />

      <div className="container-page relative z-10">
        <div className="flex justify-center">
          
          {/* Conteneur du titre et logo */}
          <div className="relative inline-flex flex-col items-center">

            {/* Titre BUFANDA */}
            <h1
              className="relative z-10 whitespace-nowrap text-[18vw] leading-none text-foreground sm:text-[15vw] lg:text-[13rem]"
              style={{
                fontFamily: '"Playfair Display", "Fraunces", Georgia, serif',
                fontWeight: 500,
                letterSpacing: "0.08em",
              }}
            >
              BUFANDA
            </h1>

            {/* Logo en dessous et à droite */}
            <div className="relative mt-2 ml-auto h-[110px] w-[110px] sm:h-[150px] sm:w-[150px] lg:h-[170px] lg:w-[170px]">

              <svg
                viewBox="0 0 120 120"
                className="h-full w-full"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Bufanda Knitwear Sets logo"
              >
                <defs>
                  <path
                    id="bufanda-seal-path"
                    d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"
                  />
                </defs>

                {/* Texte circulaire animé */}
                <g
                  style={{
                    transformOrigin: "60px 60px",
                    animation: "bufanda-spin 22s linear infinite",
                  }}
                >
                  <text
                    fontSize="11.5"
                    fontWeight="900"
                    fontFamily='"Playfair Display", Georgia, serif'
                    fill="#14110e"
                  >
                    <textPath
                      href="#bufanda-seal-path"
                      textLength="268"
                      lengthAdjust="spacing"
                    >
                      BUFANDA ✦ KNITWEAR ✦ SETS ✦
                    </textPath>
                  </text>
                </g>

                {/* Cercle noir central */}
                <circle
                  cx="60"
                  cy="60"
                  r="25"
                  fill="#14110e"
                />

                {/* Lettre B */}
                <text
                  x="60"
                  y="70"
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="900"
                  fontFamily='"Playfair Display", Georgia, serif'
                  fill="#dcebc5"
                >
                  B
                </text>
              </svg>

            </div>
          </div>
        </div>
      </div>

      {/* Animation */}
      <style>
        {`
          @keyframes bufanda-spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
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

      <main className="relative z-10 flex-1 bg-white">
        {children}
      </main>

      <Footer />

      <CartDrawer />

      <AuthDialog />
    </div>
  );
}
