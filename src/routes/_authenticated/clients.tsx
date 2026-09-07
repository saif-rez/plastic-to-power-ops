import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, Receipt, Euro, AlertCircle, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchInput, Section, StatCard, StatusBadge, EmptyState, TableSkeleton, ConfirmDelete, invoiceStatus } from "@/components/shared";
import { FormDialog, TextField, TextAreaField, SelectField, Grid2, Field } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients & factures — PolyCable Manager" },
      { name: "description", content: "Gestion des clients, historique et factures avec statut de paiement." },
      { property: "og:title", content: "Clients & factures — PolyCable Manager" },
      { property: "og:description", content: "Suivi commercial et facturation de l'usine." },
    ],
  }),
  component: ClientsPage,
});

type Client = { id: string; company: string; contact_name: string; email: string; phone: string; address: string; city: string; notes: string; created_at: string };
type Invoice = { id: string; invoice_number: string; client_id: string; issue_date: string; due_date: string; status: string; total: number };

const emptyClient = { company: "", contact_name: "", email: "", phone: "", address: "", city: "", notes: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientDialog, setClientDialog] = useState<{ open: boolean; edit?: Client }>({ open: false });
  const [clientForm, setClientForm] = useState(emptyClient);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [detail, setDetail] = useState<Client | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState<{ open: boolean; edit?: Invoice }>({ open: false });
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: "", client_id: "", issue_date: todayISO(), due_date: todayISO(), status: "en_attente", total: "0" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("company");
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").order("issue_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const byClient = useMemo(() => {
    const m = new Map<string, { count: number; total: number; unpaid: number }>();
    invoices.forEach((i) => {
      const cur = m.get(i.client_id) ?? { count: 0, total: 0, unpaid: 0 };
      m.set(i.client_id, {
        count: cur.count + 1,
        total: cur.total + Number(i.total),
        unpaid: cur.unpaid + (i.status === "paye" ? 0 : Number(i.total)),
      });
    });
    return m;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => `${c.company} ${c.contact_name} ${c.city} ${c.email}`.toLowerCase().includes(q));
  }, [clients, search]);

  const saveClient = useMutation({
    mutationFn: async () => {
      if (clientDialog.edit) {
        const { error } = await supabase.from("clients").update(clientForm).eq("id", clientDialog.edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(clientForm);
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "client", message: `Nouveau client : ${clientForm.company}` });
      }
    },
    onSuccess: () => {
      toast.success(clientDialog.edit ? "Client mis à jour" : "Client ajouté");
      setClientDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client supprimé");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveInvoice = useMutation({
    mutationFn: async () => {
      const payload = { ...invoiceForm, total: Number(invoiceForm.total) };
      if (invoiceDialog.edit) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", invoiceDialog.edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "facture", message: `Facture ${payload.invoice_number} émise (${formatCurrency(payload.total)})` });
      }
    },
    onSuccess: () => {
      toast.success("Facture enregistrée");
      setInvoiceDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture supprimée");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const openNewClient = () => {
    setClientForm(emptyClient);
    setClientDialog({ open: true });
  };
  const openEditClient = (c: Client) => {
    const { company, contact_name, email, phone, address, city, notes } = c;
    setClientForm({ company, contact_name, email, phone, address, city, notes });
    setClientDialog({ open: true, edit: c });
  };
  const openNewInvoice = (clientId?: string) => {
    const next = `FAC-${new Date().getFullYear()}-${String(invoices.length + 101).padStart(4, "0")}`;
    setInvoiceForm({ invoice_number: next, client_id: clientId ?? clients[0]?.id ?? "", issue_date: todayISO(), due_date: todayISO(), status: "en_attente", total: "0" });
    setInvoiceDialog({ open: true });
  };
  const openEditInvoice = (i: Invoice) => {
    setInvoiceForm({ invoice_number: i.invoice_number, client_id: i.client_id, issue_date: i.issue_date, due_date: i.due_date, status: i.status, total: String(i.total) });
    setInvoiceDialog({ open: true, edit: i });
  };

  const totalRevenue = invoices.filter((i) => i.status === "paye").reduce((s, i) => s + Number(i.total), 0);
  const outstanding = invoices.filter((i) => i.status !== "paye").reduce((s, i) => s + Number(i.total), 0);

  return (
    <div>
      <PageHeader
        title="Clients & factures"
        description="Portefeuille commercial et suivi des paiements"
        actions={
          <>
            <Button variant="outline" onClick={() => openNewInvoice()}>
              <Receipt /> Nouvelle facture
            </Button>
            <Button variant="accent" onClick={openNewClient}>
              <Plus /> Ajouter un client
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Clients" value={clients.length} hint="Comptes actifs" icon={Building2} tone="primary" />
        <StatCard title="Factures" value={invoices.length} hint={`${invoices.filter((i) => i.status === "en_retard").length} en retard`} icon={Receipt} tone="info" />
        <StatCard title="Chiffre encaissé" value={formatCurrency(totalRevenue)} hint="Factures payées" icon={Euro} tone="success" />
        <StatCard title="En attente" value={formatCurrency(outstanding)} hint="Restant à encaisser" icon={AlertCircle} tone="warning" />
      </div>

      <Section
        title={`${filtered.length} client${filtered.length > 1 ? "s" : ""}`}
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Société, contact, ville…" />}
        className="mt-6 animate-fade-up"
      >
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="Aucun client trouvé" description="Ajustez votre recherche ou ajoutez un nouveau client." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Société</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Inscription</TableHead>
                <TableHead>Factures</TableHead>
                <TableHead className="hidden sm:table-cell">Total facturé</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const stats = byClient.get(c.id) ?? { count: 0, total: 0, unpaid: 0 };
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button className="text-left" onClick={() => setDetail(c)}>
                        <span className="block font-semibold">{c.company}</span>
                        <span className="block text-xs text-muted-foreground">{c.city}</span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="block text-sm">{c.contact_name}</span>
                      <span className="block text-xs text-muted-foreground">{c.email}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                    <TableCell className="tabular-nums">{stats.count}</TableCell>
                    <TableCell className="hidden sm:table-cell font-semibold tabular-nums">{formatCurrency(stats.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openEditClient(c)} aria-label="Modifier">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setToDelete(c)} aria-label="Supprimer">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Toutes les factures" description="Numéro, dates, montant et statut de paiement" className="mt-6 animate-fade-up">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden sm:table-cell">Émission</TableHead>
              <TableHead className="hidden md:table-cell">Échéance</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs font-semibold">{i.invoice_number}</TableCell>
                <TableCell>{clients.find((c) => c.id === i.client_id)?.company ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">{formatDate(i.issue_date)}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(i.due_date)}</TableCell>
                <TableCell className="font-semibold tabular-nums">{formatCurrency(i.total)}</TableCell>
                <TableCell>
                  <StatusBadge tone={invoiceStatus[i.status]?.tone ?? "muted"}>{invoiceStatus[i.status]?.label ?? i.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => openEditInvoice(i)} aria-label="Modifier">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => removeInvoice.mutate(i.id)} aria-label="Supprimer">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <FormDialog
        open={clientDialog.open}
        onOpenChange={(o) => setClientDialog({ open: o })}
        title={clientDialog.edit ? "Modifier le client" : "Nouveau client"}
        onSubmit={() => saveClient.mutate()}
        loading={saveClient.isPending}
        wide
      >
        <Grid2>
          <TextField label="Société" value={clientForm.company} onChange={(v) => setClientForm({ ...clientForm, company: v })} required />
          <TextField label="Nom du contact" value={clientForm.contact_name} onChange={(v) => setClientForm({ ...clientForm, contact_name: v })} />
          <TextField label="E-mail" type="email" value={clientForm.email} onChange={(v) => setClientForm({ ...clientForm, email: v })} />
          <TextField label="Téléphone" value={clientForm.phone} onChange={(v) => setClientForm({ ...clientForm, phone: v })} />
          <TextField label="Adresse" value={clientForm.address} onChange={(v) => setClientForm({ ...clientForm, address: v })} />
          <TextField label="Ville" value={clientForm.city} onChange={(v) => setClientForm({ ...clientForm, city: v })} />
        </Grid2>
        <TextAreaField label="Notes" value={clientForm.notes} onChange={(v) => setClientForm({ ...clientForm, notes: v })} />
      </FormDialog>

      <FormDialog
        open={invoiceDialog.open}
        onOpenChange={(o) => setInvoiceDialog({ open: o })}
        title={invoiceDialog.edit ? "Modifier la facture" : "Nouvelle facture"}
        onSubmit={() => saveInvoice.mutate()}
        loading={saveInvoice.isPending}
        wide
      >
        <Grid2>
          <TextField label="Numéro" value={invoiceForm.invoice_number} onChange={(v) => setInvoiceForm({ ...invoiceForm, invoice_number: v })} required />
          <SelectField label="Client" value={invoiceForm.client_id} onChange={(v) => setInvoiceForm({ ...invoiceForm, client_id: v })} options={clients.map((c) => ({ value: c.id, label: c.company }))} />
          <TextField label="Date d'émission" type="date" value={invoiceForm.issue_date} onChange={(v) => setInvoiceForm({ ...invoiceForm, issue_date: v })} />
          <TextField label="Date d'échéance" type="date" value={invoiceForm.due_date} onChange={(v) => setInvoiceForm({ ...invoiceForm, due_date: v })} />
          <Field label="Montant total (€)">
            <Input type="number" step="0.01" min="0" value={invoiceForm.total} onChange={(e) => setInvoiceForm({ ...invoiceForm, total: e.target.value })} />
          </Field>
          <SelectField label="Statut de paiement" value={invoiceForm.status} onChange={(v) => setInvoiceForm({ ...invoiceForm, status: v })} options={[{ value: "paye", label: "Payée" }, { value: "en_attente", label: "En attente" }, { value: "en_retard", label: "En retard" }]} />
        </Grid2>
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && removeClient.mutate(toDelete.id)}
        title={`Supprimer ${toDelete?.company} ?`}
        description="Le client et toutes ses factures seront supprimés définitivement."
        loading={removeClient.isPending}
      />

      <ClientDetail client={detail} onClose={() => setDetail(null)} onNewInvoice={openNewInvoice} />
    </div>
  );
}

