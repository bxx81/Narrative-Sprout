import { useState, useEffect, useRef } from "react";
import { assetRepository } from "../db/assetRepository";
import type { AssetRecord } from "../types/asset";

/**
 * Resolves once the browser has decoded `url` (or immediately on error), so a
 * card can mount an already-painted image and fade it in over the spinner
 * instead of popping it in mid-decode (ImageDisplay behavior).
 */
const preloadImage = (url: string): Promise<void> =>
  new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve();
    probe.onerror = () => resolve();
    probe.src = url;
  });

/**
 * Lazy-loads a node image (AssetRecord blob -> object URL) when the element
 * enters the viewport. v2 equivalent of the legacy useLazyNodeImage, reading
 * from the Dexie `assets` store instead of OPFS.
 *
 * `getAsset` overrides the IndexedDB read (e.g. History reuses the
 * already-loaded store assets instead of re-reading IndexedDB per card).
 * It is stored in a ref so inline closures don't restart the load effect.
 */
export const useLazyNodeImage = (
  nodeId: string | null,
  options: {
    rootMargin?: string;
    fallbackUrl?: string | null;
    getAsset?: (nodeId: string) => Promise<AssetRecord | undefined>;
  } = {},
) => {
  const { rootMargin = "200px", fallbackUrl = null, getAsset } = options;
  const getAssetRef = useRef(getAsset);
  getAssetRef.current = getAsset;

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
        const asset = getAssetRef.current
          ? await getAssetRef.current(nodeId)
          : await assetRepository.get(nodeId);
        if (isCancelled) return;

        let nextImageUrl: string | null = null;
        if (asset) {
          objectUrl = assetRepository.toObjectUrl(asset);
          nextImageUrl = objectUrl;
        } else if (fallbackUrl) {
          nextImageUrl = fallbackUrl;
        }

        // Decode before flipping `isLoading` so the card fades the image in
        // over the spinner rather than revealing it mid-decode.
        if (nextImageUrl) {
          await preloadImage(nextImageUrl);
          if (isCancelled) return;
        }
        setImageUrl(nextImageUrl);
      } catch (err) {
        console.warn(`Could not load image for node ${nodeId}`, err);
        if (fallbackUrl) {
          await preloadImage(fallbackUrl);
          if (!isCancelled) setImageUrl(fallbackUrl);
        }
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
