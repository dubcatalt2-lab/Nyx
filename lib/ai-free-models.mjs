// Verified zero-price OpenRouter variants; never fall back to a paid model.
export const freeAiModels = Object.freeze(['qwen/qwen3.8-27b:free','nvidia/nemotron-3.5-lightning:free','deepseek/deepseek-v4-flash-0731:free']);
export const isFreeAiModel = model => freeAiModels.includes(model);
