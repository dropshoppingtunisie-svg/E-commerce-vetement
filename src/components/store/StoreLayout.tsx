import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { AuthDialog } from "./AuthDialog";
import { AmbientCircles } from "./AmbientCircles";

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="store-layout relative isolate flex min-h-screen flex-col">
      <AmbientCircles />
      <Header />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <AuthDialog />
    </div>
  );
}