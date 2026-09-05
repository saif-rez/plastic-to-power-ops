import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const formatCurrency = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    Number(n ?? 0),
  );

export const formatNumber = (n: number | string | null | undefined, digits = 0) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(Number(n ?? 0));

export const formatDate = (d: string | Date | null | undefined, pattern = "d MMM yyyy") => {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern, { locale: fr });
};

export const formatDateTime = (d: string | Date | null | undefined) => formatDate(d, "d MMM yyyy, HH:mm");

export const formatTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");

export const formatHours = (h: number | string | null | undefined) => {
  const v = Number(h ?? 0);
  const hh = Math.floor(v);
  const mm = Math.round((v - hh) * 60);
  return `${hh}h${mm.toString().padStart(2, "0")}`;
};

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const nowTime = () => format(new Date(), "HH:mm");

export const initials = (first: string, last?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
