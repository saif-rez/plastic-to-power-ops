import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Truck, Package, Euro, ClipboardList, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchInput, Section, StatCard, StatusBadge, EmptyState, TableSkeleton, ConfirmDelete, orderStatus } from "@/components/shared";
import { FormDialog, TextField, SelectField, Grid2, Field } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, formatNumber, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Fournisseurs — PolyCable Manager" },
      { name: "description", content: "Fournisseurs de matières plastiques, métaux et équipements : contacts, produits fournis et historique des commandes." },
      { property: "og:title", content: "Fournisseurs — PolyCable Manager" },
      { property: "og:description", content: "Réseau d'approvisionnement de l'usine." },
    ],
  }),
  component: SuppliersPage,
});

type Supplier = { id: string; name: string; contact_name: string; email: string; phone: string; address: string; city: string; category: string; created_at: string };

const CATEGORIES = ["Déchets plastiques", "Matières premières", "Métaux", "Additifs chimiques", "Équipements", "Énergie", "Transport"];
const emptyForm = { name: "", contact_name: "", email: "", phone: "", address: "", city: "", category: "Matières premières" };

function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Supplier }>({ open: false });
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [orderDialog, setOrderDialog] = useState<{ open: boolean; supplierId?: string }>({ open: false });
  const [orderForm, setOrderForm] = useState({ order_number: "", order_date: todayISO(), description: "", amount: "0", status: "en_cours" });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["supplier-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_orders").select("*").order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["supplier-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter((s) => `${s.name} ${s.contact_name} ${s.city} ${s.category}`.toLowerCase().includes(q));
  }, [suppliers, search]);

  const save = useMutation({
    mutationFn: async () => {
      if (dialog.edit) {
        const { error } = await supabase.from("suppliers").update(form).eq("id", dialog.edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(form);
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "fournisseur", message: `Nouveau fournisseur : ${form.name}` });
      }
    },
    onSuccess: () => {
      toast.success(dialog.edit ? "Fournisseur mis à jour" : "Fournisseur ajouté");
      setDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fournisseur supprimé");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveOrder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_orders").insert({
        supplier_id: orderDialog.supplierId!,
        order_number: orderForm.order_number,
        order_date: orderForm.order_date,
        description: orderForm.description,
        amount: Number(orderForm.amount),
        status: orderForm.status,
      });
      if (error) throw error;
      await supabase.from("activity_log").insert({ kind: "fournisseur", message: `Commande ${orderForm.order_number} enregistrée` });
    },
    onSuccess: () => {
      toast.success("Commande enregistrée");
      setOrderDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => {
    setForm(emptyForm);
    setDialog({ open: true });
  };
  const openEdit = (s: Supplier) => {
    const { name, contact_name, email, phone, address, city, category } = s;
    setForm({ name, contact_name, email, phone, address, city, category });
    setDialog({ open: true, edit: s });
  };
  const openNewOrder = (supplierId: string) => {
    setOrderForm({ order_number: `CMD-${new Date().getFullYear()}-${String(orders.length + 60).padStart(3, "0")}`, order_date: todayISO(), description: "", amount: "0", status: "en_cours" });
    setOrderDialog({ open: true, supplierId });
  };

  const totalSpend = orders.filter((o) => o.status !== "annulee").reduce((s, o) => s + Number(o.amount), 0);

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description="Approvisionnement en matières, additifs et équipements"
        actions={
          <Button variant="accent" onClick={openNew}>
            <Plus /> Ajouter un fournisseur
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Fournisseurs" value={suppliers.length} hint="Partenaires référencés" icon={Truck} tone="primary" />
        <StatCard title="Produits fournis" value={supplierProducts.length} hint="Références d'approvisionnement" icon={Package} tone="info" />
        <StatCard title="Commandes" value={orders.length} hint={`${orders.filter((o) => o.status === "en_cours").length} en cours`} icon={ClipboardList} tone="warning" />
        <StatCard title="Montant commandé" value={formatCurrency(totalSpend)} hint="Hors commandes annulées" icon={Euro} tone="success" />
      </div>

      <Section
        title={`${filtered.length} fournisseur${filtered.length > 1 ? "s" : ""}`}
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Nom, contact, catégorie…" />}
        className="mt-6 animate-fade-up"
      >
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title="Aucun fournisseur trouvé" description="Ajustez votre recherche ou ajoutez un fournisseur." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Fournisseur</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Catégorie</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead className="hidden sm:table-cell">Commandes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button className="text-left" onClick={() => setDetail(s)}>
                      <span className="block font-semibold">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">{s.city}</span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="block text-sm">{s.contact_name}</span>
                    <span className="block text-xs text-muted-foreground">{s.email}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StatusBadge tone="muted" dot={false}>
                      {s.category}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="tabular-nums">{supplierProducts.filter((p) => p.supplier_id === s.id).length}</TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">{orders.filter((o) => o.supplier_id === s.id).length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openNewOrder(s.id)}>
                        <ClipboardList /> Commande
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(s)} aria-label="Modifier">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setToDelete(s)} aria-label="Supprimer">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Historique des commandes" className="mt-6 animate-fade-up">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Numéro</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                <TableCell>{suppliers.find((s) => s.id === o.supplier_id)?.name ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">{formatDate(o.order_date)}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{o.description}</TableCell>
                <TableCell className="font-semibold tabular-nums">{formatCurrency(o.amount)}</TableCell>
                <TableCell>
                  <StatusBadge tone={orderStatus[o.status]?.tone ?? "muted"}>{orderStatus[o.status]?.label ?? o.status}</StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <FormDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o })}
        title={dialog.edit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        wide
      >
        <Grid2>
          <TextField label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <SelectField label="Catégorie" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <TextField label="Nom du contact" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <TextField label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextField label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <TextField label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <TextField label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} className="sm:col-span-2" />
        </Grid2>
      </FormDialog>

      <FormDialog
        open={orderDialog.open}
        onOpenChange={(o) => setOrderDialog({ open: o })}
        title="Nouvelle commande fournisseur"
        onSubmit={() => saveOrder.mutate()}
        loading={saveOrder.isPending}
        wide
      >
        <Grid2>
          <TextField label="Numéro de commande" value={orderForm.order_number} onChange={(v) => setOrderForm({ ...orderForm, order_number: v })} required />
          <TextField label="Date" type="date" value={orderForm.order_date} onChange={(v) => setOrderForm({ ...orderForm, order_date: v })} />
          <Field label="Montant (€)">
            <Input type="number" step="0.01" min="0" value={orderForm.amount} onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })} />
          </Field>
          <SelectField label="Statut" value={orderForm.status} onChange={(v) => setOrderForm({ ...orderForm, status: v })} options={[{ value: "en_cours", label: "En cours" }, { value: "livree", label: "Livrée" }, { value: "annulee", label: "Annulée" }]} />
          <TextField label="Description" value={orderForm.description} onChange={(v) => setOrderForm({ ...orderForm, description: v })} className="sm:col-span-2" />
        </Grid2>
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        title={`Supprimer ${toDelete?.name} ?`}
        description="Le fournisseur, ses produits et son historique de commandes seront supprimés."
        loading={remove.isPending}
      />

      <SupplierDetail supplier={detail} onClose={() => setDetail(null)} onNewOrder={openNewOrder} />
    </div>
  );
}

