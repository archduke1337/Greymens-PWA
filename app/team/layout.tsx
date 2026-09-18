export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Team"
      className="flex flex-col items-center w-full min-h-screen py-8"
    >
      <div className="w-full max-w-7xl px-4">{children}</div>
    </section>
  );
}
