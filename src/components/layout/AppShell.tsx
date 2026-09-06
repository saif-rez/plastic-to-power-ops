import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Zap,
  Truck,
  Settings,
  LogOut,
  Bell,
  Menu,
  Moon,
  Sun,
  Cable,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { applyStoredTheme, isDarkTheme, toggleTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employés", icon: Users },
  { to: "/clients", label: "Clients", icon: Building2, adminOnly: true },
  { to: "/products", label: "Produits", icon: Package, adminOnly: true },
  { to: "/energy", label: "Énergie", icon: Zap, adminOnly: true },
  { to: "/suppliers", label: "Fournisseurs", icon: Truck, adminOnly: true },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/employees": "Employés",
  "/clients": "Clients",
  "/products": "Produits & stock",
  "/energy": "Énergie",
  "/suppliers": "Fournisseurs",
  "/settings": "Paramètres",
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-glow">
        <Cable className="size-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-sidebar-accent-foreground">PolyCable</p>
          <p className="text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/60">
            Plastique → Câbles
          </p>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Navigation
        </p>
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <item.icon className={cn("size-[18px] transition-transform duration-200 group-hover:scale-110", active && "text-sidebar-primary")} />
              <span>{item.label}</span>
              <ChevronRight className={cn("ml-auto size-4 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60", active && "opacity-60")} />
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <LogOut className="size-[18px]" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

function Notifications() {
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["notifications"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: products }, { data: invoices }] = await Promise.all([
        supabase.from("products").select("id,name,quantity,min_stock"),
        supabase.from("invoices").select("id,invoice_number,status,total").eq("status", "en_retard"),
      ]);
      const notes: { id: string; text: string; tone: "destructive" | "warning" }[] = [];
      products?.forEach((p) => {
        if (p.quantity <= 0) notes.push({ id: `p-${p.id}`, text: `Rupture de stock : ${p.name}`, tone: "destructive" });
        else if (p.quantity < p.min_stock) notes.push({ id: `p-${p.id}`, text: `Stock faible : ${p.name} (${p.quantity})`, tone: "warning" });
      });
      invoices?.forEach((i) => notes.push({ id: `i-${i.id}`, text: `Facture ${i.invoice_number} en retard`, tone: "destructive" }));
      return notes;
    },
  });
  const count = data?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground ring-2 ring-background">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Alertes</div>
        <ul className="max-h-80 divide-y overflow-y-auto scrollbar-thin">
          {count === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune alerte</li>}
          {data?.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.tone === "destructive" ? "bg-destructive" : "bg-warning")} />
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    applyStoredTheme();
    setDark(isDarkTheme());
  }, []);
  return (
    <Button variant="ghost" size="icon" className="rounded-full" aria-label="Changer de thème" onClick={() => setDark(toggleTheme() === "dark")}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}

function UserMenu() {
  const { profile, user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const [first, last] = name.split(" ");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-muted">
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
            {initials(first ?? "", last)}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold">{name}</span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {role === "admin" ? "Administrateur" : "Employé"}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Settings className="mr-2 size-4" /> Paramètres
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 size-4" /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = "/" + pathname.split("/")[1];
  const title = TITLES[base] ?? "PolyCable";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarNav />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <h2 className="hidden text-lg font-semibold tracking-tight lg:block">{title}</h2>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
