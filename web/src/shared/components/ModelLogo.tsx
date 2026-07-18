import { type Component } from "solid-js";

import BrandMark from "./BrandMark";
import { modelToBrand, type Brand } from "../lib/brand";

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
