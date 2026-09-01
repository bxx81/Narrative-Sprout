import { useCallback, useEffect, useRef, useState } from "react";
import { FALLBACK_IMAGE_URL, TRANSPARENT_IMAGE_URL } from "./imageFallbacks";
import styles from "./ImageDisplay.module.css";

interface ImageDisplayProps {
  imageBlob: Blob | null;
  alt: string;
  className?: string;
  instant?: boolean;
}

/**
 * Scene image display with a two-layer crossfade (ported from legacy;
 * source is the AssetRecord blob instead of an OPFS File).
 */
const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageBlob,
  alt,
  className = "",
  instant = false,
}) => {
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const [baseSrc, setBaseSrc] = useState<string>(() => {
    if (instant && imageBlob) {
      return URL.createObjectURL(imageBlob);
    }
    return TRANSPARENT_IMAGE_URL;
  });
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const incomingSrcRef = useRef<string | null>(null);
  const prevBaseSrcRef = useRef<string>(baseSrc);

  const trackBlobUrl = useCallback((url: string) => {
    if (url.startsWith("blob:")) {
      blobUrlsRef.current.add(url);
    }
  }, []);

  const revokeBlobUrl = useCallback((url: string) => {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  }, []);

  useEffect(() => {
    const initialSrc = prevBaseSrcRef.current;
    if (initialSrc.startsWith("blob:")) {
      blobUrlsRef.current.add(initialSrc);
    }
  }, []);

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const prev = prevBaseSrcRef.current;
    prevBaseSrcRef.current = baseSrc;
    if (prev !== baseSrc) {
      revokeBlobUrl(prev);
    }
  }, [baseSrc, revokeBlobUrl]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const loadImage = async () => {
      if (imageBlob) {
        if (instant) {
          objectUrl = URL.createObjectURL(imageBlob);
          trackBlobUrl(objectUrl);
          setBaseSrc(objectUrl);
          return;
        }

        await Promise.resolve();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(imageBlob);
        trackBlobUrl(objectUrl);

        const img = new Image();
        img.src = objectUrl;
        img.onload = () => {
          if (!cancelled) {
            incomingSrcRef.current = objectUrl!;
            setIncomingSrc(objectUrl!);
          }
        };
        img.onerror = () => {
          if (!cancelled) {
            console.error("Failed to load scene image");
            incomingSrcRef.current = null;
            setBaseSrc(FALLBACK_IMAGE_URL);
            setIncomingSrc(null);
          }
        };
      } else {
        if (instant) {
          setBaseSrc(TRANSPARENT_IMAGE_URL);
          return;
        }
        await Promise.resolve();
        if (!cancelled) {
          incomingSrcRef.current = null;
          setBaseSrc(TRANSPARENT_IMAGE_URL);
          setIncomingSrc(null);
        }
      }
    };

    void loadImage();

    return () => {
      cancelled = true;
      // Don't revoke objectUrl here – it may be in use as baseSrc or incomingSrc.
    };
  }, [imageBlob, trackBlobUrl, instant]);

  const handleCrossfadeEnd = useCallback(() => {
    const incoming = incomingSrcRef.current;
    if (!incoming) return;
    incomingSrcRef.current = null;
    setBaseSrc(incoming);
    setIncomingSrc(null);
  }, []);

  return (
    <>
      <img
        ref={incomingSrc ? undefined : imgRef}
        src={baseSrc}
        alt={alt}
        className={`transition-[filter] duration-300 ease-in-out ${className}`}
      />
      {incomingSrc && (
        <img
          ref={imgRef}
          src={incomingSrc}
          alt={alt}
          className={`${styles["animate-crossfade-in"]} absolute inset-0 m-auto ${className}`}
          onAnimationEnd={handleCrossfadeEnd}
        />
      )}
    </>
  );
};

export default ImageDisplay;
