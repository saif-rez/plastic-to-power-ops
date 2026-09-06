import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Clock, CalendarDays, Briefcase, UserX } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, StatCard, Section, EmptyState } from "@/components/shared";
import { AttendanceCalendar } from "@/components/employees/AttendanceCalendar";
import { Button } from "@/components/ui/button";
import { formatHours, formatTime, formatDate, todayISO, nowTime } from "@/lib/format";

export function EmployeeSelfView() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-employee", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance", employee?.id],
    enabled: !!employee,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", employee!.id).order("work_date", { ascending: false }).limit(120);
      return data ?? [];
    },
  });

  const todayRow = attendance.find((a) => a.work_date === today);
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthHours = attendance.filter((a) => a.work_date >= monthStart).reduce((s, a) => s + Number(a.hours ?? 0), 0);
  const monthDays = attendance.filter((a) => a.work_date >= monthStart).length;

  const clock = useMutation({
    mutationFn: async (kind: "in" | "out") => {
      if (kind === "in") {
        const { error } = await supabase.from("attendance").insert({ employee_id: employee!.id, work_date: today, clock_in: nowTime() });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").update({ clock_out: nowTime() }).eq("id", todayRow!.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, kind) => {
      toast.success(kind === "in" ? "Entrée enregistrée" : "Sortie enregistrée");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;

  if (!employee) {
    return (
      <div>
        <PageHeader title={`Bonjour, ${profile?.full_name || "collaborateur"}`} description="Votre espace personnel" />
        <EmptyState icon={UserX} title="Aucune fiche employé associée" description="Votre compte n'est pas encore rattaché à une fiche employé. Demandez à un administrateur de lier votre compte depuis la fiche employé." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${employee.first_name}`}
        description={`${employee.position} · ${employee.department}`}
        actions={
          !todayRow ? (
            <Button variant="accent" size="lg" onClick={() => clock.mutate("in")} disabled={clock.isPending}>
              <LogIn /> Pointer mon entrée
            </Button>
          ) : !todayRow.clock_out ? (
            <Button variant="default" size="lg" onClick={() => clock.mutate("out")} disabled={clock.isPending}>
              <LogOut /> Pointer ma sortie
            </Button>
          ) : (
            <Button variant="outline" size="lg" disabled>
              Journée terminée · {formatHours(todayRow.hours)}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 stagger-children">
        <StatCard title="Aujourd'hui" value={todayRow ? `${formatTime(todayRow.clock_in)} → ${formatTime(todayRow.clock_out)}` : "Non pointé"} hint={todayRow && !todayRow.clock_out ? "En cours" : undefined} icon={Clock} tone={todayRow ? "success" : "warning"} />
        <StatCard title="Heures ce mois" value={formatHours(monthHours)} hint={`${monthDays} jours travaillés`} icon={CalendarDays} tone="info" />
        <StatCard title="Ancienneté" value={formatDate(employee.hire_date)} hint="Date d'embauche" icon={Briefcase} tone="primary" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Calendrier du mois" className="lg:col-span-3 animate-fade-up">
          <div className="p-5">
            <AttendanceCalendar attendance={attendance} />
          </div>
        </Section>
        <Section title="Historique de présence" className="lg:col-span-2 animate-fade-up">
          <ul className="max-h-[420px] divide-y overflow-y-auto scrollbar-thin">
            {attendance.slice(0, 30).map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{formatDate(a.work_date, "EEE d MMM")}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(a.clock_in)} → {formatTime(a.clock_out)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{a.hours ? formatHours(a.hours) : "—"}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Informations personnelles" className="mt-6 animate-fade-up">
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Nom complet", `${employee.first_name} ${employee.last_name}`],
            ["Poste", employee.position],
            ["Département", employee.department],
            ["E-mail", employee.email],
            ["Téléphone", employee.phone],
            ["Statut", employee.status],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-medium">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
