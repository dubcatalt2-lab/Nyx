export const fullCatalogUid='3158eOj4ATMzkoC1PAm8H7TXc2R2';
export const hasFullAiCatalog=actor=>actor?.uid===fullCatalogUid;
export const dailyOwnerModels=Object.freeze(['openai/gpt-6-astra','anthropic/claude-fable-5.1']);
export const isDailyOwnerModel=model=>dailyOwnerModels.includes(model)||['~openai/gpt-astra-latest','~anthropic/claude-fable-latest'].includes(model);
export const ownerDailyTokenLimit=10000;

// Only provider catalog metadata may supply prices; never request-body values.
export function aiCatalogPrice(model){
  const pricing=model?.pricing;
  const number=value=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
  const input=number(pricing?.prompt),output=number(pricing?.completion);
  if(input===null||output===null)return null;
  const request=number(pricing.request??0),image=number(pricing.image??0);
  if(request===null||image===null)return null;
  return {inputPerMillion:input*1e6,outputPerMillion:output*1e6,requestUsd:request+(model.imageGeneration?image:0),imageTokens:8192};
}
