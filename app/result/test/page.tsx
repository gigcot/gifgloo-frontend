import { ResultClient } from "../[assetId]/ResultClient";

export default function ResultTestPage() {
  return (
    <ResultClient
      resultUrl="https://picsum.photos/seed/gifgloo/480/480"
      shareUrl="http://localhost:3000/result/test"
      downloadUrl="http://localhost:8000/assets/shared/test/download"
    />
  );
}
