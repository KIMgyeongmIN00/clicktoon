import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
