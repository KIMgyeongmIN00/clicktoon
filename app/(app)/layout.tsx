import { EntryGuard } from "@/lib/auth/guard";
import { Nav } from "@/components/nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EntryGuard>
      <div className="flex min-h-dvh flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
      </div>
    </EntryGuard>
  );
}
