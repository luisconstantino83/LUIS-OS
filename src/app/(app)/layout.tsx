import { Sidebar, TabBar } from "@/components/nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="safe-top min-w-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-10">{children}</div>
      </main>
      <TabBar />
    </div>
  );
}
