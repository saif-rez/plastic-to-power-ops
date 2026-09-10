import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, Building2, Package, Zap, Truck, AlertTriangle, Activity, ArrowRight, Receipt, UserCheck } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, StatCard, Section, StatusBadge, stockStatus, invoiceStatus } from "@/components/shared";
import { formatCurrency, formatNumber, formatHours, formatDateTime, todayISO, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmployeeSelfView } from "@/components/employees/EmployeeSelfView";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — PolyCable Manager" },
      { name: "description", content: "Vue d'ensemble de l'activité : employés, heures, clients, stock, énergie et fournisseurs." },
      { property: "og:title", content: "Tableau de bord — PolyCable Manager" },
      { property: "og:description", content: "Vue d'ensemble de l'activité industrielle en temps réel." },
    ],
  }),
  component: DashboardPage,
});

const kindTone: Record<string, string> = {
  facture: "bg-info",
  stock: "bg-primary",
  employe: "bg-success",
  energie: "bg-accent",
  client: "bg-info",
  fournisseur: "bg-primary",
  alerte: "bg-destructive",
  paiement: "bg-success",
};

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
      const thirtyAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const [emp, attToday, attMonth, clients, products, energy, energyToday, suppliers, activity, invoices] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id, clock_out").eq("work_date", today),
        supabase.from("attendance").select("hours").gte("work_date", monthStart),
        supabase.from("clients").select("id, created_at"),
        supabase.from("products").select("id, quantity, min_stock, name"),
        supabase.from("energy_records").select("record_date, cost").gte("record_date", sixMonthsAgo),
        supabase.from("energy_records").select("quantity, cost, energy_type, unit").eq("record_date", today),
        supabase.from("suppliers").select("id", { count: "exact", head: true }),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("invoices").select("id, invoice_number, status, total, issue_date, clients(company)").order("issue_date", { ascending: false }).limit(5),
      ]);

      const monthly = new Map<string, number>();
      energy.data?.forEach((r) => {
        const k = r.record_date.slice(0, 7);
        monthly.set(k, (monthly.get(k) ?? 0) + Number(r.cost));
      });
      const energySeries = [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ month: format(new Date(k + "-01"), "MMM", { locale: fr }), cost: Math.round(v) }));

      const daily = new Map<string, number>();
      energy.data?.filter((r) => r.record_date >= thirtyAgo).forEach((r) => daily.set(r.record_date, (daily.get(r.record_date) ?? 0) + Number(r.cost)));
      const dailySeries = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ day: format(new Date(k), "d/M"), cost: Math.round(v) }));

      const outOfStock = products.data?.filter((p) => p.quantity <= 0) ?? [];
      const lowStock = products.data?.filter((p) => p.quantity > 0 && p.quantity < p.min_stock) ?? [];

      return {
        employees: emp.count ?? 0,
        presentToday: attToday.data?.length ?? 0,
        stillIn: attToday.data?.filter((a) => !a.clock_out).length ?? 0,
        monthHours: attMonth.data?.reduce((s, a) => s + Number(a.hours ?? 0), 0) ?? 0,
        clients: clients.data?.length ?? 0,
        newClients: clients.data?.filter((c) => c.created_at >= thirtyAgo).length ?? 0,
        products: products.data?.length ?? 0,
        available: (products.data?.length ?? 0) - outOfStock.length,
        outOfStock,
        lowStock,
        energyTodayCost: energyToday.data?.reduce((s, r) => s + Number(r.cost), 0) ?? 0,
        energyTodayKwh: energyToday.data?.filter((r) => r.unit === "kWh").reduce((s, r) => s + Number(r.quantity), 0) ?? 0,
        energyMonthCost: energy.data?.filter((r) => r.record_date >= monthStart).reduce((s, r) => s + Number(r.cost), 0) ?? 0,
        energySeries,
        dailySeries,
        suppliers: suppliers.count ?? 0,
        activity: activity.data ?? [],
        invoices: invoices.data ?? [],
      };
    },
  });
}

function ChartTip({ active, payload, label, unit = "€" }: { active?: boolean; payload?: { value: number }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-card">
      <p className="font-semibold">{label}</p>
      <p className="text-muted-foreground">
        {formatNumber(payload[0]?.value)} {unit}
      </p>
    </div>
  );
}

