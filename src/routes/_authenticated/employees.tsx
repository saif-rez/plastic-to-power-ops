import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users, LogIn, LogOut, CalendarDays, Clock, UserCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmployeeSelfView } from "@/components/employees/EmployeeSelfView";
import { AttendanceCalendar } from "@/components/employees/AttendanceCalendar";
import { PageHeader, SearchInput, Section, StatCard, StatusBadge, EmptyState, TableSkeleton, ConfirmDelete } from "@/components/shared";
import { FormDialog, TextField, SelectField, Grid2 } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatHours, formatTime, initials, nowTime, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employés — PolyCable Manager" },
      { name: "description", content: "Gestion des employés, pointage des heures d'entrée et de sortie, calendrier mensuel et total des heures." },
      { property: "og:title", content: "Employés — PolyCable Manager" },
      { property: "og:description", content: "Suivi des équipes et des heures travaillées." },
    ],
  }),
  component: EmployeesPage,
});

type Employee = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  hire_date: string;
  status: string;
};

const DEPARTMENTS = ["Production", "Maintenance", "Qualité", "Logistique", "Recyclage", "Administration"];

const emptyForm = { first_name: "", last_name: "", position: "", department: "Production", email: "", phone: "", hire_date: todayISO(), status: "actif" };

function EmployeesPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <EmployeeSelfView />;
  return <AdminEmployees />;
}

