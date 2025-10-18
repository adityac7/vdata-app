import { useCallback, useState, type SetStateAction } from "react";
import { useOpenAiGlobal } from "./use-openai-global";

/**
 * Hook for persistent widget state that syncs with the server
 * Based on OpenAI Apps SDK examples
 *
 * @example
 * const [queryHistory, setQueryHistory] = useWidgetState<string[]>([]);
 */
export function useWidgetState<T>(
  defaultState: T | (() => T)
): readonly [T, (state: SetStateAction<T>) => void] {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T;

  const [widgetState, _setWidgetState] = useState<T>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }
    return typeof defaultState === "function"
      ? (defaultState as () => T)()
      : defaultState;
  });

  const setWidgetState = useCallback(
    (state: SetStateAction<T>) => {
      _setWidgetState((prevState) => {
        const newState =
          typeof state === "function"
            ? (state as (prevState: T) => T)(prevState)
            : state;

        // Sync state back to window.openai (async Promise<void>)
        if (
          typeof window !== "undefined" &&
          window.openai?.setWidgetState
        ) {
          window.openai.setWidgetState(newState).catch((error) => {
            console.error("Failed to sync widget state:", error);
          });
        }

        // Also support legacy oai.widget.setState
        if (
          typeof window !== "undefined" &&
          window.oai?.widget?.setState
        ) {
          window.oai.widget.setState(newState);
        }

        return newState;
      });
    },
    []
  );

  return [widgetState, setWidgetState] as const;
}
