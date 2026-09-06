import { BidderUpload } from "./BidderUpload";

export const dynamic = "force-dynamic";

export default async function BidderUploadPage({
  params,
}: {
  params: Promise<{ tenderId: string }>;
}) {
  const { tenderId } = await params;
  return <BidderUpload tenderId={tenderId} />;
}
