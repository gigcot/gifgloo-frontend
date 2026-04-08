import { ResultClient } from "../[assetId]/ResultClient";

export default function ResultTestPage() {
  return (
    <ResultClient
      resultUrl="https://picsum.photos/seed/gifgloo/480/480"
      assetId="test"
    />
  );
}
