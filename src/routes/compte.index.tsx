import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  BadgeCheck,
  KeyRound,
  CircleCheck,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 6;

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-sm font-semibold text-gray-700"
      >
        {label}
      </Label>

      <div className="relative">
        <LockKeyhole className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 pr-12 text-sm transition-all focus-visible:bg-white ${
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "focus-visible:border-accent-strong"
          }`}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={
            visible
              ? "Masquer le mot de passe"
              : "Afficher le mot de passe"
          }
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" />
          ) : (
            <Eye className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="text-xs font-medium text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export const Route = createFileRoute("/compte/")({
  component: AccountInfo,
});

function AccountInfo() {
  const { profile, user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);

  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});

  useEffect(() => {
    if (!profile) return;

    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setEmail(profile.email ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  const fullName =
    `${firstName} ${lastName}`.trim() || "Mon compte";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";

  const passwordRules = [
    {
      label: `Au moins ${MIN_PASSWORD_LENGTH} caractères`,
      valid: newPassword.length >= MIN_PASSWORD_LENGTH,
    },
    {
      label: "Différent de l'ancien mot de passe",
      valid:
        newPassword.length > 0 &&
        newPassword !== currentPassword,
    },
    {
      label: "Les deux saisies sont identiques",
      valid:
        newPassword.length > 0 &&
        newPassword === confirmPassword,
    },
  ];

  const validPasswordRules = passwordRules.filter(
    (rule) => rule.valid,
  ).length;

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!profile) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Informations enregistrées.");
    } catch (err) {
      console.error("save profile error:", err);
      toast.error("Impossible d'enregistrer les informations.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyPassword() {
    if (!currentPassword) {
      setPasswordErrors({
        current: "Saisissez votre mot de passe actuel.",
      });

      document.getElementById("current-password")?.focus();
      return;
    }

    if (!user?.email) {
      toast.error("Session expirée, reconnectez-vous.");
      return;
    }

    setVerifyingPassword(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error) {
        setPasswordErrors({
          current: "Mot de passe actuel incorrect.",
        });

        document.getElementById("current-password")?.focus();
        return;
      }

      setPasswordErrors({});
      setPasswordStep(2);
    } catch (error) {
      console.error("verify current password error:", error);
      toast.error("Vérification impossible pour le moment.");
    } finally {
      setVerifyingPassword(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordErrors({
        new: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
      });

      document.getElementById("new-password")?.focus();
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordErrors({
        new: "Le nouveau mot de passe doit être différent de l'ancien.",
      });

      document.getElementById("new-password")?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors({
        confirm: "Les mots de passe ne correspondent pas.",
      });

      document.getElementById("confirm-password")?.focus();
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStep(1);
      setPasswordErrors({});

      toast.success("Mot de passe mis à jour.");
    } catch (error) {
      console.error("update password error:", error);
      toast.error("Impossible de mettre à jour le mot de passe.");
    } finally {
      setChangingPassword(false);
    }
  }

  function resetPasswordFlow() {
    if (changingPassword || verifyingPassword) return;

    setPasswordStep(1);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({});
  }

  return (
    <div className="min-h-full space-y-7 pb-10">
      {/* ===================================================== */}
      {/* PAGE HEADER */}
      {/* ===================================================== */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent-strong">
            <UserRound className="h-4 w-4" />
            Mon espace
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Informations personnelles
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
            Gérez vos informations personnelles et les paramètres
            de sécurité de votre compte.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 sm:self-center">
          <ShieldCheck className="h-4 w-4" />
          Compte sécurisé
        </div>
      </div>

      {/* ===================================================== */}
      {/* PROFILE SUMMARY */}
      {/* ===================================================== */}

      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-accent-strong/[0.06] to-transparent sm:block" />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-strong text-xl font-bold text-white shadow-lg shadow-accent-strong/20">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {fullName}
              </h2>

              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Compte actif
              </span>
            </div>

            <p className="mt-1 truncate text-sm text-gray-500">
              {email || user?.email || "Adresse e-mail non renseignée"}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Gérez les coordonnées associées à votre compte Bufanda.
            </p>
          </div>

          <div className="hidden h-12 w-12 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-400 sm:flex">
            <UserRound className="h-6 w-6" />
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* PERSONAL INFORMATION */}
      {/* ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:px-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <UserRound className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900">
              Informations du profil
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Modifiez vos coordonnées personnelles.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            {/* First name */}
            <div className="space-y-2">
              <Label
                htmlFor="fn"
                className="text-sm font-semibold text-gray-700"
              >
                Prénom
              </Label>

              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                <Input
                  id="fn"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Votre prénom"
                  autoComplete="given-name"
                  className="h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 focus-visible:bg-white"
                />
              </div>
            </div>

            {/* Last name */}
            <div className="space-y-2">
              <Label
                htmlFor="ln"
                className="text-sm font-semibold text-gray-700"
              >
                Nom
              </Label>

              <div className="relative">
                <UserRound className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                <Input
                  id="ln"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Votre nom"
                  autoComplete="family-name"
                  className="h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 focus-visible:bg-white"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="em"
                className="text-sm font-semibold text-gray-700"
              >
                Adresse e-mail
              </Label>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                <Input
                  id="em"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  aria-describedby="email-locked"
                  className="h-12 rounded-xl border-gray-200 bg-gray-100/80 pl-11 text-gray-500 opacity-100"
                />

                <LockKeyhole className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              <p
                id="email-locked"
                className="flex items-center gap-1.5 text-xs text-gray-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Cette adresse ne peut pas être modifiée ici.
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label
                htmlFor="ph"
                className="text-sm font-semibold text-gray-700"
              >
                Téléphone
              </Label>

              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />

                <Input
                  id="ph"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX"
                  autoComplete="tel"
                  className="h-12 rounded-xl border-gray-200 bg-gray-50/70 pl-11 focus-visible:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Save footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-gray-400">
              Vos informations sont enregistrées de manière sécurisée.
            </p>

            <Button
              variant="accent"
              type="submit"
              className="h-11 rounded-xl px-6 font-semibold shadow-sm"
              disabled={saving || !profile}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  Enregistrer les modifications
                  <Check className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* ===================================================== */}
      {/* PASSWORD SECURITY */}
      {/* ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-gray-900">
                Sécurité du compte
              </h2>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Modifiez régulièrement votre mot de passe pour
                protéger votre compte.
              </p>
            </div>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <LockKeyhole className="h-3.5 w-3.5" />
              Sécurisé
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {/* Progress */}
          <div className="mx-auto mb-8 max-w-lg">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 text-xs font-semibold ${
                  passwordStep === 1
                    ? "text-accent-strong"
                    : "text-emerald-600"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    passwordStep === 1
                      ? "bg-accent-strong text-white"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {passwordStep === 1 ? (
                    "1"
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </span>

                <span>Vérification</span>
              </div>

              <div className="mx-2 h-px flex-1 bg-gray-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    passwordStep === 2
                      ? "w-full bg-emerald-500"
                      : "w-0"
                  }`}
                />
              </div>

              <div
                className={`flex items-center gap-2 text-xs font-semibold ${
                  passwordStep === 2
                    ? "text-accent-strong"
                    : "text-gray-400"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    passwordStep === 2
                      ? "bg-accent-strong text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  2
                </span>

                <span>Nouveau mot de passe</span>
              </div>
            </div>
          </div>

          {/* Step 1 */}
          {passwordStep === 1 ? (
            <div className="mx-auto max-w-lg space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                    <KeyRound className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Vérification de votre identité
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Pour continuer, saisissez votre mot de passe
                      actuel.
                    </p>
                  </div>
                </div>
              </div>

              <PasswordField
                id="current-password"
                label="Mot de passe actuel"
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);

                  if (passwordErrors.current) {
                    setPasswordErrors(({ current: _current, ...errors }) => errors);
                  }
                }}
                autoComplete="current-password"
                error={passwordErrors.current}
              />

              <div className="flex justify-end pt-2">
                <Button
                  variant="accent"
                  type="button"
                  onClick={handleVerifyPassword}
                  disabled={verifyingPassword || !currentPassword}
                  className="h-11 w-full rounded-xl px-6 font-semibold sm:w-auto"
                >
                  {verifyingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2 */
            <div className="mx-auto max-w-lg space-y-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <CircleCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Identité vérifiée
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      Vous pouvez maintenant choisir votre nouveau
                      mot de passe.
                    </p>
                  </div>
                </div>
              </div>

              <PasswordField
                id="new-password"
                label="Nouveau mot de passe"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);

                  if (passwordErrors.new) {
                    setPasswordErrors(({ new: _new, ...errors }) => errors);
                  }
                }}
                autoComplete="new-password"
                error={passwordErrors.new}
              />

              <PasswordField
                id="confirm-password"
                label="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);

                  if (passwordErrors.confirm) {
                    setPasswordErrors(({ confirm: _confirm, ...errors }) => errors);
                  }
                }}
                autoComplete="new-password"
                error={passwordErrors.confirm}
              />

              {/* Password rules */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">
                    Critères de sécurité
                  </p>

                  <span className="text-[11px] font-semibold text-gray-400">
                    {validPasswordRules}/3 validés
                  </span>
                </div>

                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${(validPasswordRules / 3) * 100}%`,
                    }}
                  />
                </div>

                <ul className="space-y-2.5">
                  {passwordRules.map((rule) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-2.5 text-xs ${
                        rule.valid
                          ? "font-medium text-emerald-600"
                          : "text-gray-500"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                          rule.valid
                            ? "bg-emerald-100"
                            : "bg-gray-200"
                        }`}
                      >
                        {rule.valid && (
                          <Check className="h-3 w-3" />
                        )}
                      </span>

                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetPasswordFlow}
                  disabled={changingPassword}
                  className="h-11 rounded-xl text-gray-600"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>

                <Button
                  variant="accent"
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="h-11 rounded-xl px-6 font-semibold"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    <>
                      Modifier le mot de passe
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================== */}
      {/* SECURITY FOOTER */}
      {/* ===================================================== */}

      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />

        <div>
          <p className="text-xs font-semibold text-gray-700">
            Protection de vos données
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            Vos informations personnelles et vos identifiants
            sont traités de manière sécurisée. Ne partagez jamais
            votre mot de passe avec une autre personne.
          </p>
        </div>
      </div>
    </div>
  );
}
