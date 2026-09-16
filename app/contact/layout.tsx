export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
     <section className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-7xl">
        {children}
      </div>
    </section>
  );
}
