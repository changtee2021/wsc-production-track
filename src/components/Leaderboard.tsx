// Weekly leaderboard widget — top 10 employees by points in the last 7 days.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Medal, Sparkles } from "lucide-react";
import { getWeeklyLeaderboard } from "@/lib/features/production-jobs.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf, flagFor } from "@/lib/utils/i18n";
import { cn } from "@/lib/utils";

type Row = {
  employee_id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  nationality: string | null;
  points: number;
  bonus: number;
  finished: number;
};

export function Leaderboard({ className }: { className?: string }) {
  const fn = useServerFn(getWeeklyLeaderboard);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fn();
        setRows(res.rows as Row[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fn]);

  return (
    <section
      className={cn(
        "rounded-3xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-bold">บอร์ดคนขยันประจำสัปดาห์</h2>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีคะแนนในสัปดาห์นี้</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.employee_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                i === 0 && "border-amber-400/60 bg-amber-50 dark:bg-amber-500/10",
                i === 1 && "border-zinc-400/40 bg-zinc-50 dark:bg-zinc-800/40",
                i === 2 && "border-orange-400/40 bg-orange-50 dark:bg-orange-500/10",
              )}
            >
              <div className="w-6 text-center font-bold">
                {i < 3 ? (
                  <Medal
                    className={cn(
                      "inline h-5 w-5",
                      i === 0 && "text-amber-500",
                      i === 1 && "text-zinc-400",
                      i === 2 && "text-orange-500",
                    )}
                  />
                ) : (
                  i + 1
                )}
              </div>
              <Avatar className="h-9 w-9 border">
                {r.avatar_url ? <AvatarImage src={r.avatar_url} alt={r.name} /> : null}
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {initialsOf(r.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-lg">{flagFor(r.nationality)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.finished} งาน
                  {r.bonus > 0 && (
                    <>
                      {" "}
                      · <Sparkles className="inline h-3 w-3 text-amber-500" /> {r.bonus} โบนัส
                    </>
                  )}
                </div>
              </div>
              <div className="font-mono text-base font-extrabold text-primary">{r.points}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
