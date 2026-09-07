import { SiteHeader } from "../../components/layout/SiteHeader";
import { NewTenderForm } from "./NewTenderForm";

export const dynamic = "force-dynamic";

export default function NewTenderPage() {
  return (
    <div className="page-backdrop min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] px-6 py-12">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Tender setup
        </p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight">Start a new tender</h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
          Give the tender its particulars. You will upload the notice inviting
          tender (NIT) and confirm the extracted checklist on the next screen.
          Nothing is verified until you confirm that checklist.
        </p>
        <NewTenderForm />
      </main>
    </div>
  );
}