import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  loading,
  children,
  submitLabel = "Enregistrer",
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string | undefined;
  onSubmit: () => void;
  loading?: boolean | undefined;
  children: ReactNode;
  submitLabel?: string | undefined;
  wide?: boolean | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto scrollbar-thin", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          {children}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="accent" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  className,
  step,
  min,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string | undefined;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  step?: string | undefined;
  min?: string | number | undefined;
}) {
  return (
    <Field label={label} className={className}>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} step={step} min={min} />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <Field label={label} className={className}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  placeholder = "Sélectionner…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export const Grid2 = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
