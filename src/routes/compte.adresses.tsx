
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Home,
  Building2,
  Phone,
  UserRound,
  MapPinned,
  Mail,
  Check,
  X,
  Loader2,
  Map,
  ArrowRight,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

import { GOVERNORATES } from "@/data/governorates";
import type { Address } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/compte/adresses")({
  component: AccountAddresses,
});

// ============================================================
// CONSTANTS
// ============================================================

const emptyAddress: Address = {
  id: "",
  label: "",
  full_name: "",
  phone: "",
  line1: "",
  city: "",
  governorate: "Tunis",
  postal_code: "",
  is_default: false,
};

// ============================================================
// HELPERS
// ============================================================

function getAddressIcon(label: string) {
  const value = label.toLowerCase();

  if (value.includes("domicile") || value.includes("maison")) {
    return Home;
  }

  if (value.includes("travail") || value.includes("bureau")) {
    return Building2;
  }

  return MapPin;
}

// ============================================================
// ADDRESS FIELD
// ============================================================

function AddressField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  required = false,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-sm font-semibold text-foreground"
      >
        {label}
        {required && (
          <span className="ml-1 text-destructive">*</span>
        )}
      </Label>

      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}

        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 rounded-xl border-border/80 bg-background transition-all focus-visible:ring-2 ${
            Icon ? "pl-10" : ""
          }`}
        />
      </div>
    </div>
  );
}

// ============================================================
// ADDRESS CARD
// ============================================================

function AddressCard({
  address,
  onEdit,
  onDelete,
  deleting,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const AddressIcon = getAddressIcon(address.label);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6 ${
        address.is_default
          ? "border-primary/30 ring-1 ring-primary/10"
          : "border-border/70 hover:border-primary/25"
      }`}
    >
      {address.is_default && (
        <div className="absolute right-0 top-0">
          <div className="flex items-center gap-1.5 rounded-bl-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
            <Check className="h-3 w-3" />
            Adresse par défaut
          </div>
        </div>
      )}

      {/* HEADER */}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
              address.is_default
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary group-hover:bg-primary/15"
            }`}
          >
            <AddressIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-foreground">
              {address.label || "Adresse"}
            </h3>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Adresse de livraison
            </p>
          </div>
        </div>

        {/* ACTIONS */}

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Modifier cette adresse"
            className="h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Supprimer cette adresse"
            className="h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* DIVIDER */}

      <div className="my-5 border-t border-border/70" />

      {/* ADDRESS INFORMATION */}

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <span className="text-sm font-semibold text-foreground">
            {address.full_name || "Nom non renseigné"}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <div className="min-w-0 text-sm leading-relaxed text-muted-foreground">
            <p>{address.line1 || "Adresse non renseignée"}</p>

            <p>
              {[address.city, address.governorate]
                .filter(Boolean)
                .join(", ")}
              {address.postal_code
                ? ` — ${address.postal_code}`
                : ""}
            </p>
          </div>
        </div>

        {address.phone && (
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />

            <span className="text-sm text-muted-foreground">
              {address.phone}
            </span>
          </div>
        )}
      </div>

      {/* FOOTER */}

      <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
        <span className="text-xs font-medium text-muted-foreground">
          Informations de livraison
        </span>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-all hover:gap-2.5"
        >
          Modifier
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyAddresses({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-5 py-16 text-center">
      <div className="relative mb-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <MapPin className="h-9 w-9 text-primary" />
        </div>

        <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-foreground">
        Aucune adresse enregistrée
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Vous n'avez pas encore ajouté d'adresse de livraison.
        Ajoutez votre première adresse pour faciliter vos prochaines commandes.
      </p>

      <Button
        type="button"
        variant="accent"
        onClick={onAdd}
        className="mt-6 h-11 gap-2 rounded-xl px-5"
      >
        <Plus className="h-4 w-4" />
        Ajouter une adresse
      </Button>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function AccountAddresses() {
  const [list, setList] = useState<Address[]>([]);
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Address>(emptyAddress);

  // ----------------------------------------------------------
  // FORM HELPERS
  // ----------------------------------------------------------

  const setField = <K extends keyof Address>(
    field: K,
    value: Address[K]
  ) => {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreateDialog = () => {
    setDraft({
      ...emptyAddress,
      is_default: list.length === 0,
    });
    setOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setDraft({ ...address });
    setOpen(true);
  };

  // ----------------------------------------------------------
  // LOAD ADDRESSES
  // ----------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      if (!profile) {
        setList([]);

        if (mounted) {
          setLoading(false);
        }

        return;
      }

      try {
        const { data, error } = await supabase
          .from("addresses")
          .select("*")
          .eq("user_id", profile.id)
          .order("is_default", { ascending: false });

        if (error) throw error;

        if (!mounted) return;

        setList(
          (data ?? []).map((row) => ({
            id: row.id,
            label: row.label ?? "",
            full_name: row.full_name ?? "",
            phone: row.phone ?? "",
            line1: row.line1 ?? "",
            city: row.city ?? "",
            governorate: row.governorate ?? "",
            postal_code: row.postal_code ?? "",
            is_default: row.is_default ?? false,
          }))
        );
      } catch (error) {
        console.error("load addresses error:", error);
        toast.error("Impossible de charger vos adresses.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [profile]);

  // ----------------------------------------------------------
  // SAVE ADDRESS
  // ----------------------------------------------------------

  const save = async () => {
    if (!draft.label.trim() || !draft.line1.trim()) {
      toast.error("Le libellé et l'adresse sont obligatoires.");
      return;
    }

    if (!profile) {
      toast.error("Session expirée, reconnectez-vous.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        label: draft.label.trim(),
        full_name: draft.full_name.trim(),
        line1: draft.line1.trim(),
        city: draft.city.trim(),
        governorate: draft.governorate,
        phone: draft.phone.trim(),
        postal_code: draft.postal_code.trim(),
        is_default: draft.is_default,
      };

      if (draft.id) {
        const { error } = await supabase
          .from("addresses")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", profile.id);

        if (error) throw error;

        setList((previous) =>
          previous.map((address) =>
            address.id === draft.id
              ? { ...draft, ...payload }
              : payload.is_default
                ? { ...address, is_default: false }
                : address
          )
        );

        toast.success("Adresse mise à jour.");
      } else {
        const { data, error } = await supabase
          .from("addresses")
          .insert({
            user_id: profile.id,
            ...payload,
          })
          .select()
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error("Adresse non retournée par la base de données.");
        }

        setList((previous) => [
          ...(payload.is_default
            ? previous.map((address) => ({
                ...address,
                is_default: false,
              }))
            : previous),
          { ...data } as Address,
        ]);

        toast.success("Adresse ajoutée.");
      }

      setOpen(false);
      setDraft(emptyAddress);
    } catch (error) {
      console.error("save address error:", error);
      toast.error("Erreur lors de l'enregistrement de l'adresse.");
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // DELETE ADDRESS
  // ----------------------------------------------------------

  const deleteAddress = async (address: Address) => {
    if (!profile || deletingId) return;

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer l'adresse « ${address.label} » ?`
    );

    if (!confirmed) return;

    setDeletingId(address.id);

    try {
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", address.id)
        .eq("user_id", profile.id);

      if (error) throw error;

      setList((previous) =>
        previous.filter((item) => item.id !== address.id)
      );

      toast.success("Adresse supprimée.");
    } catch (error) {
      console.error("delete address error:", error);
      toast.error("Impossible de supprimer cette adresse.");
    } finally {
      setDeletingId(null);
    }
  };

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="space-y-7 pb-8">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Mes adresses
              </h1>

              {!loading && (
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {list.length} adresse{list.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Gérez vos adresses et vos informations de livraison.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="accent"
          onClick={openCreateDialog}
          className="h-11 gap-2 rounded-xl px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Ajouter une adresse
        </Button>
      </div>

      {/* INFORMATION BANNER */}

      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Navigation className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">
            Vos informations de livraison
          </p>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enregistrez vos adresses pour retrouver rapidement vos coordonnées
            lors de vos prochaines commandes. Vous pouvez modifier ou supprimer
            vos adresses à tout moment.
          </p>
        </div>
      </div>

      {/* ADDRESS LIST */}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-muted" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyAddresses onAdd={openCreateDialog} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {list.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEditDialog(address)}
              onDelete={() => void deleteAddress(address)}
              deleting={deletingId === address.id}
            />
          ))}
        </div>
      )}

      {/* ADD / EDIT DIALOG */}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (saving) return;

          setOpen(nextOpen);

          if (!nextOpen) {
            setDraft(emptyAddress);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-xl">

          {/* DIALOG HEADER */}

          <div className="border-b border-border/70 bg-muted/20 px-6 py-5">
            <DialogHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {draft.id ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </div>

              <DialogTitle className="text-xl font-bold">
                {draft.id ? "Modifier l'adresse" : "Nouvelle adresse"}
              </DialogTitle>

              <DialogDescription className="text-sm">
                {draft.id
                  ? "Modifiez les informations de votre adresse de livraison."
                  : "Ajoutez une nouvelle adresse pour vos prochaines commandes."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* FORM */}

          <div className="space-y-6 px-6 py-5">

            {/* GENERAL INFORMATION */}

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                </div>

                <h3 className="text-sm font-bold">
                  Informations générales
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AddressField
                  id="address-label"
                  label="Libellé"
                  value={draft.label}
                  onChange={(value) => setField("label", value)}
                  placeholder="Ex. : Domicile"
                  icon={MapPin}
                  required
                />

                <AddressField
                  id="address-fullname"
                  label="Nom complet"
                  value={draft.full_name}
                  onChange={(value) => setField("full_name", value)}
                  placeholder="Votre nom complet"
                  icon={UserRound}
                />
              </div>
            </div>

            <div className="border-t border-border/70" />

            {/* LOCATION */}

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPinned className="h-3.5 w-3.5" />
                </div>

                <h3 className="text-sm font-bold">
                  Localisation
                </h3>
              </div>

              <AddressField
                id="address-line1"
                label="Adresse complète"
                value={draft.line1}
                onChange={(value) => setField("line1", value)}
                placeholder="Rue, numéro, résidence..."
                icon={Map}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <AddressField
                  id="address-city"
                  label="Ville"
                  value={draft.city}
                  onChange={(value) => setField("city", value)}
                  placeholder="Ex. : Tunis"
                  icon={Building2}
                />

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Gouvernorat
                  </Label>

                  <Select
                    value={draft.governorate}
                    onValueChange={(value) =>
                      setField("governorate", value)
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/80 bg-background">
                      <SelectValue placeholder="Choisir un gouvernorat" />
                    </SelectTrigger>

                    <SelectContent className="max-h-72">
                      {GOVERNORATES.map((governorate) => (
                        <SelectItem
                          key={governorate}
                          value={governorate}
                        >
                          {governorate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <AddressField
                id="address-postal"
                label="Code postal"
                value={draft.postal_code}
                onChange={(value) => setField("postal_code", value)}
                placeholder="Ex. : 1000"
                icon={Mail}
              />
            </div>

            <div className="border-t border-border/70" />

            {/* CONTACT */}

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-3.5 w-3.5" />
                </div>

                <h3 className="text-sm font-bold">
                  Coordonnées
                </h3>
              </div>

              <AddressField
                id="address-phone"
                label="Téléphone"
                value={draft.phone}
                onChange={(value) => setField("phone", value)}
                placeholder="+216 XX XXX XXX"
                icon={Phone}
                type="tel"
              />
            </div>

            {/* DEFAULT ADDRESS */}

            <button
              type="button"
              onClick={() =>
                setField("is_default", !draft.is_default)
              }
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                draft.is_default
                  ? "border-primary/30 bg-primary/[0.06]"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  draft.is_default
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background"
                }`}
              >
                {draft.is_default && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Définir comme adresse par défaut
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Utiliser cette adresse automatiquement lors de vos commandes.
                </p>
              </div>
            </button>
          </div>

          {/* FOOTER */}

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="h-10 rounded-xl"
            >
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>

            <Button
              type="button"
              variant="accent"
              onClick={() => void save()}
              disabled={saving}
              className="h-10 gap-2 rounded-xl px-5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {draft.id ? "Enregistrer les modifications" : "Ajouter l'adresse"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
