import { useCallback } from "react";
import { useNavigate, type NavigateFunction, type NavigateOptions, type To } from "react-router";

/**
 * useNavigate with the route-change scroll reset applied before the
 * navigation commits.
 *
 * The ViewTransition route animation captures the outgoing screen before
 * the navigation commits, and that snapshot tracks the live scroll
 * position. Resetting the scroll after the commit — as the route-change
 * effect does — therefore scrolls the fading-out screen mid-animation.
 * Popstate (Back/Forward) does not animate and keeps using the effect.
 */
export function useAppNavigate(): NavigateFunction {
  const navigate = useNavigate();
  return useCallback(
    (toOrDelta: To | number, options?: NavigateOptions) => {
      window.scrollTo({ top: 0, behavior: "instant" });
      if (typeof toOrDelta === "number") {
        navigate(toOrDelta);
        return;
      }
      navigate(toOrDelta, options);
    },
    [navigate],
  );
}
