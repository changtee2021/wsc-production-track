import { Link } from "@tanstack/react-router";
import { Factory } from "lucide-react";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-primary via-primary to-secondary text-primary-foreground shadow-lg shadow-primary/20">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
            <Factory className="h-4 w-4" />
          </div>
          <span>ProductionTrack</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">{children}</div>
      </div>
    </header>
  );
}
