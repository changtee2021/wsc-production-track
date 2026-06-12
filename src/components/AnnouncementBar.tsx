import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  message: string;
}

export function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, message")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (mounted) setItems((data as Announcement[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("announcements-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];

  return (
    <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
      <Megaphone className="h-4 w-4 shrink-0" />
      <p key={current.id} className="flex-1 truncate animate-in fade-in slide-in-from-right-2">
        {current.message}
      </p>
      {items.length > 1 && (
        <span className="shrink-0 text-xs text-primary/70">
          {(idx % items.length) + 1}/{items.length}
        </span>
      )}
    </div>
  );
}
