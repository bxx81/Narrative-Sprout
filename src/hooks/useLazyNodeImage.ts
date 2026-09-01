import { useState, useEffect, useRef } from "react";
import { assetRepository } from "../db/assetRepository";

/**
 * Lazy-loads a node image (AssetRecord blob -> object URL) when the element
 * enters the viewport. v2 equivalent of the legacy useLazyNodeImage, reading
 * from the Dexie `assets` store instead of OPFS.
 */
export const useLazyNodeImage = (
  nodeId: string | null,
  options: { rootMargin?: string; fallbackUrl?: string | null } = {},
) => {
  const { rootMargin = "200px", fallbackUrl = null } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(fallbackUrl);
  const [isLoading, setIsLoading] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  useEffect(() => {
    if (!isVisible || !nodeId) {
      return;
    }

    let objectUrl: string | null = null;
    let isCancelled = false;

    const loadImage = async () => {
      await Promise.resolve();
      if (isCancelled) return;

      setIsLoading(true);
      try {
        const asset = await assetRepository.get(nodeId);
        if (isCancelled) return;

        if (asset) {
          objectUrl = assetRepository.toObjectUrl(asset);
          setImageUrl(objectUrl);
        } else if (fallbackUrl) {
          setImageUrl(fallbackUrl);
        } else {
          setImageUrl(null);
        }
      } catch (err) {
        console.warn(`Could not load image for node ${nodeId}`, err);
        if (fallbackUrl) setImageUrl(fallbackUrl);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void loadImage();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isVisible, nodeId, fallbackUrl]);

  return { elementRef, imageUrl, isLoading };
};
