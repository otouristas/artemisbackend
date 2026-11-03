import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = ["VIP", "Επαναλαμβανόμενος", "Οικογένεια", "Ζευγάρι", "Ντόπιος", "Μακροχρόνια"];

export function TagEditor({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };

  const suggestions = SUGGESTED.filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md border bg-secondary py-0.5 pl-2 pr-1 text-xs font-medium text-secondary-foreground"
          >
            {t}
            <button
              type="button"
              aria-label={`Αφαίρεση ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground coarse:h-6 coarse:w-6"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : "Προσθήκη ετικέτας…"}
          className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange([...value, s])}
              className="rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground coarse:py-1.5"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
