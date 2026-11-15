import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  Users, ShoppingBag, Wallet, RefreshCw, Search, X, UserRound, Mail, Phone,
  CalendarDays, ChevronLeft, ChevronRight, TrendingUp, ArrowUpDown,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/placeholder";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SortArrow from "@/components/ui/sort-arrow";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export const Route = createFileRoute("/admin/clients")({
  component: AdminClients,
});

type CustomerRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at?: string | null;
  order_count: number;
  total_spent: number;
};

type SortKey = "order_count" | "total_spent";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 10;

function getCustomerName(customer: CustomerRow): string {
  const name = [customer.first_name?.trim(), customer.last_name?.trim()].filter(Boolean).join(" ");
  return name || "Client";
}

function getCustomerInitials(customer: CustomerRow): string {
  const firstName = customer.first_name?.trim()?.[0] ?? "";
  const lastName = customer.last_name?.trim()?.[0] ?? "";
  const initials = `${firstName}${lastName}`.toUpperCase();
  return initials || "C";
}

function formatCustomerDate(date?: string | null): string {
  if (!date) return "—";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "—";
  return format(parsedDate, "dd MMM yyyy", { locale: fr });
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "dots")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: (number | "dots")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push("dots");
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < totalPages - 1) pages.push("dots");
  pages.push(totalPages);
  return pages;
}

