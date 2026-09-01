import React, { useEffect, useRef } from "react";
import ImageDisplay from "./ImageDisplay";

interface ZoomOverlayProps {
  isClosing: boolean;
  onClose: () => void;
  imageBlob: Blob | null;
  alt: string;
}

const ZoomOverlay: React.FC<ZoomOverlayProps> = ({ isClosing, onClose, imageBlob, alt }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      previouslyFocused.current = active;
    }
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      className={`fixed inset-0 z-100 flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-sm transition-all duration-300 outline-none ${
        isClosing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
        } else if (e.key === "Enter" || e.key === " ") {
          onClose();
        }
      }}
    >
      <ImageDisplay
        imageBlob={imageBlob}
        alt={alt}
        instant
        className={`max-h-full max-w-full rounded-sm object-contain shadow-2xl transition-transform duration-300 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      />
    </div>
  );
};

export default ZoomOverlay;
