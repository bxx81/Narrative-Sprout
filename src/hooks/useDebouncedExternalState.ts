import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Buffers an externally-controlled value in local state to prevent input lag
 * during typing, while keeping the external state in sync via a debounced
 * callback. External updates (e.g., record switches) reset the local value
 * unless they echo what we just sent.
 */
export function useDebouncedExternalState<T>(
  externalValue: T,
  setExternalValue: (val: T) => void,
  delay = 500,
): [T, (val: T) => void] {
  const [localValue, setLocalValue] = useState(externalValue);

  const [prevExternalValue, setPrevExternalValue] = useState(externalValue);
  const [lastSentValue, setLastSentValue] = useState(externalValue);

  const setExternalRef = useRef(setExternalValue);
  useEffect(() => {
    setExternalRef.current = setExternalValue;
  }, [setExternalValue]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    if (externalValue !== lastSentValue) {
      setLocalValue(externalValue);
      setLastSentValue(externalValue);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (value: T) => {
      setLocalValue(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setLastSentValue(value);
        setExternalRef.current(value);
      }, delay);
    },
    [delay],
  );

  return [localValue, handleChange];
}
