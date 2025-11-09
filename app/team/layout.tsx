export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center w-full min-h-screen">
      <div className="w-full max-w-7xl">
        {children}
      </div>
    </section>
  );
}