export type GifTopic = {
  label: string;
  english: string;
  query: string;
  preview_url: string | null;
};

export type GifBrowseCategory = {
  id: string;
  label: string;
  english: string;
  topics: GifTopic[];
};

export async function loadGifTaxonomy(): Promise<GifBrowseCategory[]> {
  const data = await import("./taxonomy.json");
  return data.categories;
}

export function findTopicMatches(categories: GifBrowseCategory[], input: string) {
  const query = input.normalize("NFC").trim().toLowerCase();
  if (!query) return [];
  const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const initialPattern = [...query].some(char => initials.includes(char))
    ? new RegExp([...query.replace(/\s/g, "")].map(char => {
      const index = initials.indexOf(char);
      if (index < 0) return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // 한 초성에 중성 21개 × 종성 28개의 완성형 음절이 이어진다.
      const start = 0xac00 + index * 21 * 28;
      return `[${char}${String.fromCharCode(start)}-${String.fromCharCode(start + 21 * 28 - 1)}]`;
    }).join(""))
    : null;
  const matches = new Map<string, { category: GifBrowseCategory; topic: GifTopic }>();
  for (const category of categories) {
    for (const topic of category.topics) {
      const matchesText = `${topic.label} ${topic.english} ${topic.query}`.toLowerCase().includes(query);
      const matchesInitials = initialPattern?.test(topic.label.normalize("NFC").toLowerCase().replace(/\s/g, ""));
      if ((matchesText || matchesInitials) && !matches.has(topic.query)) {
        matches.set(topic.query, { category, topic });
      }
    }
  }
  return [...matches.values()];
}
