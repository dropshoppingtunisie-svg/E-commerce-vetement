import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ArrowRight,
  Store,
  Loader2,
  KeyRound,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Connexion administrateur — Bufanda" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const { signIn, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleForgotPassword() {
    const address = email.trim();

    if (!address) {
      setEmailError("Saisissez votre adresse e-mail.");
      document.getElementById("admin-email")?.focus();
      toast.error("Saisissez votre adresse e-mail.");
      return;
    }

    setResettingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/admin/login`,
      });

      if (error) throw error;

      toast.success("Un e-mail de réinitialisation vous a été envoyé.");
    } catch (err) {
      console.error("admin password reset", err);

      const rawMessage = String(
        (err as { message?: string })?.message ?? "",
      ).toLowerCase();

      const isRateLimited =
        (err as { status?: number })?.status === 429 ||
        rawMessage.includes("rate limit") ||
        rawMessage.includes("too many") ||
        rawMessage.includes("over_email_send_rate_limit");

      toast.error(
        isRateLimited
          ? "Trop de demandes ont été envoyées récemment. Attendez quelques minutes avant de réessayer."
          : "Impossible d'envoyer l'e-mail de réinitialisation. Vérifiez l'adresse, puis réessayez.",
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanEmail = email.trim();

    setEmailError(
      cleanEmail ? "" : "L'adresse e-mail est obligatoire.",
    );

    setPasswordError(
      password ? "" : "Le mot de passe est obligatoire.",
    );

    if (!cleanEmail || !password) {
      document
        .getElementById(!cleanEmail ? "admin-email" : "admin-password")
        ?.focus();
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(cleanEmail, password);

      if (error) {
        console.error("admin signIn error:", error);

        setPasswordError("Adresse e-mail ou mot de passe incorrect.");

        document.getElementById("admin-password")?.focus();
        return;
      }

      // Vérification du rôle administrateur après authentification.
      const { data: sessionData } = await supabase.auth.getSession();

      const userId = sessionData.session?.user?.id;

      const { data: profile } = userId
        ? await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .maybeSingle()
        : { data: null };

      if (!profile || profile.role !== "admin") {
        await signOut();

        toast.error(
          "Ce compte n'a pas accès à l'administration.",
        );

        return;
      }

      toast.success("Connexion réussie !");

      window.location.href = "/admin";
    } catch (err) {
      console.error("Admin login error:", err);
      toast.error("Une erreur réseau est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fa] px-4 py-10">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-accent-strong/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_0.7px,transparent_0.7px)] [background-size:24px_24px] opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-strong text-white shadow-lg shadow-accent-strong/20">
            <Store className="h-8 w-8" strokeWidth={1.8} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            BUFANDA
          </h1>

          <p className="mt-2 text-sm font-medium tracking-[0.18em] text-gray-500">
            ESPACE ADMINISTRATEUR
          </p>
        </div>

        {/* Login card */}
        <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_20px_70px_-20px_rgba(15,23,42,0.18)]">
          {/* Card header */}
          <div className="border-b border-gray-100 px-7 pb-6 pt-8 sm:px-9">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-strong/10 text-accent-strong">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Bon retour !
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Connectez-vous à votre espace pour gérer votre boutique
              et accéder au tableau de bord.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Accès sécurisé
            </div>
          </div>

          {/* Form */}
          <div className="px-7 py-7 sm:px-9 sm:py-8">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5"
            >
              {/* Email */}
              <div className="space-y-2">
                <Label
                  htmlFor="admin-email"
                  className="text-sm font-semibold text-gray-700"
                >
                  Adresse e-mail
                </Label>

                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@bufanda.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={
                      emailError ? "admin-email-error" : undefined
                    }
                    className={`h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 text-sm transition-all focus-visible:bg-white ${
                      emailError
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "focus-visible:border-accent-strong"
                    }`}
                  />
                </div>

                {emailError && (
                  <p
                    id="admin-email-error"
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600"
                    role="alert"
                  >
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="admin-password"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Mot de passe
                  </Label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resettingPassword || loading}
                    className="text-xs font-semibold text-accent-strong transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resettingPassword ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Envoi en cours...
                      </span>
                    ) : (
                      "Mot de passe oublié ?"
                    )}
                  </button>
                </div>

                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                  <Input
                    id="admin-password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Entrez votre mot de passe"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={
                      passwordError
                        ? "admin-password-error"
                        : undefined
                    }
                    className={`h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 pr-12 text-sm transition-all focus-visible:bg-white ${
                      passwordError
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "focus-visible:border-accent-strong"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setPasswordVisible((visible) => !visible)
                    }
                    aria-label={
                      passwordVisible
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    {passwordVisible ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>

                {passwordError && (
                  <p
                    id="admin-password-error"
                    className="text-xs font-medium text-red-600"
                    role="alert"
                  >
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="accent"
                  disabled={loading || resettingPassword}
                  className="group h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-accent-strong/15 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Security information */}
            <div className="mt-7 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm">
                <KeyRound className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700">
                  Connexion réservée aux administrateurs
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Seuls les comptes autorisés peuvent accéder à
                  l'interface d'administration Bufanda.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 flex flex-col items-center justify-center gap-3 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-accent-strong"
          >
            <Store className="h-4 w-4" />
            Retour à la boutique
          </a>

          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Bufanda. Tous droits réservés.
          </p>
        </div>
      </div>
    </main>
  );
}
