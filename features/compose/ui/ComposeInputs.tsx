"use client";

import { useRef, useState } from "react";
import { ImageIcon, MagnifyingGlassIcon, PauseIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";
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

export function ComposeInputs({ gif, photo, example, busy, onScene, onUpload, onSample, onClearPhoto }: Props) {
  const [sceneOptions, setSceneOptions] = useState(false);
  const [photoOptions, setPhotoOptions] = useState(false);
  const [picker, setPicker] = useState<"browse" | "search" | null>(null);
  const [notice, setNotice] = useState("");
  const sceneButton = useRef<HTMLButtonElement>(null);
  const preset = gif ? findScenePreset(gif) : undefined;
  const initialExample = example && !photo && preset?.id === example.sceneId;
  const photoPreview = photo ?? example?.target;

  function upload() { setPhotoOptions(false); onUpload(); }
  function openPicker(mode: "browse" | "search") {
    setPicker(mode);
    trackEvent("scene_picker_opened", { mode, has_photo: Boolean(photo), example: example?.id ?? "none" });
  }
  return <section className={styles.root} aria-label="합성 재료">
    <h1>{photo ? "이 조합으로 만들어볼까요?" : example ? "이 장면에 누구를 넣어볼까요?" : "장면에 사진 속 주인공을 넣어요"}</h1>
    <p className={styles.subtitle}>{initialExample ? "방금 본 장면은 그대로, 사진만 바꿔요." : "장면의 움직임 + 사진 속 주인공"}</p>
    {example && (initialExample ? <section className={styles.reference} aria-label="방금 본 완성 예시"><h2>방금 본 완성 예시</h2><ExamplePreview example={example} /><p>아래 두 재료로 만들었어요 ↓</p></section>
      : <details className={styles.oldExample}><summary>처음 본 예시 다시 보기</summary><ExamplePreview example={example} /><p>처음 본 예시예요. 지금 고른 조합의 결과는 아직 없어요.</p></details>)}
    <div className={styles.ingredients}>
      <div role="group" aria-label="선택한 원본 GIF"><h2>움직임을 가져올 장면</h2>
        <button ref={sceneButton} type="button" className={styles.slot} aria-label={gif ? "장면 옵션" : "GIF 고르기"} aria-expanded={sceneOptions} aria-controls="compose-scene-options" onClick={() => { setSceneOptions(open => !open); setPhotoOptions(false); }}>
          {preset ? <ScenePreview key={preset.id} scene={preset} /> : gif ? <img src={getGifUrl(gif, "md")} alt="selected gif" /> : <ImageIcon aria-hidden="true" />}
        </button><span className={styles.caption}>{gif?.title ?? "먼저 장면을 골라보세요"} · <button type="button" onClick={() => { setSceneOptions(open => !open); setPhotoOptions(false); }}>{gif ? "바꾸기" : "고르기"}</button></span>
      </div>
      <PlusIcon className={styles.plus} aria-label="더하기" />
      <div role="group" aria-label="주인공 사진"><h2>{photo ? "넣은 사진" : "주인공으로 넣을 사진"}</h2>
        <button type="button" disabled={busy} className={styles.slot} aria-label="사진 옵션" aria-expanded={photoOptions} aria-controls="compose-photo-options" onClick={() => { setPhotoOptions(open => !open); setSceneOptions(false); }}>
          {photoPreview ? <img src={photoPreview} alt={photo ? "my photo" : "예시에 쓰인 사진"}
            onLoad={() => { if (photo) trackEvent("photo_preview_loaded"); }}
            onError={() => { if (photo) trackEvent("photo_preview_failed"); }} /> : <ImageIcon aria-hidden="true" />}
        </button><span className={styles.caption}>{photo ? "선택한 사진" : example ? "예시 사진" : "대상이 잘 보이는 한 장"}{photo && <> · <button type="button" aria-label="사진 삭제" disabled={busy} onClick={onClearPhoto}>삭제</button></>}</span>
      </div>
    </div>
    {sceneOptions && <div id="compose-scene-options" className={styles.options}><h2>장면을 바꿔볼까요?</h2><p>{photo ? "사진은 그대로 두고, 장면만 골라요." : "마음에 드는 장면을 골라보세요."}</p>
      <div className={styles.optionsGrid}><button type="button" onClick={() => openPicker("browse")}><ImageIcon /><strong>다른 장면 둘러보기</strong><span>키워드와 미리보기부터</span></button><button type="button" onClick={() => openPicker("search")}><MagnifyingGlassIcon /><strong>직접 검색하기</strong><span>떠오르는 장면이 있다면</span></button></div>
      <button type="button" className={styles.quiet} onClick={() => { setSceneOptions(false); sceneButton.current?.focus(); }}>이 장면 그대로 쓰기</button>
    </div>}
    {photoOptions && <div id="compose-photo-options" className={styles.options}><h2>누구를 넣어볼까요?</h2><p>나 · 친구 · 우리 동물의 사진 한 장</p><button type="button" className={styles.primary} disabled={busy} onClick={upload}>기기에서 사진 고르기</button>
      {example && <button type="button" className={styles.quiet} disabled={busy} onClick={() => { setPhotoOptions(false); onSample(); }}>예시 사진으로 먼저 해보기</button>}
      <button type="button" className={styles.quiet} onClick={() => setPhotoOptions(false)}>지금 사진으로 돌아가기</button>
    </div>}
    {!photo && !sceneOptions && !photoOptions && <div className={styles.start}><button type="button" className={styles.primary} disabled={busy} onClick={upload}>{busy ? "사진을 준비하고 있어요…" : example ? "내 사진으로 바꾸기" : "사진 고르기"}</button><p>나 · 친구 · 우리 동물의 사진 한 장</p>{example && <button type="button" className={styles.quiet} disabled={busy} onClick={onSample}>예시 사진으로 먼저 해보기</button>}</div>}
    {photo && !sceneOptions && !photoOptions && <p className={styles.ready}>두 재료가 준비됐어요. 장면이나 사진을 눌러 바꿀 수 있어요.</p>}
    {notice && <p role="status" className={styles.hint}>{notice}</p>}
    {picker && <GifSearchSheet selectedId={gif?.id ?? null} initialMode={picker} photo={photoPreview} hasPhoto={Boolean(photo)} onClose={() => setPicker(null)} onSelect={next => {
      onScene(next); setPicker(null); setSceneOptions(false);
      setNotice(photo ? "장면을 바꿨어요. 사진은 그대로 유지했어요." : "장면을 골랐어요. 주인공 사진을 넣어보세요.");
      requestAnimationFrame(() => sceneButton.current?.focus({ preventScroll: true }));
    }} />}
  </section>;
}
