import { Header } from "@/shared/ui/Header";

type PolicyPageProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function PolicyPage({ title, description, children }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title={title} showBack />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm font-semibold text-purple-300">gifgloo policy</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">{description}</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#111113] p-6 text-sm leading-7 text-white/60">
          {children}
        </div>
      </main>
    </div>
  );
}
