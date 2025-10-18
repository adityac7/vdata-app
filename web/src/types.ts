// Types for the OpenAI bridge API
// Based on official OpenAI Apps SDK examples

export type UnknownObject = Record<string, unknown>;

export type Theme = "light" | "dark";

export type DisplayMode = "pip" | "inline" | "fullscreen";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SafeArea = {
  insets: SafeAreaInsets;
};

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type UserAgent = {
  device: { type: DeviceType };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
};

export type RequestDisplayMode = (args: { mode: DisplayMode }) => Promise<{
  mode: DisplayMode;
}>;

export type CallToolResponse = {
  result: string;
};

export type CallTool = (
  name: string,
  args: Record<string, unknown>
) => Promise<CallToolResponse>;

export type OpenAiGlobals<
  ToolInput = UnknownObject,
  ToolOutput = UnknownObject,
  ToolResponseMetadata = UnknownObject,
  WidgetState = UnknownObject
> = {
  // Visuals
  theme: Theme;
  userAgent: UserAgent;
  locale: string;

  // Layout
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;

  // State
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
  setWidgetState: (state: WidgetState) => Promise<void>;
};

// API methods injected by the web sandbox
type API = {
  callTool: CallTool;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
  openExternal(payload: { href: string }): void;
  requestDisplayMode: RequestDisplayMode;
};

// Event system for subscribing to changes
export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

export class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<OpenAiGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}

// Global window.openai object
declare global {
  interface Window {
    openai: API & OpenAiGlobals;
    oai?: {
      widget?: {
        setState?: (state: unknown) => void;
        getState?: () => unknown;
      };
    };
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}

export {};
