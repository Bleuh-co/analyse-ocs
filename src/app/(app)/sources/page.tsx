import { requireSession } from "@/lib/auth-server";

export default async function SourcesPage() {
  await requireSession();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-6">🔌 Sources API</h1>
      <div className="card p-8 text-center text-gray-400">
        <p>🚧 Page en construction</p>
        <p className="text-sm mt-2">Configuration des sources API — voir Antigravity.md</p>
      </div>
    </main>
  );
}
