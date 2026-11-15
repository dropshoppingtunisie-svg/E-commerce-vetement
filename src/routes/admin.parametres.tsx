import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, Truck, X, Settings2, Store, Share2,
  ShieldCheck, MapPin, Mail, Phone, Instagram, Facebook, MessageCircle, Wallet,
  LockKeyhole, CircleCheck, Globe, Save, Sparkles,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/placeholder";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings, SITE_SETTINGS_ID, type SiteSettings } from "@/context/SiteSettingsContext";

export const Route = createFileRoute("/admin/parametres")({
  component: AdminParametres,
});

type SettingsForm = Omit<SiteSettings, "id" | "shipping_price"> & { shipping_price: string; };

const EMPTY_SETTINGS: SettingsForm = {
  phone: "", email: "", address: "", instagram_url: "", facebook_url: "", tiktok_url: "", whatsapp_url: "", shipping_price: "0",
};

const SOCIAL_FIELDS: { key: keyof SettingsForm; label: string; placeholder: string; icon: React.ElementType; description: string; }[] = [
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/votre_compte", icon: Instagram, description: "Votre profil Instagram" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/votre_page", icon: Facebook, description: "Votre page Facebook" },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://www.tiktok.com/@votre_compte", icon: Globe, description: "Votre compte TikTok" },
  { key: "whatsapp_url", label: "WhatsApp", placeholder: "https://wa.me/21671000000", icon: MessageCircle, description: "Votre lien WhatsApp" },
];

const MIN_PASSWORD_LENGTH = 8;

function normalizeUrl(value: string | null): { ok: boolean; value: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, value: "" };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return { ok: false, value: raw };
    return { ok: true, value: withScheme };
  } catch { return { ok: false, value: raw }; }
}

function PasswordField({ id, label, value, onChange, autoComplete, onEnter }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; onEnter?: () => void; }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#123b25]">{label}</Label>
      <div className="relative">
        <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }} className="h-11 rounded-xl border-green-200 bg-gray-50 pr-11 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
        <Button type="button" variant="ghost" size="icon" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode; }) {
  return (
    <li className={`flex items-center gap-2 transition-colors ${ok ? "text-green-600" : "text-gray-400"}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-green-50" : "bg-gray-100"}`}>
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      {children}
    </li>
  );
}