function AdminEmployees() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(new Date());
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Employee }>({ open: false });
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Employee | null>(null);
  const [detail, setDetail] = useState<Employee | null>(null);
  const today = todayISO();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const monthRange = { start: format(startOfMonth(month), "yyyy-MM-dd"), end: format(endOfMonth(month), "yyyy-MM-dd") };

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", monthRange.start],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").gte("work_date", monthRange.start).lte("work_date", monthRange.end);
      if (error) throw error;
      return data;
    },
  });

  const todayRows = attendance.filter((a) => a.work_date === today);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((e) => `${e.first_name} ${e.last_name} ${e.position} ${e.department}`.toLowerCase().includes(q));
  }, [employees, search]);

  const hoursByEmployee = useMemo(() => {
    const m = new Map<string, { hours: number; days: number }>();
    attendance.forEach((a) => {
      const cur = m.get(a.employee_id) ?? { hours: 0, days: 0 };
      m.set(a.employee_id, { hours: cur.hours + Number(a.hours ?? 0), days: cur.days + 1 });
    });
    return m;
  }, [attendance]);

  const save = useMutation({
    mutationFn: async () => {
      if (dialog.edit) {
        const { error } = await supabase.from("employees").update(form).eq("id", dialog.edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(form);
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "employe", message: `Nouvel employé : ${form.first_name} ${form.last_name}` });
      }
    },
    onSuccess: () => {
      toast.success(dialog.edit ? "Employé mis à jour" : "Employé ajouté");
      setDialog({ open: false });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employé supprimé");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const clock = useMutation({
    mutationFn: async ({ employee, kind }: { employee: Employee; kind: "in" | "out" }) => {
      const row = todayRows.find((a) => a.employee_id === employee.id);
      if (kind === "in") {
        const { error } = await supabase.from("attendance").insert({ employee_id: employee.id, work_date: today, clock_in: nowTime() });
        if (error) throw error;
        await supabase.from("activity_log").insert({ kind: "employe", message: `${employee.first_name} ${employee.last_name} a pointé son entrée à ${nowTime()}` });
      } else {
        const { error } = await supabase.from("attendance").update({ clock_out: nowTime() }).eq("id", row!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pointage enregistré");
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => {
    setForm(emptyForm);
    setDialog({ open: true });
  };
  const openEdit = (e: Employee) => {
    const { first_name, last_name, position, department, email, phone, hire_date, status } = e;
    setForm({ first_name, last_name, position, department, email, phone, hire_date, status });
    setDialog({ open: true, edit: e });
  };

  const monthTotal = [...hoursByEmployee.values()].reduce((s, v) => s + v.hours, 0);

  return (
    <div>
      <PageHeader
        title="Employés"
        description="Équipes, pointage et heures travaillées"
        actions={
          <Button variant="accent" onClick={openNew}>
            <Plus /> Ajouter un employé
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <StatCard title="Total employés" value={employees.length} hint="Effectif enregistré" icon={Users} tone="primary" />
        <StatCard title="Présents aujourd'hui" value={todayRows.length} hint={`${todayRows.filter((a) => !a.clock_out).length} encore sur site`} icon={UserCheck} tone="success" />
        <StatCard title="Heures du mois" value={formatHours(monthTotal)} hint={format(month, "MMMM yyyy")} icon={Clock} tone="info" />
        <StatCard title="Jours pointés" value={attendance.length} hint="Sur le mois affiché" icon={CalendarDays} tone="accent" />
      </div>

      <Tabs defaultValue="list" className="mt-6">
        <TabsList>
          <TabsTrigger value="list">Liste & pointage</TabsTrigger>
          <TabsTrigger value="month">Vue mensuelle</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Section
            title={`${filtered.length} employé${filtered.length > 1 ? "s" : ""}`}
            actions={<SearchInput value={search} onChange={setSearch} placeholder="Nom, poste, département…" />}
            className="animate-fade-up"
          >
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Users} title="Aucun employé trouvé" description="Ajustez votre recherche ou ajoutez un nouvel employé." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Employé</TableHead>
                    <TableHead className="hidden md:table-cell">Poste</TableHead>
                    <TableHead>Entrée</TableHead>
                    <TableHead>Sortie</TableHead>
                    <TableHead className="hidden sm:table-cell">Heures</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const row = todayRows.find((a) => a.employee_id === e.id);
                    return (
                      <TableRow key={e.id} className="transition-colors">
                        <TableCell>
                          <button className="flex items-center gap-3 text-left" onClick={() => setDetail(e)}>
                            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                              {initials(e.first_name, e.last_name)}
                            </span>
                            <span>
                              <span className="block font-semibold">
                                {e.last_name} {e.first_name}
                              </span>
                              <span className="block text-xs text-muted-foreground md:hidden">{e.position}</span>
                              <span className="hidden text-xs text-muted-foreground md:block">{e.department}</span>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{e.position}</TableCell>
                        <TableCell>
                          {row ? (
                            <span className="font-medium tabular-nums">{formatTime(row.clock_in)}</span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => clock.mutate({ employee: e, kind: "in" })}>
                              <LogIn /> Entrée
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {row?.clock_out ? (
                            <span className="font-medium tabular-nums">{formatTime(row.clock_out)}</span>
                          ) : row ? (
                            <Button size="sm" variant="accent" onClick={() => clock.mutate({ employee: e, kind: "out" })}>
                              <LogOut /> Sortie
                            </Button>
                          ) : (
                            <StatusBadge tone="muted" dot={false}>
                              Absent
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell tabular-nums">{row?.hours ? formatHours(row.hours) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(e)} aria-label="Modifier">
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setToDelete(e)} aria-label="Supprimer">
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

        <TabsContent value="month" className="mt-4">
          <Section title={`Heures — ${format(month, "MMMM yyyy")}`} description="Total par employé sur le mois sélectionné" className="animate-fade-up">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                Mois précédent
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                Mois suivant
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Employé</TableHead>
                  <TableHead className="hidden sm:table-cell">Département</TableHead>
                  <TableHead>Jours</TableHead>
                  <TableHead>Total heures</TableHead>
                  <TableHead className="hidden md:table-cell">Moyenne / jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const v = hoursByEmployee.get(e.id) ?? { hours: 0, days: 0 };
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.last_name} {e.first_name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{e.department}</TableCell>
                      <TableCell className="tabular-nums">{v.days}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatHours(v.hours)}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">{v.days ? formatHours(v.hours / v.days) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o })}
        title={dialog.edit ? "Modifier l'employé" : "Nouvel employé"}
        description="Renseignez les informations du collaborateur."
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        wide
      >
        <Grid2>
          <TextField label="Prénom" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
          <TextField label="Nom" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
          <TextField label="Poste" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
          <SelectField label="Département" value={form.department} onChange={(v) => setForm({ ...form, department: v })} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} />
          <TextField label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextField label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <TextField label="Date d'embauche" type="date" value={form.hire_date} onChange={(v) => setForm({ ...form, hire_date: v })} />
          <SelectField label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: "actif", label: "Actif" }, { value: "conge", label: "En congé" }, { value: "inactif", label: "Inactif" }]} />
        </Grid2>
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        title={`Supprimer ${toDelete?.first_name} ${toDelete?.last_name} ?`}
        description="La fiche employé et son historique de présence seront supprimés définitivement."
        loading={remove.isPending}
      />

      <EmployeeDetail employee={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EmployeeDetail({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const [month, setMonth] = useState(new Date());
  const { data: attendance = [] } = useQuery({
    queryKey: ["employee-attendance", employee?.id],
    enabled: !!employee,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", employee!.id).order("work_date", { ascending: false });
      return data ?? [];
    },
  });

  const total = attendance.reduce((s, a) => s + Number(a.hours ?? 0), 0);

  return (
    <Sheet open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto scrollbar-thin sm:max-w-xl">
        {employee && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-gradient-primary text-base font-bold text-primary-foreground">
                  {initials(employee.first_name, employee.last_name)}
                </span>
                <div>
                  <SheetTitle>
                    {employee.first_name} {employee.last_name}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {employee.position} · {employee.department}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              {[
                ["E-mail", employee.email],
                ["Téléphone", employee.phone],
                ["Date d'embauche", formatDate(employee.hire_date)],
                ["Statut", employee.status],
                ["Total heures", formatHours(total)],
                ["Jours pointés", String(attendance.length)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-muted/30 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4" /> Calendrier des jours travaillés
              </h3>
              <AttendanceCalendar attendance={attendance} month={month} onMonthChange={setMonth} />
            </div>

            <div className="mt-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ChevronRight className="size-4" /> Derniers pointages
              </h3>
              <ul className="divide-y rounded-lg border">
                {attendance.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{formatDate(a.work_date, "EEE d MMM yyyy")}</span>
                    <span className="text-muted-foreground">
                      {formatTime(a.clock_in)} → {formatTime(a.clock_out)}
                    </span>
                    <span className="font-semibold tabular-nums">{a.hours ? formatHours(a.hours) : "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
