import { TenderSetup } from "./TenderSetup";

export const dynamic = "force-dynamic";

export default async function TenderSetupPage({
  params,
}: {
  params: Promise<{ tenderId: string }>;
}) {
  const { tenderId } = await params;
  return <TenderSetup tenderId={tenderId} />;
}
