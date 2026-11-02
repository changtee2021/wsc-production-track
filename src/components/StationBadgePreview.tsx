import { employeeCodeQrSvg } from "@/lib/employee-badge";

const PHOTO =
  "https://erpzxusskbtdxvqadwxv.supabase.co/storage/v1/object/public/avatars/roster-68110103.jpg";
const CODE = "68110103";

export function StationBadgePreview() {
  return (
    <article className="mx-auto flex h-[510px] w-[320px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)]">
      <div
        className="relative h-[58%] shrink-0"
        style={{
          backgroundColor: "#29a9e1",
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 22px)",
        }}
      >
        <div
          className="absolute inset-y-0 left-0 z-[1] flex w-[30%] items-center justify-center rounded-br-[28px]"
          style={{ backgroundColor: "#3157a4" }}
        >
          <span className="rotate-180 text-[60px] font-black leading-none tracking-[0.25em] text-white [writing-mode:vertical-rl]">
            WSC
          </span>
        </div>
        <img
          src={PHOTO}
          alt="CHIT WAI PHYO"
          className="absolute top-6 right-0 bottom-0 left-[30%] h-[calc(100%-24px)] w-[70%] object-cover object-top"
        />
      </div>
      <div className="flex flex-1 flex-col bg-white py-3 pr-2 pl-3">
        <p
          className="text-[26px] font-extrabold uppercase leading-[1.05] tracking-tight"
          style={{ color: "#3157a4" }}
        >
          CHIT WAI PHYO
        </p>
        <p className="mt-0.5 text-base font-semibold" style={{ color: "#29a9e1" }}>
          อาร์
        </p>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0 space-y-2 text-[11px] leading-tight text-zinc-700">
            <div className="border-l-[3px] pl-1.5" style={{ borderColor: "#29a9e1" }}>
              <p className="font-semibold" style={{ color: "#3157a4" }}>
                รหัสพนักงาน :
              </p>
              <p>{CODE}</p>
            </div>
            <div className="border-l-[3px] pl-1.5" style={{ borderColor: "#29a9e1" }}>
              <p className="font-semibold" style={{ color: "#3157a4" }}>
                วันที่ลงทะเบียน :
              </p>
              <p>02/05/2026</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <div
              className="h-[4.5rem] w-[4.5rem] [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: employeeCodeQrSvg(CODE) }}
            />
            <p className="mt-0.5 text-right font-mono text-[10px] tracking-[0.22em] text-zinc-500">
              {CODE}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
