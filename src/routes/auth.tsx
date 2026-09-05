import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cable, Loader2, Recycle, ShieldCheck, Zap } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — PolyCable Manager" },
      { name: "description", content: "Accédez à votre espace de gestion PolyCable : employés, clients, produits, énergie et fournisseurs." },
      { property: "og:title", content: "Connexion — PolyCable Manager" },
      { property: "og:description", content: "Plateforme de gestion pour la conversion du plastique en câbles." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });
        if (error) throw error;
        toast.success("Bienvenue !");
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: parsed.data.fullName ?? "" },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Compte créé !");
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Compte créé. Vérifiez votre e-mail pour confirmer votre adresse.");
          setMode("login");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou mot de passe incorrect" : msg.includes("already registered") ? "Un compte existe déjà avec cet e-mail" : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-hero p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-glow">
            <Cable className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">PolyCable</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">Manager</p>
          </div>
        </div>

        <div className="max-w-lg animate-fade-up">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
            Du plastique recyclé au <span className="text-gradient-accent">câble certifié</span>.
          </h1>
          <p className="mt-5 text-base leading-relaxed opacity-80">
            Pilotez la production, les équipes, les stocks, les clients et la consommation énergétique de votre
            usine depuis un seul tableau de bord.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: Recycle, text: "Suivi des matières recyclées et du stock en temps réel" },
              { icon: Zap, text: "Analyse énergétique par machine, jour, semaine et mois" },
              { icon: ShieldCheck, text: "Accès sécurisé par rôles : administrateur et employé" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
                  <Icon className="size-4 text-accent" />
                </span>
                <span className="opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs opacity-60">© {new Date().getFullYear()} PolyCable Industries — Plateforme de gestion interne</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Cable className="size-5" />
            </div>
            <p className="text-lg font-bold tracking-tight">PolyCable Manager</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Bon retour parmi nous" : "Créer un compte"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Connectez-vous pour accéder à votre espace." : "Le premier compte créé devient administrateur."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Karim Ben Salah" className="h-11" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@polycable.fr" className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11" required />
            </div>
            <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
