import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, PackageX, AlertTriangle, Euro, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchInput, Section, StatCard, StatusBadge, EmptyState, TableSkeleton, ConfirmDelete, stockStatus } from "@/components/shared";
import { FormDialog, TextField, TextAreaField, SelectField, Grid2, Field } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Produits & stock — PolyCable Manager" },
      { name: "description", content: "Catalogue des câbles et matières, niveaux de stock, entrées et sorties." },
      { property: "og:title", content: "Produits & stock — PolyCable Manager" },
      { property: "og:description", content: "Suivi du stock de câbles et de matières recyclées." },
    ],
  }),
  component: ProductsPage,
});

type Product = { id: string; name: string; category: string; description: string; quantity: number; min_stock: number; unit: string; price: number; status: string; created_at: string };

const CATEGORIES = ["Câbles rigides", "Câbles souples", "Câbles spéciaux", "Câbles data", "Matière première", "Gaines"];
const emptyForm = { name: "", category: "Câbles rigides", description: "", quantity: "0", min_stock: "10", unit: "m", price: "0", status: "actif" };

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Product }>({ open: false });
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; product?: Product; type: "entree" | "sortie" }>({ open: false, type: "entree" });
  const [moveForm, setMoveForm] = useState({ quantity: "0", note: "" });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*, products(name, unit)").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchQ = !q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q);
      const s = stockStatus(p.quantity, p.min_stock).label;
      const matchF = filter === "all" || (filter === "rupture" && s === "Rupture") || (filter === "faible" && s === "Stock faible") || (filter === "dispo" && s === "Disponible");
      return matchQ && matchF;
    });
  }, [products, search, filter]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, quantity: Number(form.quantity), min_stock: Number(form.min_stock), price: Number(form.price) };
      if (dialog.edit) {
        const { error } = await supabase.from("products").update(payload).eq("id", dialog.edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "stock", message: `Nouveau produit : ${payload.name}` });
      }
    },
    onSuccess: () => {
      toast.success(dialog.edit ? "Produit mis à jour" : "Produit ajouté");
      setDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit supprimé");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async () => {
      const p = moveDialog.product!;
      const { error } = await supabase.from("stock_movements").insert({
        product_id: p.id,
        movement_type: moveDialog.type,
        quantity: Number(moveForm.quantity),
        note: moveForm.note,
      });
      if (error) throw error;
      await supabase.from("activity_log").insert({
        kind: "stock",
        message: `${moveDialog.type === "entree" ? "Entrée" : "Sortie"} de stock : ${formatNumber(moveForm.quantity)} ${p.unit} de ${p.name}`,
      });
    },
    onSuccess: () => {
      toast.success("Mouvement enregistré");
      setMoveDialog({ open: false, type: "entree" });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => {
    setForm(emptyForm);
    setDialog({ open: true });
  };
  const openEdit = (p: Product) => {
    setForm({ name: p.name, category: p.category, description: p.description, quantity: String(p.quantity), min_stock: String(p.min_stock), unit: p.unit, price: String(p.price), status: p.status });
    setDialog({ open: true, edit: p });
  };
  const openMove = (p: Product, type: "entree" | "sortie") => {
    setMoveForm({ quantity: "0", note: "" });
    setMoveDialog({ open: true, product: p, type });
  };

  const outOfStock = products.filter((p) => p.quantity <= 0).length;
  const low = products.filter((p) => p.quantity > 0 && p.quantity < p.min_stock).length;
  const stockValue = products.reduce((s, p) => s + p.quantity * Number(p.price), 0);

  return (
    <div>
      <PageHeader
        title="Produits & stock"
        description="Catalogue, niveaux de stock et mouvements"
        actions={
          <Button variant="accent" onClick={openNew}>
            <Plus /> Ajouter un produit
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Références" value={products.length} hint={`${products.length - outOfStock} disponibles`} icon={Package} tone="primary" />
        <StatCard title="En rupture" value={outOfStock} hint="À réapprovisionner" icon={PackageX} tone="destructive" />
        <StatCard title="Stock faible" value={low} hint="Sous le seuil minimum" icon={AlertTriangle} tone="warning" />
        <StatCard title="Valeur du stock" value={formatCurrency(stockValue)} hint="Prix × quantité" icon={Euro} tone="success" />
      </div>

      <Tabs defaultValue="list" className="mt-6">
        <TabsList>
          <TabsTrigger value="list">Catalogue</TabsTrigger>
          <TabsTrigger value="moves">Entrées / sorties</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Section
            title={`${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
            actions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <SearchInput value={search} onChange={setSearch} placeholder="Nom, catégorie…" />
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  {[
                    ["all", "Tous"],
                    ["dispo", "Disponibles"],
                    ["faible", "Faibles"],
                    ["rupture", "Ruptures"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setFilter(v ?? "all")}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${filter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            }
            className="animate-fade-up"
          >
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Package} title="Aucun produit trouvé" description="Ajustez vos filtres ou ajoutez un produit." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Produit</TableHead>
                    <TableHead className="hidden lg:table-cell">Catégorie</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">Prix</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const s = stockStatus(p.quantity, p.min_stock);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="block font-semibold">{p.name}</span>
                          <span className="line-clamp-1 block text-xs text-muted-foreground">{p.description}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{p.category}</TableCell>
                        <TableCell className="tabular-nums">
                          <span className="font-semibold">{formatNumber(p.quantity)}</span>
                          <span className="text-xs text-muted-foreground"> {p.unit}</span>
                          <span className="block text-xs text-muted-foreground">min. {formatNumber(p.min_stock)}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell tabular-nums">{formatCurrency(p.price)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8 text-success hover:text-success" onClick={() => openMove(p, "entree")} aria-label="Entrée de stock">
                              <ArrowDownToLine className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-info hover:text-info" onClick={() => openMove(p, "sortie")} aria-label="Sortie de stock">
                              <ArrowUpFromLine className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(p)} aria-label="Modifier">
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setToDelete(p)} aria-label="Supprimer">
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
        </TabsContent>

        <TabsContent value="moves" className="mt-4">
          <Section title="Derniers mouvements de stock" description="50 dernières opérations" className="animate-fade-up">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead className="hidden sm:table-cell">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                    <TableCell className="font-medium">{(m.products as { name: string } | null)?.name}</TableCell>
                    <TableCell>
                      <StatusBadge tone={m.movement_type === "entree" ? "success" : "info"}>{m.movement_type === "entree" ? "Entrée" : "Sortie"}</StatusBadge>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {m.movement_type === "entree" ? "+" : "−"}
                      {formatNumber(m.quantity)} {(m.products as { unit: string } | null)?.unit}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.note || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o })}
        title={dialog.edit ? "Modifier le produit" : "Nouveau produit"}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        wide
      >
        <TextField label="Nom du produit" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Grid2>
          <SelectField label="Catégorie" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <SelectField label="Unité" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} options={[{ value: "m", label: "mètre (m)" }, { value: "kg", label: "kilogramme (kg)" }, { value: "pièce", label: "pièce" }]} />
          <Field label="Quantité en stock">
            <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Seuil de stock minimum">
            <Input type="number" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </Field>
          <Field label="Prix unitaire (€)">
            <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <SelectField label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: "actif", label: "Actif" }, { value: "archive", label: "Archivé" }]} />
        </Grid2>
        <TextAreaField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
      </FormDialog>

      <FormDialog
        open={moveDialog.open}
        onOpenChange={(o) => setMoveDialog({ open: o, type: moveDialog.type })}
        title={moveDialog.type === "entree" ? "Entrée de stock" : "Sortie de stock"}
        description={moveDialog.product ? `${moveDialog.product.name} — stock actuel : ${formatNumber(moveDialog.product.quantity)} ${moveDialog.product.unit}` : undefined}
        onSubmit={() => move.mutate()}
        loading={move.isPending}
      >
        <Field label={`Quantité (${moveDialog.product?.unit ?? ""})`}>
          <Input type="number" min="1" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} required />
        </Field>
        <TextField label="Note" value={moveForm.note} onChange={(v) => setMoveForm({ ...moveForm, note: v })} placeholder="Production lot L-2501, livraison client…" />
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        title={`Supprimer ${toDelete?.name} ?`}
        description="Le produit et son historique de mouvements seront supprimés."
        loading={remove.isPending}
      />
    </div>
  );
}
