import type { Gif } from "@/entities/gif/model";

export const scenePresets = [
  { id: "cat-typing", title: "쉴 틈 없는 타자", description: "답장 쏟아내는 나", keyword: "폭풍 타자", query: "cat typing", source: "/examples/onboarding/dog-typing-source.gif", width: 498, height: 498, size: 3731999 },
  { id: "cat-reaction", title: "방금 뭐라고?", description: "말문이 막혔을 때", keyword: "어이없음", query: "cat shocked", source: "/examples/scenes/cat-reaction.gif", width: 498, height: 498, size: 5972013 },
  { id: "topgun-highfive", title: "우리 해냈다!", description: "성공했을 때 하이파이브", keyword: "하이파이브", query: "top gun high five", source: "/examples/scenes/topgun-highfive.gif", width: 498, height: 281, size: 2672659 },
  { id: "gatsby-toast", title: "너를 위해 건배", description: "축하를 보내고 싶을 때", keyword: "건배", query: "gatsby toast", source: "/examples/scenes/gatsby-toast.gif", width: 498, height: 498, size: 4826608 },
  { id: "cat-running", title: "전력 질주", description: "지금 달려가는 중", keyword: "달리기", query: "forrest gump running", source: "/examples/onboarding/cat-running-source.gif", width: 220, height: 301, size: 485830 },
  { id: "face-online", title: "나 접속했다", description: "게임 시작할 때", keyword: "접속", query: "getting online", source: "/examples/onboarding/face-online-source.gif", width: 498, height: 389, size: 6408569 },
] as const;

export type ScenePreset = typeof scenePresets[number];

export function presetGif(preset: ScenePreset, origin: string): Gif {
  const format = { url: new URL(preset.source, origin).href, width: preset.width, height: preset.height, size: preset.size };
  return { id: `preset-${preset.id}`, slug: preset.id, title: preset.title,
    file: { hd: { gif: format }, md: { gif: format }, sm: { gif: format }, xs: { gif: format } }, blur_preview: "" };
}

export function findScenePreset(gif: Gif): ScenePreset | undefined {
  return scenePresets.find(preset => gif.id === `preset-${preset.id}`);
}
