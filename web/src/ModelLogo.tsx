import { type Component } from "solid-js";

import BrandMark, { type Brand } from "./BrandMark";

// AC-L2: lowercase the free-text model, then substring-match in a FIXED priority order,
// first match wins; no match / empty / absent → generic.
const modelToBrand = (model: string | null | undefined): Brand => {
  const needle = (model ?? "").toLowerCase();

  if (needle.includes("claude")) {
    return "claude";
  }

  // "chatgpt" model ids contain "gpt", so the gpt check covers ChatGPT too.
  if (needle.includes("gpt") || needle.includes("openai")) {
    return "openai";
  }

  if (
    needle.includes("gemini") ||
    needle.includes("google") ||
    needle.includes("bard")
  ) {
    return "gemini";
  }

  // xAI's Grok. Current model ids all carry "grok", but the provider is stylized "xAI"
  // and its slug is "x-ai/…", so match those too — note "x-ai" does NOT contain "xai".
  if (
    needle.includes("grok") ||
    needle.includes("xai") ||
    needle.includes("x-ai")
  ) {
    return "grok";
  }

  return "generic";
};

// AC-L3: on a champion card the mark is an accessible image naming its authoring brand —
// never the only signal (the model text label accompanies it).
const LABELS: Record<Brand, string> = {
  claude: "authored by Claude",
  openai: "authored by OpenAI",
  gemini: "authored by Gemini",
  grok: "authored by Grok",
  generic: "Mystery challenger",
};

// The champion's model → its authoring brand's mark, labelled for assistive tech.
const ModelLogo: Component<{ model: string | null | undefined }> = (props) => {
  const brand = (): Brand => modelToBrand(props.model);

  return <BrandMark brand={brand()} label={LABELS[brand()]} />;
};

export default ModelLogo;
