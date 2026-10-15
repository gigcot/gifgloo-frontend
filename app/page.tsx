import { HomeExperience } from "./HomeExperience";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ browse?: string }>;
}) {
  const { browse } = await searchParams;
  return <HomeExperience browsing={browse === "1"} />;
}
