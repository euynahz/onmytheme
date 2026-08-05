"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from "react";
import { Loader2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onError?: () => void;
}

const imageCache = new Set<string>();

export function ZoomableImage({
  src,
  alt,
  className = "",
  containerClassName = "",
  onError,
}: ZoomableImageProps) {
  const [loadedSrc, setLoadedSrc] = useState(() => (imageCache.has(src) ? src : null));
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const isLoaded = loadedSrc === src;
  const hasError = errorSrc === src;

  const handleLoad = useCallback(() => {
    setLoadedSrc(src);
    imageCache.add(src);
  }, [src]);

  const handleError = useCallback(() => {
    setErrorSrc(src);
    onError?.();
  }, [onError, src]);

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-[#1e1e2e]", containerClassName)}>
        <div className="flex items-center gap-2 font-mono text-sm text-white/40">
          <Terminal className="h-4 w-4" />
          {alt}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[#1e1e2e]", containerClassName)}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className={cn(
          "h-auto max-w-full object-contain transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
