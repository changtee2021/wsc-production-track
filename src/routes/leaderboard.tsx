import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, RefreshCw, Loader2, Medal, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getLeaderboard } from "@/lib/scoring.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard พนักงาน — WSC ProductionTrack" }] }),
  component: Page,
});

type Row = {
  id: string; name: string; avatar_url: string | null; emp_code: string | null;
  points: number; jobs: number; on_time_pct: number; badges: number;
};

function Page() {
  const fn = useServerFn(getLeaderboard);
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn({ data: { range } });
      setRows(r.rows as Row[]);
    } finally { setLoading(false); }
  }, [fn, range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" /> Leaderboard พนักงาน
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
              {(["today", "week", "month"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={cn("px-3 py-1 rounded transition",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {r === "today" ? "วันนี้" : r === "week" ? "สัปดาห์" : "เดือน"}
                </button>
              ))}
            </div>
            <button onClick={load} className="p-2 rounded-md border border-border hover:bg-muted">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-20 text-center text-muted-foreground">
            ยังไม่มีคะแนนในช่วงนี้
          </CardContent></Card>
        ) : (
          <>
            {/* Podium */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
              {[1, 0, 2].map((idx) => {
                const e = top3[idx]; if (!e) return <div key={idx} />;
                const heights = ["h-40", "h-52", "h-32"];
                const colors = ["from-slate-300 to-slate-100", "from-amber-400 to-amber-200", "from-orange-400 to-orange-200"];
                const icons = [<Medal key="s" className="h-6 w-6 text-slate-500" />, <Crown key="g" className="h-7 w-7 text-amber-600" />, <Medal key="b" className="h-6 w-6 text-orange-600" />];
                const place = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                return (
                  <div key={e.id} className="flex flex-col items-center gap-2">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt={e.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover ring-4 ring-background shadow-lg" />
                    ) : (
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
                        {e.name.charAt(0)}
                      </div>
                    )}
                    <div className="text-center">
                      <div className="font-semibold text-sm sm:text-base truncate max-w-[120px]">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.jobs} งาน • {e.on_time_pct}% ทัน</div>
                    </div>
                    <div className={cn("w-full rounded-t-xl bg-gradient-to-t flex flex-col items-center justify-end pb-3 gap-1", heights[place], colors[place])}>
                      {icons[place]}
                      <div className="text-2xl sm:text-3xl font-black text-foreground">{e.points}</div>
                      <div className="text-xs font-semibold opacity-70">อันดับ {idx + 1}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4-10 */}
            {rest.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {rest.map((e, i) => (
                      <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 text-center font-bold text-muted-foreground">{i + 4}</div>
                        {e.avatar_url ? (
                          <img src={e.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold">{e.name.charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{e.name}</div>
                          <div className="text-xs text-muted-foreground">{e.jobs} งาน • {e.on_time_pct}% ทัน{e.badges > 0 ? ` • 🏅 ${e.badges}` : ""}</div>
                        </div>
                        <div className="text-xl font-bold">{e.points}</div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <p className="text-center text-xs text-muted-foreground">รีเฟรชอัตโนมัติทุก 30 วินาที</p>
          </>
        )}
      </div>
    </div>
  );
}
