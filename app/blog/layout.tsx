// app/blog/layout.tsx
import { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-default-100">
      {children}
    </div>
  );
}