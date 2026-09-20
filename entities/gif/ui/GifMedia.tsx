"use client";

import { useEffect, useRef, useState } from "react";
import type { Gif } from "@/entities/gif/model";

type GifSize = "hd" | "md" | "sm" | "xs";

type Props = {
  gif: Gif;
  size?: GifSize;
  alt: string;
  className?: string;
  containerClassName?: string;
  eager?: boolean;
};

export function GifMedia({
  gif,
  size = "sm",
  alt,
  className = "",
  containerClassName = "",
  eager = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(eager);
  const formats = gif.file[size];
  const fallbackFormats = gif.file.md;
  const mp4 = formats.mp4 ?? fallbackFormats.mp4;
  const webp = formats.webp ?? fallbackFormats.webp;
  const image = webp ?? formats.gif ?? fallbackFormats.gif;
  const dimensions = mp4 ?? image;

  useEffect(() => {
    if (active || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setActive(true);
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${containerClassName}`}
      style={{
        aspectRatio: dimensions ? `${dimensions.width} / ${dimensions.height}` : "1 / 1",
        background: gif.blur_preview
          ? `url(${gif.blur_preview}) center / cover`
          : "rgba(255,255,255,0.04)",
      }}
    >
      {active && mp4 ? (
        <video
          src={mp4.url}
          autoPlay
          loop
          muted
          playsInline
          preload={eager ? "auto" : "metadata"}
          aria-label={alt}
          className={className}
        />
      ) : active && image ? (
        <img
          src={image.url}
          alt={alt}
          width={image.width}
          height={image.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={className}
        />
      ) : null}
    </div>
  );
}
