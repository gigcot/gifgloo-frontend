import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultClient } from "./ResultClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.gifgloo.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gifgloo.com";

type Asset = { result_url: string };

async function fetchAsset(assetId: string): Promise<Asset | null> {
  const res = await fetch(`${API_BASE}/assets/${assetId}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetId: string }>;
}): Promise<Metadata> {
  const { assetId } = await params;
  const asset = await fetchAsset(assetId);
  if (!asset) return { title: "Gifgloo" };

  const pageUrl = `${APP_URL}/result/${assetId}`;
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
  const { assetId } = await params;
  const asset = await fetchAsset(assetId);
  if (!asset) notFound();

  return <ResultClient resultUrl={asset.result_url} assetId={assetId} />;
}
