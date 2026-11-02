import { WSC_BRAND } from "@/lib/wsc-brand";

export function WscMark({
  tone = "color",
  className = "h-full w-full object-contain",
}: {
  tone?: "color" | "white";
  className?: string;
}) {
  return (
    <img
      src={tone === "white" ? WSC_BRAND.markWhite : WSC_BRAND.markColor}
      alt=""
      className={className}
    />
  );
}
