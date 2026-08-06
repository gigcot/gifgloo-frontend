import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultClient } from "./ResultClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

type SharedAsset = { result_url: string };

async function fetchSharedAsset(shareToken: string): Promise<SharedAsset | null> {
  const res = await fetch(`${API_BASE}/assets/shared/${shareToken}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetId: string }>;
}): Promise<Metadata> {
  const { assetId: shareToken } = await params;
  const asset = await fetchSharedAsset(shareToken);
  if (!asset) return { title: "Gifgloo" };

  const pageUrl = `${APP_URL}/result/${shareToken}`;
  const description = "AI로 내 얼굴을 GIF에 합성했어요. 나도 만들어봐요!";

  return {
    title: "Gifgloo — 나의 합성 GIF",
    description,
    openGraph: {
      title: "Gifgloo — 나의 합성 GIF",
      description,
      url: pageUrl,
      type: "website",
      images: [{ url: asset.result_url, width: 480, height: 480 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Gifgloo — 나의 합성 GIF",
      description,
      images: [asset.result_url],
    },
  };
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId: shareToken } = await params;
  const asset = await fetchSharedAsset(shareToken);
  if (!asset) notFound();

  return (
    <ResultClient
      resultUrl={asset.result_url}
      shareUrl={`${APP_URL}/result/${shareToken}`}
      downloadUrl={`${API_BASE}/assets/shared/${shareToken}/download`}
    />
  );
}
