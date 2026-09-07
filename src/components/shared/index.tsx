import { type ReactNode } from "react";
import { Search, type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  trend,
  className,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode | undefined;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "info" | "destructive" | undefined;
  trend?: number | undefined;
  className?: string | undefined;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/12 text-destructive",
  };
  return (
    <div className={cn("surface-card surface-card-hover p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
            {value}
          </p>
          {(hint || trend !== undefined) && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              {trend !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    trend >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {trend >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {trend >= 0 ? "+" : ""}
                  {trend}%
                </span>
              )}
              {hint && <span className="truncate">{hint}</span>}
            </div>
          )}
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Search input ---------- */
export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 bg-card pl-9"
      />
    </div>
  );
}

/* ---------- Status badge ---------- */
type Tone = "success" | "warning" | "destructive" | "info" | "muted" | "accent";
const toneClass: Record<Tone, string> = {
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/40 bg-warning/20 text-warning-foreground",
  destructive: "border-destructive/30 bg-destructive/12 text-destructive",
  info: "border-info/30 bg-info/12 text-info",
  muted: "border-border bg-muted text-muted-foreground",
  accent: "border-accent/30 bg-accent/12 text-accent",
};

export function StatusBadge({ tone, children, dot = true, className }: { tone: Tone; children: ReactNode; dot?: boolean | undefined; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-0.5 font-semibold", toneClass[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  );
}

export const invoiceStatus: Record<string, { label: string; tone: Tone }> = {
  paye: { label: "Payée", tone: "success" },
  en_attente: { label: "En attente", tone: "warning" },
  en_retard: { label: "En retard", tone: "destructive" },
};

export const orderStatus: Record<string, { label: string; tone: Tone }> = {
  livree: { label: "Livrée", tone: "success" },
  en_cours: { label: "En cours", tone: "info" },
  annulee: { label: "Annulée", tone: "muted" },
};

export function stockStatus(quantity: number, minStock: number): { label: string; tone: Tone } {
  if (quantity <= 0) return { label: "Rupture", tone: "destructive" };
  if (quantity < minStock) return { label: "Stock faible", tone: "warning" };
  return { label: "Disponible", tone: "success" };
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center animate-fade-in">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Loading skeleton rows ---------- */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

/* ---------- Confirm delete ---------- */
export function ConfirmDelete({
  open,
  onOpenChange,
  onConfirm,
  title = "Supprimer cet élément ?",
  description = "Cette action est irréversible.",
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  title?: string | undefined;
  description?: string | undefined;
  loading?: boolean | undefined;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm} disabled={loading}>
              Supprimer
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Card section ---------- */
export function Section({ title, description, actions, children, className }: { title?: string | undefined; description?: string | undefined; actions?: ReactNode | undefined; children: ReactNode; className?: string }) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
