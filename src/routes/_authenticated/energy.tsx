import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Zap, Flame, Droplets, Euro, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, StatCard, EmptyState, TableSkeleton, StatusBadge } from "@/components/shared";
import { FormDialog, TextField, SelectField, Grid2, Field } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatNumber, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/energy")({
  head: () => ({
    meta: [
      { title: "Énergie — PolyCable Manager" },
      { name: "description", content: "Saisie et analyse de la consommation énergétique par jour, semaine, mois et année, avec calcul automatique des coûts." },
      { property: "og:title", content: "Énergie — PolyCable Manager" },
      { property: "og:description", content: "Consommation et coûts énergétiques de l'usine." },
    ],
  }),
  component: EnergyPage,
});

type EnergyRow = { id: string; record_date: string; energy_type: string; quantity: number; unit: string; unit_cost: number; cost: number; machine: string };

const TYPES = [
  { value: "Électricité", label: "Électricité (kWh)", unit: "kWh", cost: "0.19" },
  { value: "Gaz naturel", label: "Gaz naturel (MWh)", unit: "MWh", cost: "68" },
  { value: "Eau", label: "Eau (m³)", unit: "m³", cost: "3.80" },
];
const MACHINES = ["Extrudeuse EX-1", "Extrudeuse EX-2", "Broyeur BR-1", "Four de séchage FS-1", "Circuit de refroidissement", "Ligne de tréfilage", "Éclairage & bureaux"];

function EnergyPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ record_date: todayISO(), energy_type: "Électricité", quantity: "0", unit: "kWh", unit_cost: "0.19", machine: MACHINES[0]! });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["energy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("energy_records").select("*").order("record_date", { ascending: false });
      if (error) throw error;
      return data as EnergyRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("energy_records").insert({
        record_date: form.record_date,
        energy_type: form.energy_type,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_cost: Number(form.unit_cost),
        machine: form.machine,
      });
      if (error) throw error;
      await supabase.from("activity_log").insert({
        kind: "energie",
        message: `Consommation enregistrée : ${formatNumber(form.quantity, 1)} ${form.unit} — ${form.machine}`,
      });
    },
    onSuccess: () => {
      toast.success("Consommation enregistrée");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["energy"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("energy_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Enregistrement supprimé");
      qc.invalidateQueries({ queryKey: ["energy"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const today = todayISO();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const sum = (list: EnergyRow[]) => list.reduce((s, r) => s + Number(r.cost), 0);
    const elec = (list: EnergyRow[]) => list.filter((r) => r.energy_type === "Électricité").reduce((s, r) => s + Number(r.quantity), 0);
    return {
      todayCost: sum(rows.filter((r) => r.record_date === today)),
      todayKwh: elec(rows.filter((r) => r.record_date === today)),
      weekCost: sum(rows.filter((r) => r.record_date >= weekStart)),
      monthCost: sum(rows.filter((r) => r.record_date >= monthStart)),
      yearCost: sum(rows),
    };
  }, [rows, today, weekStart, monthStart]);

  const series = useMemo(() => {
    const group = (keyFn: (d: string) => string, labelFn: (k: string) => string, filter?: (d: string) => boolean) => {
      const m = new Map<string, { elec: number; gaz: number; eau: number; cost: number }>();
      rows.forEach((r) => {
        if (filter && !filter(r.record_date)) return;
        const k = keyFn(r.record_date);
        const cur = m.get(k) ?? { elec: 0, gaz: 0, eau: 0, cost: 0 };
        cur.cost += Number(r.cost);
        if (r.energy_type === "Électricité") cur.elec += Number(r.quantity);
        if (r.energy_type === "Gaz naturel") cur.gaz += Number(r.quantity);
        if (r.energy_type === "Eau") cur.eau += Number(r.quantity);
        m.set(k, cur);
      });
      return [...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ label: labelFn(k), ...v, elec: Math.round(v.elec), gaz: Math.round(v.gaz * 10) / 10, eau: Math.round(v.eau), cost: Math.round(v.cost) }));
    };
    const thirtyAgo = format(subDays(new Date(), 29), "yyyy-MM-dd");
    return {
      day: group((d) => d, (k) => format(new Date(k), "d MMM", { locale: fr }), (d) => d >= thirtyAgo),
      week: group((d) => format(startOfWeek(new Date(d), { weekStartsOn: 1 }), "yyyy-MM-dd"), (k) => `S${format(new Date(k), "w")}`),
      month: group((d) => d.slice(0, 7), (k) => format(new Date(k + "-01"), "MMM yy", { locale: fr })),
      year: group((d) => d.slice(0, 4), (k) => k),
    };
  }, [rows]);

  const typeMeta = TYPES.find((t) => t.value === form.energy_type);

  return (
    <div>
      <PageHeader
        title="Énergie"
        description="Consommation, coûts et évolution par machine"
        actions={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus /> Enregistrer une consommation
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Aujourd'hui" value={formatCurrency(stats.todayCost)} hint={`${formatNumber(stats.todayKwh)} kWh électricité`} icon={Zap} tone="accent" />
        <StatCard title="Cette semaine" value={formatCurrency(stats.weekCost)} hint="Toutes énergies" icon={Flame} tone="warning" />
        <StatCard title="Ce mois" value={formatCurrency(stats.monthCost)} hint={format(new Date(), "MMMM yyyy", { locale: fr })} icon={Euro} tone="info" />
        <StatCard title="Sur 12 mois" value={formatCurrency(stats.yearCost)} hint="Coût énergétique total" icon={Droplets} tone="primary" />
      </div>

      <Tabs defaultValue="day" className="mt-6">
        <TabsList>
          <TabsTrigger value="day">Jour</TabsTrigger>
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="month">Mois</TabsTrigger>
          <TabsTrigger value="year">Année</TabsTrigger>
        </TabsList>

        {(["day", "week", "month", "year"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-4 space-y-6">
            <Section title="Coût énergétique" description={{ day: "30 derniers jours", week: "Par semaine", month: "Par mois", year: "Par année" }[k]} className="animate-fade-up">
              <div className="h-72 px-2 pb-4 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series[k]}>
                    <defs>
                      <linearGradient id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={50} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} k€` : `${v} €`)} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), "Coût"]}
                      contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="cost" stroke="var(--color-accent)" strokeWidth={2.5} fill={`url(#fill-${k})`} animationDuration={800} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Électricité consommée" description="kWh" className="animate-fade-up">
                <div className="h-64 px-2 pb-4 pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series[k]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" />
                      <Tooltip
                        formatter={(v: number) => [`${formatNumber(v)} kWh`, "Électricité"]}
                        contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="elec" fill="var(--color-primary-glow)" radius={[4, 4, 0, 0]} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Gaz & eau" description="MWh et m³" className="animate-fade-up">
                <div className="h-64 px-2 pb-4 pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series[k]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="gaz" name="Gaz (MWh)" stroke="var(--color-warning)" strokeWidth={2.5} dot={false} animationDuration={800} />
                      <Line type="monotone" dataKey="eau" name="Eau (m³)" stroke="var(--color-info)" strokeWidth={2.5} dot={false} animationDuration={800} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Section title="Derniers enregistrements" description="Calcul automatique du coût : quantité × prix unitaire" className="mt-6 animate-fade-up">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Zap} title="Aucune consommation enregistrée" description="Commencez par saisir la consommation du jour." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Machine</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead className="hidden sm:table-cell">Prix unitaire</TableHead>
                <TableHead>Coût</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 40).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{formatDate(r.record_date)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={r.energy_type === "Électricité" ? "accent" : r.energy_type === "Gaz naturel" ? "warning" : "info"} dot={false}>
                      {r.energy_type}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.machine}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNumber(r.quantity, 2)} {r.unit}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">{formatCurrency(r.unit_cost)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatCurrency(r.cost)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => remove.mutate(r.id)} aria-label="Supprimer">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Enregistrer une consommation"
        description="Le coût est calculé automatiquement à partir de la quantité et du prix unitaire."
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        wide
      >
        <Grid2>
          <TextField label="Date" type="date" value={form.record_date} onChange={(v) => setForm({ ...form, record_date: v })} />
          <SelectField
            label="Type d'énergie"
            value={form.energy_type}
            onChange={(v) => {
              const t = TYPES.find((x) => x.value === v);
              setForm({ ...form, energy_type: v, unit: t?.unit ?? "kWh", unit_cost: t?.cost ?? "0" });
            }}
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Field label={`Quantité (${form.unit})`}>
            <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          </Field>
          <Field label={`Prix unitaire (€ / ${form.unit})`}>
            <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} required />
          </Field>
          <SelectField label="Machine concernée" value={form.machine} onChange={(v) => setForm({ ...form, machine: v })} options={MACHINES.map((m) => ({ value: m, label: m }))} className="sm:col-span-2" />
        </Grid2>
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          Coût calculé : <span className="font-semibold">{formatCurrency(Number(form.quantity) * Number(form.unit_cost))}</span>
          {typeMeta && <span className="text-muted-foreground"> · {typeMeta.label}</span>}
        </p>
      </FormDialog>
    </div>
  );
}
