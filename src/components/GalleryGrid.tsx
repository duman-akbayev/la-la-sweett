"use client";

// =============================================================================
// La La Sweett — Gallery Grid
// Responsive masonry-style image grid with hover lift/zoom and a click-to-expand
// lightbox (with prev/next + keyboard support). Used for the simplified
// "Our Cakes" showcase — pure inspiring photography, no pricing/menu clutter.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";

export interface GalleryGridImage {
  src: string;
  alt: string;
}

interface GalleryGridProps {
  images: GalleryGridImage[];
}

export function GalleryGrid({ images }: GalleryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      setLightboxIndex((current) => {
        if (current === null) return null;
        if (direction === "prev")
          return current === 0 ? images.length - 1 : current - 1;
        return current === images.length - 1 ? 0 : current + 1;
      });
    },
    [images.length],
  );

  // Keyboard navigation while the lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navigate("prev");
      else if (e.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, closeLightbox, navigate]);

  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {images.map((image, index) => (
          <button
            key={image.src}
            onClick={() => setLightboxIndex(index)}
            className="group relative block w-full overflow-hidden rounded-image shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            aria-label={`View ${image.alt}`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={400}
              height={500}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="h-auto w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-brand-espresso/0 transition-colors duration-300 group-hover:bg-brand-espresso/10" />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-espresso/90 backdrop-blur-md"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close lightbox"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate("prev");
            }}
            className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Previous image"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            className="relative h-[80vh] w-[90vw] max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightboxIndex].src}
              alt={images[lightboxIndex].alt}
              fill
              sizes="90vw"
              className="rounded-card object-contain"
              priority
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate("next");
            }}
            className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Next image"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="absolute bottom-4 text-sm text-white/60">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
