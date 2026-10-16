import type { ScenePreset } from "@/features/gif-search/model/scene-presets";

export type StoryPhase = {
  name: "source" | "result" | "chat";
  title: [string, string, string?];
  caption: string;
  label: string;
  duration: number;
  showPhoto?: boolean;
};

export type OnboardingStory = {
  id: string;
  sceneId: ScenePreset["id"];
  sourceVideo: string;
  layout: "pet" | "game" | "late";
  targetName: string;
  source: string;
  sourcePoster?: string;
  sourceAlt: string;
  target: string;
  result: string;
  poster: string;
  resultAlt: string;
  description: string;
  chatTitle: string;
  prompt?: string;
  send?: string;
  replies: { text: string; outgoing: boolean; sender?: string }[];
  phases: StoryPhase[];
};

const examplePath = "/examples/onboarding";

export const onboardingStories: OnboardingStory[] = [
  {
    id: "dog-typing", sceneId: "cat-typing", sourceVideo: "/examples/scenes/cat-typing.mp4", layout: "pet", targetName: "우리 강아지",
    source: `${examplePath}/dog-typing-source.gif`, sourceAlt: "고른 원본: 타자 치는 고양이",
    target: `${examplePath}/dog-typing-target.png`, result: `${examplePath}/dog-typing-result.mp4`, poster: `${examplePath}/dog-typing-poster.webp`, resultAlt: "키보드를 두드리는 우리 강아지",
    description: "타자 치는 고양이 장면에 강아지 사진을 넣었어요. 우리 강아지가 짤 속 주인공이 돼요.",
    chatTitle: "친구들과", send: "우리 애 봐ㅋㅋㅋㅋ",
    replies: [{ text: "ㅋㅋㅋㅋ 뭐야 이거 어디서 만듦?", outgoing: false, sender: "친구" }, { text: "gifgloo.com 여기서ㅋㅋ", outgoing: true }],
    phases: [
      { name: "source", title: ["키보드 앞 주인공을,", "우리 강아지", "로."], caption: "이 장면에 우리 강아지 사진을 넣으면.", label: "원본", duration: 3400 },
      { name: "result", title: ["바쁜 저 모습이,", "우리 강아지", "라면?"], caption: "키보드 앞에 앉은 주인공은 우리 강아지.", label: "합성한 짤", duration: 4800 },
      { name: "chat", title: ["혼자 보기 아까워서,", "단톡방에", " 툭."], caption: "우리 강아지로 만든 짤을, 단톡방에.", label: "", duration: 6500 },
    ],
  },
  {
    id: "face-online", sceneId: "face-online", sourceVideo: "/examples/scenes/face-online.mp4", layout: "game", targetName: "내 사진",
    source: `${examplePath}/face-online-source.gif`, sourceAlt: "고른 원본: GETTING ONLINE",
    target: `${examplePath}/face-online-v2-target.png`, result: `${examplePath}/face-online-v2-result.mp4`, poster: `${examplePath}/face-online-v2-poster.webp`, resultAlt: "내 얼굴이 들어간 GETTING ONLINE 합성짤",
    description: "GETTING ONLINE 장면에 내 사진을 넣었어요. ‘접속할게’라는 말 대신 보내는 짤이에요.",
    chatTitle: "게임할 친구에게", prompt: "오늘 게임 ㄱ?",
    replies: [{ text: "접속한다.", outgoing: true }, { text: "아니 왜 니 얼굴인데ㅋㅋㅋㅋ", outgoing: false }],
    phases: [
      { name: "chat", title: ["“오늘 게임 ㄱ?”", "내가 들어간 짤", "로 답장."], caption: "접속한다는 말도, 나답게.", label: "", showPhoto: false, duration: 4800 },
      { name: "source", title: ["이 접속 장면에,", "내 사진", "을 넣으면."], caption: "GETTING ONLINE 원본에 내 사진 한 장.", label: "원본", duration: 4800 },
      { name: "result", title: ["이제 내 얼굴로,", "접속한다."], caption: "같은 장면에 내 얼굴이 들어갔어요.", label: "합성한 짤", duration: 4800 },
      { name: "chat", title: ["“오늘 게임 ㄱ?”", "내가 들어간 짤", "로 답장."], caption: "내 사진으로 만든 짤을, 친구에게 툭.", label: "", duration: 4500 },
    ],
  },
  {
    id: "cat-running", sceneId: "cat-running", sourceVideo: "/examples/scenes/cat-running.mp4", layout: "late", targetName: "우리 고양이",
    source: `${examplePath}/cat-running-source.gif`, sourceAlt: "고른 원본: 사람이 달리는 Run Run Forest",
    target: `${examplePath}/cat-running-target.png`, result: `${examplePath}/cat-running-result.mp4`, poster: `${examplePath}/cat-running-poster.webp`, resultAlt: "사람처럼 두 발로 뛰어오는 우리 고양이 합성짤",
    description: "달리는 사람의 장면에 고양이 사진을 넣었어요. ‘지금 뛰어가는 중’이라는 말을 우리 고양이로 표현해요.",
    chatTitle: "약속에 늦었을 때", prompt: "어디야? 다 모였어ㅋㅋ",
    replies: [{ text: "지금 뛰어가는 중ㅋㅋ", outgoing: true }, { text: "ㅋㅋㅋㅋ 빨리 와", outgoing: false }],
    phases: [
      { name: "chat", title: ["늦었을 때,", "“지금 뛰어가는 중.”"], caption: "급한 내 마음을 우리 고양이로.", label: "", showPhoto: false, duration: 4800 },
      { name: "source", title: ["뛰어가는 주인공을,", "우리 고양이", "로."], caption: "사람이 달리는 장면에 우리 고양이 사진을.", label: "원본", duration: 3400 },
      { name: "result", title: ["같은 달리기도,", "우리 고양이", "라면?"], caption: "뛰어가는 그 마음을, 우리 고양이가 대신.", label: "합성한 짤", duration: 4800 },
      { name: "chat", title: ["늦었을 때,", "“지금 뛰어가는 중.”"], caption: "우리 고양이로 만든 짤로, 급한 마음을 전해요.", label: "", duration: 4500 },
    ],
  },
];