function ClientDetail({ client, onClose, onNewInvoice }: { client: Client | null; onClose: () => void; onNewInvoice: (id: string) => void }) {
  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", client?.id],
    enabled: !!client,
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*, invoice_items(*)").eq("client_id", client!.id).order("issue_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto scrollbar-thin sm:max-w-xl">
        {client && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{client.company}</SheetTitle>
              <p className="text-sm text-muted-foreground">Client depuis {formatDate(client.created_at)}</p>
            </SheetHeader>

            <div className="mt-6 space-y-2 text-sm">
              {[
                [Mail, client.email],
                [Phone, client.phone],
                [MapPin, `${client.address}${client.city ? `, ${client.city}` : ""}`],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Mail;
                return (
                  <p key={i} className="flex items-center gap-2.5 text-muted-foreground">
                    <I className="size-4 shrink-0" /> {(text as string) || "—"}
                  </p>
                );
              })}
              {client.notes && <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-muted-foreground">{client.notes}</p>}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Factures ({invoices.length})</h3>
              <Button size="sm" variant="outline" onClick={() => onNewInvoice(client.id)}>
                <Plus /> Facture
              </Button>
            </div>

            <ul className="mt-3 space-y-3">
              {invoices.map((inv) => (
                <li key={inv.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Émise le {formatDate(inv.issue_date)} · échéance {formatDate(inv.due_date)}
                      </p>
                    </div>
                    <StatusBadge tone={invoiceStatus[inv.status]?.tone ?? "muted"}>{invoiceStatus[inv.status]?.label ?? inv.status}</StatusBadge>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {(inv.invoice_items as { id: string; description: string; quantity: number; unit_price: number }[])?.map((it) => (
                      <li key={it.id} className="flex justify-between gap-3 text-muted-foreground">
                        <span className="truncate">
                          {it.description} × {it.quantity}
                        </span>
                        <span className="tabular-nums">{formatCurrency(Number(it.quantity) * Number(it.unit_price))}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t pt-2 text-right font-semibold tabular-nums">{formatCurrency(inv.total)}</p>
                </li>
              ))}
              {!invoices.length && <li className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Aucune facture</li>}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
