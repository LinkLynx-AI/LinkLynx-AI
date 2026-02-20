import type { AppShellSlots } from "../model/types";

export function AppShellFrame({
  headerSlot,
  sidebarSlot,
  contentSlot,
}: AppShellSlots) {
  return (
    <main className="grid min-h-screen grid-cols-[240px_1fr] grid-rows-[64px_1fr] bg-discord-darkest text-white">
      <header className="col-span-2 border-b border-white/10 px-6 py-4">
        {headerSlot}
      </header>
      <aside className="border-r border-white/10 bg-discord-dark px-4 py-6">
        {sidebarSlot}
      </aside>
      <section className="bg-discord-darker px-8 py-6">{contentSlot}</section>
    </main>
  );
}