function AdminParametres() {
  const { user } = useAuth();
  const { settings, loading: loadingSettings, refresh: refreshSettings } = useSiteSettings();

  const [form, setForm] = useState<SettingsForm>(EMPTY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pwStep, setPwStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      phone: settings.phone ?? "", email: settings.email ?? "", address: settings.address ?? "",
      instagram_url: settings.instagram_url ?? "", facebook_url: settings.facebook_url ?? "",
      tiktok_url: settings.tiktok_url ?? "", whatsapp_url: settings.whatsapp_url ?? "",
      shipping_price: String(settings.shipping_price ?? 0),
    });
  }, [settings]);

  const setField = (key: keyof SettingsForm, value: string) => { setForm((prev) => ({ ...prev, [key]: value })); };

  const settingsDirty = useMemo(() => {
    const reference = settings ?? EMPTY_SETTINGS;
    return (Object.keys(EMPTY_SETTINGS) as (keyof SettingsForm)[]).some((key) => String(form[key] ?? "").trim() !== String(reference[key] ?? "").trim());
  }, [form, settings]);

  const saveSettings = async () => {
    const email = (form.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("L'adresse e-mail n'est pas valide."); return; }
    const shippingValue = Number(form.shipping_price);
    if (!Number.isFinite(shippingValue) || shippingValue < 0 || !/^\d+(\.\d{0,3})?$/.test(form.shipping_price.trim())) { toast.error("Le tarif de livraison n'est pas valide."); return; }
    const urls = {} as Record<keyof SettingsForm, string>;
    for (const field of SOCIAL_FIELDS) {
      const result = normalizeUrl(form[field.key]);
      if (!result.ok) { toast.error(`Le lien ${field.label} n'est pas une adresse valide.`); return; }
      urls[field.key] = result.value;
    }
    setSavingSettings(true);
    try {
      const clean = (value: string | null) => String(value ?? "").trim() || null;
      const payload = {
        phone: clean(form.phone), email: clean(form.email), address: clean(form.address),
        instagram_url: clean(urls.instagram_url), facebook_url: clean(urls.facebook_url),
        tiktok_url: clean(urls.tiktok_url), whatsapp_url: clean(urls.whatsapp_url),
        shipping_price: shippingValue,
      };
      const { error } = await supabase.from("site_settings").upsert({ id: settings?.id ?? SITE_SETTINGS_ID, ...payload }).select().maybeSingle();
      if (error) throw error;
      setForm((prev) => ({ ...prev, ...urls }));
      await refreshSettings();
      toast.success("Paramètres de la boutique mis à jour.");
    } catch (err) { console.error("saveSettings", err); toast.error("Erreur lors de l'enregistrement des paramètres."); }
    finally { setSavingSettings(false); }
  };

  const rules = useMemo(() => ({ length: nextPassword.length >= MIN_PASSWORD_LENGTH, different: nextPassword.length > 0 && nextPassword !== currentPassword, match: nextPassword.length > 0 && nextPassword === confirmPassword }), [nextPassword, confirmPassword, currentPassword]);
  const canSubmitPassword = rules.length && rules.different && rules.match;

  const resetPasswordFlow = () => { setPwStep(1); setCurrentPassword(""); setNextPassword(""); setConfirmPassword(""); };

  const verifyCurrentPassword = async () => {
    const email = user?.email as string | undefined;
    if (!email) { toast.error("Session expirée, reconnectez-vous."); return; }
    if (!currentPassword) { toast.error("Saisissez votre mot de passe actuel."); return; }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (error) { toast.error("Mot de passe actuel incorrect."); return; }
      setPwStep(2);
    } catch (err) { console.error("verifyCurrentPassword", err); toast.error("Vérification impossible pour le moment."); }
    finally { setVerifying(false); }
  };

  const changePassword = async () => {
    if (!canSubmitPassword) return;
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;
      resetPasswordFlow();
      toast.success("Mot de passe modifié.");
    } catch (err) { console.error("changePassword", err); toast.error("Impossible de modifier le mot de passe."); }
    finally { setSavingPassword(false); }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-7 bg-white pb-8">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-green-500/5 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-50 text-green-700 sm:h-14 sm:w-14"><Settings2 className="h-6 w-6 sm:h-7 sm:w-7" /></div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-green-700">Administration</span>
              <Sparkles className="h-3.5 w-3.5 text-green-700" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#123b25] sm:text-3xl">Paramètres</h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500">Gérez les informations de votre boutique, les frais de livraison et la sécurité de votre compte.</p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Store className="h-5 w-5" /></div>
            <div><p className="text-xs text-gray-500">Informations</p><p className="text-sm font-semibold text-[#123b25]">Boutique</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Truck className="h-5 w-5" /></div>
            <div><p className="text-xs text-gray-500">Configuration</p><p className="text-sm font-semibold text-[#123b25]">Livraison</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-green-50/50 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="text-xs text-gray-500">Protection</p><p className="text-sm font-semibold text-[#123b25]">Sécurité</p></div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <Tabs defaultValue="coordonnees" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl border border-green-100 bg-white p-1.5 sm:min-w-0">
            <TabsTrigger value="coordonnees" className="gap-2 rounded-lg px-4 py-2.5 text-sm text-gray-500 data-[state=active]:bg-green-700 data-[state=active]:text-white"><Store className="h-4 w-4" /><span>Coordonnées</span></TabsTrigger>
            <TabsTrigger value="livraison" className="gap-2 rounded-lg px-4 py-2.5 text-sm text-gray-500 data-[state=active]:bg-green-700 data-[state=active]:text-white"><Truck className="h-4 w-4" /><span>Livraison</span></TabsTrigger>
            <TabsTrigger value="securite" className="gap-2 rounded-lg px-4 py-2.5 text-sm text-gray-500 data-[state=active]:bg-green-700 data-[state=active]:text-white"><ShieldCheck className="h-4 w-4" /><span>Sécurité</span></TabsTrigger>
          </TabsList>
        </div>

        {/* COORDONNÉES */}
        <TabsContent value="coordonnees" className="mt-5 space-y-5">
          <Card className="overflow-hidden rounded-2xl border-green-100 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-green-50/50 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Store className="h-5 w-5" /></div>
                <div><CardTitle className="text-base text-[#123b25]">Coordonnées de la boutique</CardTitle><CardDescription className="mt-1 text-gray-500">Informations affichées dans le header, le footer et la page Contact.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {loadingSettings ? (<div className="py-8 text-center text-sm text-gray-400">Chargement des paramètres...</div>) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2.5">
                    <Label htmlFor="set-phone" className="font-semibold text-[#123b25]">Téléphone</Label>
                    <div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input id="set-phone" value={form.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} placeholder="+216 71 000 000" className="h-11 rounded-xl border-green-200 bg-gray-50 pl-10 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" /></div>
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="set-email" className="font-semibold text-[#123b25]">Adresse e-mail</Label>
                    <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input id="set-email" type="email" value={form.email ?? ""} onChange={(e) => setField("email", e.target.value)} placeholder="contact@Bufanda.tn" className="h-11 rounded-xl border-green-200 bg-gray-50 pl-10 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" /></div>
                  </div>
                  <div className="space-y-2.5 sm:col-span-2">
                    <Label htmlFor="set-address" className="font-semibold text-[#123b25]">Adresse physique</Label>
                    <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input id="set-address" value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} placeholder="Avenue Habib Bourguiba, Tunis" className="h-11 rounded-xl border-green-200 bg-gray-50 pl-10 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" /></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-green-100 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-green-50/50 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Share2 className="h-5 w-5" /></div>
                <div><CardTitle className="text-base text-[#123b25]">Réseaux sociaux</CardTitle><CardDescription className="mt-1 text-gray-500">Configurez les liens vers vos profils officiels.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                {SOCIAL_FIELDS.map(({ key, label, placeholder, icon: Icon, description }) => (
                  <div key={key} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gray-50 text-gray-500"><Icon className="h-4 w-4" /></div>
                      <div><Label htmlFor={`set-${key}`} className="font-semibold text-[#123b25]">{label}</Label><p className="text-[11px] text-gray-400">{description}</p></div>
                    </div>
                    <div className="relative"><Input id={`set-${key}`} type="text" inputMode="url" value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} className="h-11 rounded-xl border-green-200 bg-gray-50 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" /></div>
                  </div>
                ))}
              </div>
              <Alert className="mt-6 rounded-xl border-green-200 bg-green-50/50">
                <Globe className="h-4 w-4 text-green-700" />
                <AlertTitle className="text-sm font-semibold text-[#123b25]">Visibilité des réseaux sociaux</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed text-gray-500">Les réseaux sociaux sans lien configuré ne seront pas affichés dans le header et le footer de votre boutique.</AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-gray-100 bg-green-50/30 p-5 sm:flex-row sm:justify-between sm:px-6">
              <p className="text-xs text-gray-400">Les modifications seront visibles sur votre boutique.</p>
              <Button onClick={saveSettings} disabled={savingSettings || !settingsDirty || loadingSettings} className="h-10 w-full gap-2 rounded-xl bg-green-700 text-white hover:bg-green-800 sm:w-auto"><Save className="h-4 w-4" />{savingSettings ? "Enregistrement..." : "Enregistrer les modifications"}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* LIVRAISON */}
        <TabsContent value="livraison" className="mt-5 space-y-5">
          <Card className="overflow-hidden rounded-2xl border-green-100 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-green-50/50 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><Truck className="h-5 w-5" /></div>
                <div><CardTitle className="text-base text-[#123b25]">Frais de livraison</CardTitle><CardDescription className="mt-1 text-gray-500">Configurez le tarif appliqué aux commandes.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="shipping-price" className="font-semibold text-[#123b25]">Tarif de livraison</Label>
                  <div className="relative">
                    <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-700" />
                    <Input id="shipping-price" type="number" min="0" step="0.001" value={form.shipping_price ?? "0"} onChange={(e) => setField("shipping_price", e.target.value)} placeholder="7.000" className="h-12 rounded-xl border-green-200 bg-gray-50 pl-10 pr-12 text-base font-semibold focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">DT</span>
                  </div>
                  <p className="text-xs text-gray-400">Montant ajouté automatiquement au total de chaque commande.</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-green-200 bg-green-50/30 p-5">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-green-500/10 blur-2xl" />
                  <div className="relative flex items-center justify-between">
                    <div><p className="text-xs font-medium text-gray-500">Tarif actuellement saisi</p><p className="mt-2 text-3xl font-bold tracking-tight text-[#123b25]">{formatPrice(Number(form.shipping_price || 0))}</p></div>
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-green-100 text-green-700"><Wallet className="h-6 w-6" /></div>
                  </div>
                  <div className="relative mt-4 flex items-center gap-2 border-t border-green-200/50 pt-3"><CircleCheck className="h-4 w-4 text-green-600" /><span className="text-xs font-medium text-gray-500">{Number(form.shipping_price || 0) > 0 ? "Tarif de livraison actif" : "Livraison gratuite"}</span></div>
                </div>
              </div>
              <Alert className="rounded-xl border-green-200 bg-green-50/50">
                <Truck className="h-4 w-4 text-green-700" />
                <AlertTitle className="text-[#123b25]">{Number(form.shipping_price || 0) > 0 ? `Livraison facturée ${formatPrice(Number(form.shipping_price || 0))}` : "Livraison gratuite"}</AlertTitle>
                <AlertDescription className="text-gray-500">Un tarif unique est appliqué à toute la Tunisie et ajouté au montant total de chaque commande.</AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-gray-100 bg-green-50/30 p-5 sm:flex-row sm:justify-between sm:px-6">
              <p className="text-xs text-gray-400">Pensez à enregistrer vos modifications.</p>
              <Button onClick={saveSettings} disabled={savingSettings || !settingsDirty || loadingSettings} className="h-10 w-full gap-2 rounded-xl bg-green-700 text-white hover:bg-green-800 sm:w-auto"><Save className="h-4 w-4" />{savingSettings ? "Enregistrement..." : "Enregistrer les modifications"}</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* SÉCURITÉ */}
        <TabsContent value="securite" className="mt-5 space-y-5">
          <Card className="overflow-hidden rounded-2xl border-green-100 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-green-50/50 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700"><ShieldCheck className="h-5 w-5" /></div>
                <div><CardTitle className="text-base text-[#123b25]">Sécurité du compte</CardTitle><CardDescription className="mt-1 text-gray-500">Modifiez le mot de passe de votre compte administrateur.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-col gap-3 rounded-xl border border-green-100 bg-green-50/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700"><LockKeyhole className="h-5 w-5" /></div>
                  <div><p className="text-sm font-semibold text-[#123b25]">Compte administrateur</p><p className="mt-0.5 break-all text-xs text-gray-500">{user?.email ?? "Utilisateur non identifié"}</p></div>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"><ShieldCheck className="h-3.5 w-3.5" />Compte protégé</span>
              </div>
              <Separator />
              <div className="mx-auto max-w-xl space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-[#123b25]">Modification du mot de passe</span><span className="text-xs font-medium text-gray-400">Étape {pwStep} / 2</span></div>
                  <div className="flex gap-2"><div className={`h-1.5 flex-1 rounded-full transition-colors ${pwStep >= 1 ? "bg-green-700" : "bg-gray-100"}`} /><div className={`h-1.5 flex-1 rounded-full transition-colors ${pwStep >= 2 ? "bg-green-700" : "bg-gray-100"}`} /></div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 text-xs ${pwStep === 1 ? "font-semibold text-green-700" : "text-gray-400"}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${pwStep === 1 ? "bg-green-700 text-white" : "bg-green-50 text-green-700"}`}>{pwStep > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}</span>Vérification
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${pwStep === 2 ? "font-semibold text-green-700" : "text-gray-400"}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${pwStep === 2 ? "bg-green-700 text-white" : "bg-gray-100 text-gray-400"}`}>2</span>Nouveau mot de passe
                    </div>
                  </div>
                </div>
                {pwStep === 1 ? (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-green-100 bg-green-50/30 p-4">
                      <p className="text-sm font-semibold text-[#123b25]">Vérifiez votre identité</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">Pour protéger votre compte, saisissez votre mot de passe actuel avant de pouvoir le modifier.</p>
                    </div>
                    <PasswordField id="pw-current" label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" onEnter={verifyCurrentPassword} />
                    <div className="flex justify-end">
                      <Button onClick={verifyCurrentPassword} disabled={verifying || !currentPassword} className="h-10 w-full gap-2 rounded-xl bg-green-700 text-white hover:bg-green-800 sm:w-auto">{verifying ? "Vérification..." : "Continuer"}{!verifying && <ArrowRight className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2"><CircleCheck className="h-5 w-5 text-green-600" /><p className="text-sm font-semibold text-green-700">Identité vérifiée</p></div>
                      <p className="mt-1 text-xs text-gray-500">Vous pouvez maintenant définir un nouveau mot de passe.</p>
                    </div>
                    <PasswordField id="pw-next" label="Nouveau mot de passe" value={nextPassword} onChange={setNextPassword} autoComplete="new-password" />
                    <PasswordField id="pw-confirm" label="Confirmer le nouveau mot de passe" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" onEnter={changePassword} />
                    <div className="rounded-xl border border-green-100 bg-green-50/30 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Conditions du mot de passe</p>
                      <ul className="space-y-2 text-xs">
                        <Rule ok={rules.length}>Au moins {MIN_PASSWORD_LENGTH} caractères</Rule>
                        <Rule ok={rules.different}>Différent du mot de passe actuel</Rule>
                        <Rule ok={rules.match}>Les deux saisies sont identiques</Rule>
                      </ul>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Button variant="ghost" onClick={() => setPwStep(1)} disabled={savingPassword} className="h-10 rounded-xl text-gray-500 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />Retour</Button>
                      <Button onClick={changePassword} disabled={savingPassword || !canSubmitPassword} className="h-10 gap-2 rounded-xl bg-green-700 text-white hover:bg-green-800">{savingPassword ? "Modification..." : "Modifier le mot de passe"}{!savingPassword && <Check className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}