function DashboardPage() {
  const { isAdmin, profile, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <EmployeeSelfView />;
  return <AdminDashboard name={profile?.full_name} />;
}

function AdminDashboard({ name }: { name?: string | undefined }) {
  const { data, isLoading } = useDashboard();
  const firstName = name?.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={firstName ? `Bonjour, ${firstName}` : "Tableau de bord"}
        description={`Aperçu de l'activité — ${formatDate(new Date(), "EEEE d MMMM yyyy")}`}
        actions={
          <Button asChild variant="accent">
            <Link to="/energy">
              <Zap /> Saisir la consommation
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Employés" value={isLoading ? "…" : data?.employees} hint={`${data?.presentToday ?? 0} présents aujourd'hui`} icon={Users} tone="primary" />
        <StatCard title="Heures ce mois" value={isLoading ? "…" : formatHours(data?.monthHours)} hint={`${data?.stillIn ?? 0} sur site actuellement`} icon={Clock} tone="info" />
        <StatCard title="Clients" value={isLoading ? "…" : data?.clients} hint={`${data?.newClients ?? 0} nouveaux sur 30 jours`} icon={Building2} tone="success" trend={data?.newClients ? Math.round((data.newClients / Math.max(1, data.clients - data.newClients)) * 100) : undefined} />
        <StatCard title="Produits" value={isLoading ? "…" : data?.products} hint={`${data?.available ?? 0} disponibles · ${data?.outOfStock.length ?? 0} en rupture`} icon={Package} tone={data?.outOfStock.length ? "warning" : "primary"} />
        <StatCard title="Énergie aujourd'hui" value={isLoading ? "…" : formatCurrency(data?.energyTodayCost)} hint={`${formatNumber(data?.energyTodayKwh)} kWh électricité`} icon={Zap} tone="accent" />
        <StatCard title="Coût énergie (mois)" value={isLoading ? "…" : formatCurrency(data?.energyMonthCost)} hint="Électricité, gaz et eau" icon={Activity} tone="accent" />
        <StatCard title="Fournisseurs" value={isLoading ? "…" : data?.suppliers} hint="Partenaires actifs" icon={Truck} tone="primary" />
        <StatCard title="Alertes stock" value={isLoading ? "…" : (data?.outOfStock.length ?? 0) + (data?.lowStock.length ?? 0)} hint={`${data?.lowStock.length ?? 0} stock faible`} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="Coût énergétique mensuel" description="6 derniers mois, toutes énergies" className="lg:col-span-2 animate-fade-up">
          <div className="h-72 px-2 pb-4 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.energySeries ?? []}>
                <defs>
                  <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--color-border)" }} />
                <Area type="monotone" dataKey="cost" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#energyFill)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Activité récente" className="animate-fade-up">
          <ul className="divide-y">
            {data?.activity.map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/50">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${kindTone[a.kind] ?? "bg-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="leading-snug">{a.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
                </div>
              </li>
            ))}
            {!isLoading && !data?.activity.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune activité</li>}
          </ul>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="Consommation quotidienne" description="Coût sur 30 jours" className="animate-fade-up">
          <div className="h-56 px-2 pb-4 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={5} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="cost" fill="var(--color-primary-glow)" radius={[4, 4, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section
          title="Dernières factures"
          className="animate-fade-up"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/clients">
                Tout voir <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {data?.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Receipt className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{(inv.clients as { company: string } | null)?.company}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(inv.total)}</p>
                  <StatusBadge tone={invoiceStatus[inv.status]?.tone ?? "muted"} dot={false} className="mt-0.5 px-2 py-0 text-[10px]">
                    {invoiceStatus[inv.status]?.label ?? inv.status}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Alertes stock"
          className="animate-fade-up"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/products">
                Gérer <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {[...(data?.outOfStock ?? []), ...(data?.lowStock ?? [])].map((p) => {
              const s = stockStatus(p.quantity, p.min_stock);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                </li>
              );
            })}
            {!isLoading && !data?.outOfStock.length && !data?.lowStock.length && (
              <li className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                <UserCheck className="size-4 text-success" /> Tous les stocks sont au niveau
              </li>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
}
