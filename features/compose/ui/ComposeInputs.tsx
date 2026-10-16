"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon, ImageIcon, MagnifyingGlassIcon, PauseIcon, PlayIcon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import type { OnboardingStory } from "@/features/onboarding/model/stories";
import { findScenePreset } from "@/features/gif-search/model/scene-presets";
import { ScenePreview } from "@/features/gif-search/ui/ScenePreview";
import { GifSearchSheet } from "@/features/gif-search/ui/GifSearchSheet";
import { trackEvent } from "@/shared/lib/umami";
import styles from "./ComposeInputs.module.css";

type Props = {
  gif: Gif | null; photo: string | null; example?: OnboardingStory; busy: boolean;
  onScene: (gif: Gif) => void; onUpload: () => void; onSample: () => void; onClearPhoto: () => void;
  picker: "browse" | "search" | null; onOpenPicker: (mode: "browse" | "search") => void; onClosePicker: () => void;
};

function ExamplePreview({ example }: { example: OnboardingStory }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className={styles.exampleMedia}>
    <video ref={video} src={example.result} poster={example.poster} muted loop playsInline preload="metadata" aria-label={example.resultAlt}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} />
    <button type="button" className={styles.play} aria-label={playing ? "완성 예시 일시정지" : "완성 예시 재생"} onClick={() => {
      if (playing) video.current?.pause();
      else void video.current?.play().catch(() => setFailed(true));
    }}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
    {failed && <p role="status">예시 영상을 재생하지 못했어요.</p>}
  </div>;
}

export function ComposeInputs({ gif, photo, example, busy, onScene, onUpload, onSample, onClearPhoto, picker, onOpenPicker, onClosePicker }: Props) {
  const [sceneOptions, setSceneOptions] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const sceneButton = useRef<HTMLButtonElement>(null);
  const preset = gif ? findScenePreset(gif) : undefined;
  const initialExample = example && !photo && preset?.id === example.sceneId;
  return <section className={styles.root} aria-label="합성 재료">
    <h1>{photo ? "이 조합으로 만들어볼까요?" : "어떤 장면에 누구를 넣어볼까요?"}</h1>
    <p className={styles.subtitle}>{initialExample ? "예시 장면을 써도, 다른 장면을 골라도 돼요." : "장면의 움직임 + 사진 속 주인공"}</p>
    <div className={styles.ingredients}>
      <div role="group" aria-label="선택한 원본 GIF"><h2>움직임을 가져올 장면</h2>
        <button ref={sceneButton} type="button" className={styles.slot} aria-label={gif ? "장면 바꾸기" : "장면 고르기"} aria-expanded={sceneOptions} aria-controls="compose-scene-options" onClick={() => setSceneOptions(open => !open)}>
          <span className={styles.slotMedia}>{preset ? <ScenePreview key={preset.id} scene={preset} /> : gif ? <img src={getGifUrl(gif, "md")} alt="selected gif" /> : <ImageIcon aria-hidden="true" />}</span>
          <span className={styles.slotAction}><UpdateIcon aria-hidden="true" />{gif ? "장면 바꾸기" : "장면 고르기"}</span>
        </button><span className={styles.caption}>{gif?.title ?? "움직임이 마음에 드는 장면"}</span>
      </div>
      <PlusIcon className={styles.plus} aria-label="더하기" />
      <div role="group" aria-label="주인공 사진"><h2>{photo ? "넣은 사진" : "주인공으로 넣을 사진"}</h2>
        <button type="button" disabled={busy} className={styles.slot + (!photo ? " " + styles.emptyPhoto : "")} aria-label={photo ? "사진 바꾸기" : "사진 넣기"} onClick={onUpload}>
          <span className={styles.slotMedia}>{photo ? <img src={photo} alt="my photo"
            onLoad={() => trackEvent("photo_preview_loaded")}
            onError={() => trackEvent("photo_preview_failed")} /> : <ImageIcon aria-hidden="true" />}</span>
          <span className={styles.slotAction}>{photo ? <UpdateIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}{busy ? "준비 중…" : photo ? "사진 바꾸기" : "사진 넣기"}</span>
        </button><span className={styles.caption}>{photo ? "선택한 사진" : "나 · 친구 · 우리 동물"}{photo && <> · <button type="button" aria-label="사진 삭제" disabled={busy} onClick={onClearPhoto}>삭제</button></>}</span>
        {!photo && example && <button type="button" className={styles.sample} disabled={busy} onClick={onSample}>예시 사진 써보기</button>}
      </div>
    </div>
    {sceneOptions && <div id="compose-scene-options" className={styles.options}><h2>장면을 바꿔볼까요?</h2><p>{photo ? "사진은 그대로 두고, 장면만 골라요." : "마음에 드는 장면을 골라보세요."}</p>
      <div className={styles.optionsGrid}><button type="button" onClick={() => onOpenPicker("browse")}><ImageIcon /><strong>다른 장면 둘러보기</strong><span>키워드와 미리보기부터</span></button><button type="button" onClick={() => onOpenPicker("search")}><MagnifyingGlassIcon /><strong>직접 검색하기</strong><span>떠오르는 장면이 있다면</span></button></div>
      <button type="button" className={styles.quiet} onClick={() => { setSceneOptions(false); sceneButton.current?.focus(); }}>이 장면 그대로 쓰기</button>
    </div>}
    {example && <details className={styles.example} onToggle={event => setExampleOpen(event.currentTarget.open)}>
      <summary><img src={example.poster} alt="" /><span>완성 예시 보기</span><ChevronDownIcon aria-hidden="true" /></summary>
      {exampleOpen && <div className={styles.exampleContent}><ExamplePreview example={example} />
        <div className={styles.examplePhoto}><img src={example.target} alt="예시에 쓰인 사진" /><p>{initialExample ? "이 장면에 이 사진을 넣어 만든 예시예요." : "처음 본 예시예요. 지금 고른 조합의 결과는 아직 없어요."}</p></div>
      </div>}
    </details>}
    {gif && photo && !sceneOptions && <p className={styles.ready}>두 재료가 준비됐어요.</p>}
    {notice && <p role="status" className={styles.hint}>{notice}</p>}
    {picker && <GifSearchSheet selectedId={gif?.id ?? null} initialMode={picker} photo={photo ?? undefined} hasPhoto={Boolean(photo)} onClose={onClosePicker} onSelect={next => {
      onScene(next); onClosePicker(); setSceneOptions(false);
      setNotice(photo ? "장면을 바꿨어요. 사진은 그대로 유지했어요." : "장면을 골랐어요. 주인공 사진을 넣어보세요.");
      requestAnimationFrame(() => sceneButton.current?.focus({ preventScroll: true }));
    }} />}
  </section>;
}
