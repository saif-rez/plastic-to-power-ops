import { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths, isToday, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatHours, formatTime } from "@/lib/format";

type Att = { work_date: string; clock_in: string; clock_out: string | null; hours: number | null };

export function AttendanceCalendar({ attendance, month, onMonthChange }: { attendance: Att[]; month?: Date | undefined; onMonthChange?: (d: Date) => void }) {
  const [internal, setInternal] = useState(new Date());
  const current = month ?? internal;
  const setMonth = (d: Date) => (onMonthChange ? onMonthChange(d) : setInternal(d));

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) });
  const offset = (getDay(startOfMonth(current)) + 6) % 7;
  const byDate = new Map(attendance.map((a) => [a.work_date, a]));
  const total = days.reduce((s, d) => s + Number(byDate.get(format(d, "yyyy-MM-dd"))?.hours ?? 0), 0);
  const worked = days.filter((d) => byDate.has(format(d, "yyyy-MM-dd"))).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold capitalize">{format(current, "MMMM yyyy", { locale: fr })}</p>
          <p className="text-xs text-muted-foreground">
            {worked} jours · {formatHours(total)}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth(subMonths(current, 1))} aria-label="Mois précédent">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth(addMonths(current, 1))} aria-label="Mois suivant">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const a = byDate.get(key);
          const weekend = isWeekend(d);
          return (
            <div
              key={key}
              title={a ? `${formatTime(a.clock_in)} → ${formatTime(a.clock_out)}` : undefined}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition-all duration-200",
                a ? (a.clock_out ? "border-success/30 bg-success/12 text-success hover:scale-105" : "border-info/40 bg-info/15 text-info") : weekend ? "border-transparent bg-muted/40 text-muted-foreground/50" : "border-border text-muted-foreground",
                isToday(d) && "ring-2 ring-accent ring-offset-1 ring-offset-card",
              )}
            >
              <span className="font-semibold">{format(d, "d")}</span>
              {a?.hours != null && <span className="hidden text-[10px] opacity-80 sm:block">{formatHours(a.hours)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