function SupplierDetail({ supplier, onClose, onNewOrder }: { supplier: Supplier | null; onClose: () => void; onNewOrder: (id: string) => void }) {
  const { data } = useQuery({
    queryKey: ["supplier-detail", supplier?.id],
    enabled: !!supplier,
    queryFn: async () => {
      const [{ data: products }, { data: orders }] = await Promise.all([
        supabase.from("supplier_products").select("*").eq("supplier_id", supplier!.id),
        supabase.from("supplier_orders").select("*").eq("supplier_id", supplier!.id).order("order_date", { ascending: false }),
      ]);
      return { products: products ?? [], orders: orders ?? [] };
    },
  });

  return (
    <Sheet open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto scrollbar-thin sm:max-w-xl">
        {supplier && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{supplier.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {supplier.category} · partenaire depuis {formatDate(supplier.created_at)}
              </p>
            </SheetHeader>

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0" /> {supplier.email || "—"}
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0" /> {supplier.phone || "—"}
              </p>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0" /> {supplier.address}
                {supplier.city ? `, ${supplier.city}` : ""}
              </p>
            </div>

            <h3 className="mt-6 text-sm font-semibold">Produits fournis</h3>
            <ul className="mt-3 divide-y rounded-lg border">
              {data?.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{p.product_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(p.unit_price)} / {p.unit}
                  </span>
                </li>
              ))}
              {!data?.products.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun produit référencé</li>}
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Commandes ({data?.orders.length ?? 0})</h3>
              <Button size="sm" variant="outline" onClick={() => onNewOrder(supplier.id)}>
                <Plus /> Commande
              </Button>
            </div>
            <ul className="mt-3 space-y-2">
              {data?.orders.map((o) => (
                <li key={o.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold">{o.order_number}</span>
                    <StatusBadge tone={orderStatus[o.status]?.tone ?? "muted"}>{orderStatus[o.status]?.label ?? o.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{o.description}</p>
                  <p className="mt-1 flex justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(o.order_date)}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(o.amount, 2)} €</span>
                  </p>
                </li>
              ))}
              {!data?.orders.length && <li className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Aucune commande</li>}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
