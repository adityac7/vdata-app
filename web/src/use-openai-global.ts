import { useEffect, useState, useSyncExternalStore } from "react";
import type { OpenAiGlobal } from "./types";

/**
 * Hook to access a property from window.openai and subscribe to changes
 * Based on OpenAI Apps SDK examples
 *
 * @example
 * const displayMode = useOpenAiGlobal("displayMode");
 * const theme = useOpenAiGlobal("theme");
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobal>(
  key: K
): OpenAiGlobal[K] | undefined {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(typeof window !== "undefined");
  }, []);

  const value = useSyncExternalStore(
    (callback) => {
      if (!isClient || !window.openai?.subscribe) {
        return () => {};
      }
      return window.openai.subscribe(callback);
    },
    () => {
      if (!isClient || !window.openai) {
        return undefined;
      }
      return window.openai[key];
    },
    () => undefined
  );

  return value;
}
