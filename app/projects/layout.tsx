export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-7xl px-4">
        {children}
      </div>
    </section>
  );
}
