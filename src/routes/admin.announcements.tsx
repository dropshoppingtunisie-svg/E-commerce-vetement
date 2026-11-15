import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Check,
  X,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/admin/announcements")({
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  message: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const db = supabase as any;

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    const { data, error } = await db
      .from("announcements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function resetForm() {
    setEditingId(null);
    setMessage("");
    setSortOrder(items.length);
    setActive(true);
    setError("");
    setSuccess("");
  }

  function editAnnouncement(item: Announcement) {
    setEditingId(item.id);
    setMessage(item.message);
    setSortOrder(item.sort_order);
    setActive(item.is_active);
    setSuccess("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) {
      setError("Veuillez saisir un message.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      message: message.trim(),
      sort_order: sortOrder,
      is_active: active,
    };

    const result = editingId
      ? await db.from("announcements").update(payload).eq("id", editingId)
      : await db.from("announcements").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSuccess(editingId ? "Annonce modifiée avec succès." : "Annonce ajoutée avec succès.");
    resetForm();
    await loadAnnouncements();
    setSaving(false);
  }

  async function toggleAnnouncement(item: Announcement) {
    setError("");
    setSuccess("");

    const { error } = await db
      .from("announcements")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(item.is_active ? "Annonce désactivée." : "Annonce activée.");
    await loadAnnouncements();
  }

  async function deleteAnnouncement(item: Announcement) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer cette annonce ?\n\n${item.message}`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error } = await db.from("announcements").delete().eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Annonce supprimée avec succès.");
    if (editingId === item.id) resetForm();
    await loadAnnouncements();
  }

  const activeCount = items.filter((item) => item.is_active).length;
  const inactiveCount = items.length - activeCount;

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* HEADER */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
              <Megaphone size={17} />
              BUFANDA / COMMUNICATION
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#123b25]">
              Annonces
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Gérez les messages affichés en haut de votre boutique.
            </p>
          </div>

          <button
            onClick={resetForm}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-green-800"
          >
            <Plus size={19} />
            Nouvelle annonce
          </button>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total annonces" value={items.length} icon={<Megaphone size={21} />} />
          <StatCard label="Annonces actives" value={activeCount} icon={<Eye size={21} />} />
          <StatCard label="Annonces désactivées" value={inactiveCount} icon={<EyeOff size={21} />} />
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {/* FORM */}
        <section className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5 md:p-6">
            <h2 className="text-lg font-bold text-[#123b25]">
              {editingId ? "Modifier l'annonce" : "Créer une annonce"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Écrivez le texte qui sera affiché dans la barre supérieure.
            </p>
          </div>

          <form onSubmit={saveAnnouncement} className="space-y-5 p-5 md:p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Contenu du message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Exemple : +216 95 147 455 — Livraison 24/48h — Paiement à la livraison partout en Tunisie"
                rows={3}
                maxLength={300}
                required
                className="w-full resize-y rounded-xl border border-green-200 bg-gray-50 p-4 text-sm outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Maximum 300 caractères</span>
                <span>{message.length}/300</span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full rounded-xl border border-green-200 bg-gray-50 px-4 py-3 outline-none focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Les petits nombres apparaissent en premier.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  État de l'annonce
                </label>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 font-medium transition ${
                    active
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  <span>{active ? "Annonce active" : "Annonce désactivée"}</span>
                  <span
                    className={`h-6 w-11 rounded-full p-1 transition ${
                      active ? "bg-green-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition ${
                        active ? "translate-x-5" : ""
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* PREVIEW */}
            <div className="overflow-hidden rounded-xl border border-green-200 shadow-sm">
              <div className="bg-green-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-green-100">
                Aperçu de l'annonce
              </div>
              <div className="bg-green-700 px-5 py-5 text-center text-sm font-medium text-white">
                {message.trim() || "Votre message apparaîtra ici..."}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5">
              <button
                type="submit"
                disabled={saving || !message.trim()}
                className="flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                {saving ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Ajouter l'annonce"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <X size={18} />
                  Annuler
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ANNOUNCEMENT LIST */}
        <section className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-bold text-[#123b25]">Liste des annonces</h2>
              <p className="mt-1 text-sm text-gray-500">Gérez toutes vos annonces enregistrées.</p>
            </div>
            <button
              onClick={loadAnnouncements}
              disabled={loading}
              title="Actualiser"
              className="rounded-xl border border-green-200 p-3 text-green-700 hover:bg-green-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-green-700" size={30} />
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center">
                <Megaphone className="mx-auto mb-3 text-gray-300" size={40} />
                <h3 className="font-semibold text-gray-700">Aucune annonce</h3>
                <p className="mt-1 text-sm text-gray-400">Créez votre première annonce.</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-green-50/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                        <ArrowUpDown size={12} className="mr-1 inline" />
                        Ordre {item.sort_order}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.is_active ? "Active" : "Désactivée"}
                      </span>
                    </div>

                    <p className="break-words font-medium leading-relaxed text-gray-800">
                      {item.message}
                    </p>

                    <p className="mt-2 text-xs text-gray-400">
                      Créée le {new Date(item.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => toggleAnnouncement(item)}
                      title={item.is_active ? "Désactiver" : "Activer"}
                      className={`rounded-xl p-3 transition ${
                        item.is_active
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      {item.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>

                    <button
                      onClick={() => editAnnouncement(item)}
                      title="Modifier"
                      className="rounded-xl bg-blue-50 p-3 text-blue-700 transition hover:bg-blue-100"
                    >
                      <Pencil size={18} />
                    </button>

                    <button
                      onClick={() => deleteAnnouncement(item)}
                      title="Supprimer"
                      className="rounded-xl bg-red-50 p-3 text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="rounded-xl bg-green-50 p-3 text-green-700">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-[#123b25]">{value}</p>
      </div>
    </div>
  );
}