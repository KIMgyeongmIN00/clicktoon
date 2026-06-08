import { googleAdapter } from "./google";
import { openaiAdapter } from "./openai";
import { GenerateAdapter, Provider } from "./types";

export const adapters: Record<Provider, GenerateAdapter> = {
  google: googleAdapter,
  openai: openaiAdapter,
};
