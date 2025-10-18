// Types for the OpenAI bridge API
// Based on OpenAI Apps SDK examples

export type DisplayMode = "inline" | "fullscreen";

export type Theme = "light" | "dark";

export interface OpenAiGlobal {
  // Tool output data passed to the widget
  toolOutput: unknown;

  // Persistent widget state
  widgetState: unknown;
  setWidgetState: (state: unknown) => void;

  // Display mode (inline or fullscreen)
  displayMode: DisplayMode;
  requestDisplayMode: (mode: DisplayMode) => void;

  // Theme
  theme: Theme;

  // Subscribe to changes
  subscribe: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    openai: OpenAiGlobal;
    oai?: {
      widget?: {
        setState?: (state: unknown) => void;
        getState?: () => unknown;
      };
    };
  }
}

export {};
