"use client";
import { Cross2Icon } from "@radix-ui/react-icons";
import { type Gif, getGifUrl } from "@/entities/gif/model";
import { useSelectedGifFrame } from "@/features/gif-search/model/use-gif-frames";
import { FrameStatus } from "@/features/gif-search/ui/GifFrameInfo";
export function ComposeBar({ selectedGif, onCompose, onClear }: { selectedGif: Gif | null; onCompose: () => void; onClear: () => void }) {
  const frame = useSelectedGifFrame(selectedGif);
  if (!selectedGif) return null;
  return <div className="selection-bar"><img src={getGifUrl(selectedGif, "sm")} alt="" />
    <div className="selection-info"><span>{selectedGif.title}</span><FrameStatus frame={frame} compact /></div>
    <button className="continue" onClick={() => onCompose()}>이 GIF로 만들기</button>
    <button className="clear-selection" aria-label="GIF 선택 취소" onClick={onClear}><Cross2Icon /></button>
  </div>;
}
