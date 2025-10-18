import { useOpenAiGlobal } from "./use-openai-global";

/**
 * Hook to access the structured tool output passed to the widget
 * Based on OpenAI Apps SDK examples
 *
 * @example
 * interface QueryResult {
 *   query: string;
 *   results: any[];
 *   status: string;
 * }
 *
 * const queryData = useWidgetProps<QueryResult>();
 */
export function useWidgetProps<T = unknown>(): T | undefined {
  return useOpenAiGlobal("toolOutput") as T | undefined;
}
