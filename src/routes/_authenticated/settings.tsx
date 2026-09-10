import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, User, Moon, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, Section, StatusBadge } from "@/components/shared";
import { Field } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isDarkTheme, toggleTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — PolyCable Manager" },
      { name: "description", content: "Profil utilisateur, apparence de l'interface et gestion des rôles d'accès." },
      { property: "og:title", content: "Paramètres — PolyCable Manager" },
      { property: "og:description", content: "Configuration du compte et des accès." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, role, isAdmin, refreshProfile, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [dark, setDark] = useState(isDarkTheme());

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim().slice(0, 100) }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profil mis à jour");
      await refreshProfile();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: employees }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
        supabase.from("employees").select("id, first_name, last_name, user_id"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "employee",
        employee: employees?.find((e) => e.user_id === p.id),
        employees: employees ?? [],
      }));
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "employee" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const linkEmployee = useMutation({
    mutationFn: async ({ userId, employeeId }: { userId: string; employeeId: string }) => {
      await supabase.from("employees").update({ user_id: null }).eq("user_id", userId);
      if (employeeId !== "none") {
        const { error } = await supabase.from("employees").update({ user_id: userId }).eq("id", employeeId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fiche employé associée");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const allEmployees = members[0]?.employees ?? [];

  return (
    <div>
      <PageHeader title="Paramètres" description="Profil, apparence et gestion des accès" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Mon profil" description="Vos informations personnelles" className="animate-fade-up">
          <div className="space-y-4 p-5">
            <Field label="Nom complet">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </Field>
            <Field label="Adresse e-mail">
              <Input value={user?.email ?? ""} disabled />
            </Field>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rôle :</span>
              <StatusBadge tone={role === "admin" ? "accent" : "info"}>{role === "admin" ? "Administrateur" : "Employé"}</StatusBadge>
            </div>
            <Button variant="accent" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              <User /> Enregistrer
            </Button>
          </div>
        </Section>

        <Section title="Apparence & session" description="Thème de l'interface et déconnexion" className="animate-fade-up">
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Moon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Mode sombre</p>
                  <p className="text-xs text-muted-foreground">Confort visuel pour les postes en atelier</p>
                </div>
              </div>
              <Switch checked={dark} onCheckedChange={() => setDark(toggleTheme() === "dark")} />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <LogOut className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Déconnexion</p>
                  <p className="text-xs text-muted-foreground">Fermer la session sur cet appareil</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await qc.cancelQueries();
                  qc.clear();
                  await signOut();
                  navigate({ to: "/auth", replace: true });
                }}
              >
                Se déconnecter
              </Button>
            </div>
          </div>
        </Section>
      </div>

      {isAdmin && (
        <Section
          title="Comptes & rôles"
          description="Attribuez les droits d'accès et rattachez chaque compte à une fiche employé"
          className="mt-6 animate-fade-up"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Utilisateur</TableHead>
                <TableHead className="hidden sm:table-cell">Inscription</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Fiche employé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className="block font-medium">{m.full_name || "—"}</span>
                    <span className="block text-xs text-muted-foreground">{m.email}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(v) => changeRole.mutate({ userId: m.id, role: v as "admin" | "employee" })}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="employee">Employé</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={m.employee?.id ?? "none"} onValueChange={(v) => linkEmployee.mutate({ userId: m.id, employeeId: v })}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Non rattaché" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non rattaché</SelectItem>
                        {allEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {!isAdmin && (
        <Section title="Droits d'accès" className="mt-6 animate-fade-up">
          <div className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
            <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              Votre compte employé donne accès à vos heures de travail, votre historique de présence et vos informations personnelles. Pour toute
              modification, contactez un administrateur.
            </p>
          </div>
        </Section>
      )}

      {isAdmin && (
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-4" /> Le premier compte créé reçoit automatiquement le rôle administrateur.
        </p>
      )}
    </div>
  );
}