function LoadingTableRow() {
  return (
    <TableRow>
      <TableCell colSpan={6} className="h-64 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Chargement des clients...</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyTableRow({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void; }) {
  return (
    <TableRow>
      <TableCell colSpan={6}>
        <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
            <Users className="h-7 w-7 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-[#123b25]">{hasSearch ? "Aucun client trouvé" : "Aucun client disponible"}</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">{hasSearch ? "Aucun client ne correspond à votre recherche. Essayez un autre terme." : "Les clients apparaîtront ici lorsqu'ils seront disponibles."}</p>
          {hasSearch && (<Button variant="outline" size="sm" className="mt-4 border-green-200 text-green-700 hover:bg-green-50" onClick={onReset}>Effacer la recherche</Button>)}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatCard({ title, value, description, icon: Icon, iconClassName }: { title: string; value: string | number; description: string; icon: LucideIcon; iconClassName: string; }) {
  return (
    <div className="group rounded-xl border border-green-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-[#123b25] sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminClients() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order_count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const loadCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_customers_list");
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []).map((customer: any): CustomerRow => ({
        id: String(customer.id),
        first_name: customer.first_name ?? null,
        last_name: customer.last_name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        created_at: customer.created_at ?? null,
        order_count: Math.max(0, Number(customer.order_count ?? 0)),
        total_spent: Number(customer.total_spent ?? 0),
      }));
      setCustomers(rows);
      if (isRefresh) toast.success("La liste des clients a été actualisée.");
    } catch (error) {
      console.error("load customers:", error);
      toast.error("Impossible de charger la liste des clients.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) => {
      const fullName = getCustomerName(customer).toLowerCase();
      const email = (customer.email ?? "").toLowerCase();
      const phone = (customer.phone ?? "").toLowerCase();
      const id = customer.id.toLowerCase();
      return fullName.includes(search) || email.includes(search) || phone.includes(search) || id.includes(search);
    });
  }, [customers, query]);

  const sortedCustomers = useMemo(() => {
    const result = [...filteredCustomers];
    result.sort((a, b) => {
      const modifier = sortDirection === "asc" ? 1 : -1;
      const left = a[sortKey] ?? 0;
      const right = b[sortKey] ?? 0;
      return (left - right) * modifier;
    });
    return result;
  }, [filteredCustomers, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDirection((current) => (current === "asc" ? "desc" : "asc")); return; }
    setSortKey(key); setSortDirection("desc");
  };

  const statistics = useMemo(() => {
    const totalCustomers = customers.length;
    const totalOrders = customers.reduce((total, customer) => total + customer.order_count, 0);
    const totalRevenue = customers.reduce((total, customer) => total + customer.total_spent, 0);
    const averageSpent = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    return { totalCustomers, totalOrders, totalRevenue, averageSpent };
  }, [customers]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = sortedCustomers.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, sortedCustomers.length);
  const pageCustomers = sortedCustomers.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  useEffect(() => { setCurrentPage(1); }, [query, sortKey, sortDirection]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  return (
    <div className="space-y-7 bg-white pb-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#123b25]">Clients</h1>
            <p className="mt-0.5 text-sm text-gray-500">Vue d'ensemble des clients et de leur historique d'achat.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadCustomers(true)} disabled={loading || refreshing} className="gap-2 self-start border-green-200 text-green-700 hover:bg-green-50 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Actualiser
        </Button>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total clients" value={statistics.totalCustomers} description="Clients enregistrés" icon={Users} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Total commandes" value={statistics.totalOrders} description="Commandes associées aux clients" icon={ShoppingBag} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Chiffre d'affaires" value={formatPrice(statistics.totalRevenue)} description="Total dépensé par les clients" icon={Wallet} iconClassName="bg-green-50 text-green-700" />
        <StatCard title="Dépense moyenne" value={formatPrice(statistics.averageSpent)} description="Moyenne par client" icon={TrendingUp} iconClassName="bg-green-50 text-green-700" />
      </div>

      {/* CUSTOMER LIST */}
      <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-[#123b25]">Liste des clients</h2>
              <p className="mt-0.5 text-xs text-gray-500">Consultez les informations et les achats de vos clients.</p>
            </div>
            <div className="rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">{filteredCustomers.length} résultat{filteredCustomers.length > 1 ? "s" : ""}</div>
          </div>

          {/* SEARCH */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par nom, e-mail, téléphone..." className="h-10 border-green-200 bg-gray-50 pl-9 pr-9 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100" />
            {query && (<button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700"><X className="h-4 w-4" /></button>)}
          </div>

          {/* ACTIVE SEARCH */}
          {query && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Recherche active :</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{query}<button type="button" onClick={() => setQuery("")} aria-label="Supprimer la recherche"><X className="h-3 w-3" /></button></span>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-50/50 hover:bg-green-50/50">
                <TableHead className="min-w-48 text-xs font-semibold uppercase tracking-wide text-green-700/70">Client</TableHead>
                <TableHead className="min-w-52 text-xs font-semibold uppercase tracking-wide text-green-700/70">E-mail</TableHead>
                <TableHead className="min-w-36 text-xs font-semibold uppercase tracking-wide text-green-700/70">Téléphone</TableHead>
                <TableHead className="min-w-36 text-xs font-semibold uppercase tracking-wide text-green-700/70">
                  <button type="button" onClick={() => toggleSort("order_count")} className="inline-flex items-center gap-2 font-medium text-green-700/70 transition hover:text-green-900">
                    <span>Commandes</span><SortArrow dir={sortKey === "order_count" ? sortDirection : null} ariaLabel="Trier par nombre de commandes" />
                  </button>
                </TableHead>
                <TableHead className="min-w-40 text-xs font-semibold uppercase tracking-wide text-green-700/70">
                  <button type="button" onClick={() => toggleSort("total_spent")} className="inline-flex items-center gap-2 font-medium text-green-700/70 transition hover:text-green-900">
                    <span>Total dépensé</span><SortArrow dir={sortKey === "total_spent" ? sortDirection : null} ariaLabel="Trier par total dépensé" />
                  </button>
                </TableHead>
                <TableHead className="min-w-36 text-xs font-semibold uppercase tracking-wide text-green-700/70">Date d'inscription</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <LoadingTableRow />
              ) : sortedCustomers.length === 0 ? (
                <EmptyTableRow hasSearch={Boolean(query.trim())} onReset={() => setQuery("")} />
              ) : (
                pageCustomers.map((customer) => (
                  <TableRow key={customer.id} className="group transition-colors hover:bg-green-50/30">
                    {/* CUSTOMER */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xs font-bold text-green-700">{getCustomerInitials(customer)}</div>
                        <div className="min-w-0">
                          <p className="max-w-48 truncate text-sm font-semibold text-[#123b25]">{getCustomerName(customer)}</p>
                          <p className="text-xs text-gray-400">Client</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* EMAIL */}
                    <TableCell>
                      {customer.email ? (
                        <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700"><Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" /><span className="max-w-52 truncate">{customer.email}</span></div>
                      ) : (<span className="text-sm text-gray-400">—</span>)}
                    </TableCell>

                    {/* PHONE */}
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" /><span className="whitespace-nowrap">{customer.phone}</span></div>
                      ) : (<span className="text-sm text-gray-400">—</span>)}
                    </TableCell>

                    {/* ORDER COUNT */}
                    <TableCell>
                      <div className="inline-flex items-center gap-2">
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-green-50 px-2 text-xs font-bold text-green-700">{customer.order_count}</span>
                        <span className="hidden text-xs text-gray-400 lg:inline">commande{customer.order_count > 1 ? "s" : ""}</span>
                      </div>
                    </TableCell>

                    {/* TOTAL SPENT */}
                    <TableCell><span className="whitespace-nowrap text-sm font-semibold text-[#123b25]">{formatPrice(customer.total_spent)}</span></TableCell>

                    {/* CREATED AT */}
                    <TableCell><div className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-500"><CalendarDays className="h-3.5 w-3.5 text-gray-400" />{formatCustomerDate(customer.created_at)}</div></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        {!loading && sortedCustomers.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-100 bg-green-50/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center text-sm text-gray-500 sm:text-left">Affichage <span className="font-semibold text-[#123b25]">{pageStart}–{pageEnd}</span> sur <span className="font-semibold text-[#123b25]">{sortedCustomers.length}</span> clients</div>
            {totalPages > 1 && (
              <Pagination className="mx-0 w-auto justify-center text-[#123b25] sm:justify-end">
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setCurrentPage((page) => Math.max(1, page - 1)); }} aria-disabled={safeCurrentPage === 1} className={safeCurrentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                  {pageNumbers.map((page, index) => page === "dots" ? (<PaginationItem key={`dots-${index}`}><span className="flex h-9 w-7 items-center justify-center text-sm text-gray-400">...</span></PaginationItem>) : (
                    <PaginationItem key={page}><PaginationLink href="#" isActive={safeCurrentPage === page} onClick={(event) => { event.preventDefault(); setCurrentPage(page); }} aria-label={`Page ${page}`} aria-current={safeCurrentPage === page ? "page" : undefined} className={safeCurrentPage === page ? "border-green-600 bg-green-50 text-green-700" : ""}>{page}</PaginationLink></PaginationItem>
                  ))}
                  <PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); setCurrentPage((page) => Math.min(totalPages, page + 1)); }} aria-disabled={safeCurrentPage === totalPages} className={safeCurrentPage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      {/* FOOTER INFORMATION */}
      {!loading && customers.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-green-100 bg-green-50/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500"><UserRound className="h-4 w-4 text-green-700" /><span>Données clients chargées depuis votre base de données.</span></div>
          <div className="text-xs text-gray-500">Tri : <span className="font-semibold text-[#123b25]">{sortKey === "order_count" ? "Nombre de commandes" : "Total dépensé"}</span>{" · "}{sortDirection === "desc" ? "Décroissant" : "Croissant"}</div>
        </div>
      )}
    </div>
  );
}