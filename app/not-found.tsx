"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@heroui/react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 text-center sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-default-200/70">
        <Image
          alt="A lost club member surrounded by signposts, a cracked 404, and a terminal suggesting the page moved"
          className="w-full object-cover"
          height={1024}
          src="/Assets/Objects/404.png"
          width={1536}
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Some bytes went missing
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
          This page doesn&apos;t exist, or it moved. Debug, learn, improve,
          repeat — starting with the links below.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Button className="rounded-full px-6" onPress={() => router.push("/")}>
          Go home
        </Button>
        <Button
          className="rounded-full px-6"
          variant="secondary"
          onPress={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/");
            }
          }}
        >
          Go back
        </Button>
      </div>
    </div>
  );
}
