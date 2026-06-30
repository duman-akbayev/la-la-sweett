"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

interface GalleryImage {
  src: string;
  alt: string;
}

interface GalleryProps {
  images: GalleryImage[];
  title?: string;
}

export function Gallery({ images, title }: GalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      setLightboxIndex((current) => {
        if (current === null) return null;
        if (direction === "prev") return current === 0 ? images.length - 1 : current - 1;
        return current === images.length - 1 ? 0 : current + 1;
      });
    },
    [images.length],
  );

  return (
    <>
      <div className="relative">
        {title && (
          <h3 className="mb-6 font-display text-heading-2 text-brand-brown">
            {title}
          </h3>
        )}

        <div
          ref={scrollRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4"
          role="region"
          aria-label="Image gallery"
        >
          {images.map((image, index) => (
            <button
              key={image.src}
              onClick={() => setLightboxIndex(index)}
              className="group relative aspect-portrait w-[280px] flex-shrink-0 snap-start overflow-hidden rounded-image sm:w-[320px]"
              aria-label={`View ${image.alt}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="320px"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-brand-espresso/0 transition-colors duration-300 group-hover:bg-brand-espresso/10" />
              <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-brand-espresso/60 to-transparent p-4 transition-transform duration-300 group-hover:translate-y-0">
                <span className="text-sm font-medium text-white">
                  View Full Size
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:shadow-card-hover sm:flex"
          aria-label="Scroll left"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="#8A4A63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:shadow-card-hover sm:flex"
          aria-label="Scroll right"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#8A4A63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-espresso/90 backdrop-blur-md"
          onClick={closeLightbox}
          role="dialog"
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
            onClick={(e) => { e.stopPropagation(); navigateLightbox("prev"); }}
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
            onClick={(e) => { e.stopPropagation(); navigateLightbox("next"); }}
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
