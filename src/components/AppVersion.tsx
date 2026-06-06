import { APP_VERSION_STRING } from "@/lib/utils/version";
import { cn } from "@/lib/utils";

type Props = { className?: string };

export function AppVersion({ className }: Props) {
  return (
    <span
      className={cn(
        "select-none font-mono text-[10px] tracking-wide text-muted-foreground",
        className,
      )}
      aria-label="App version"
    >
      {APP_VERSION_STRING}
    </span>
  );
}
