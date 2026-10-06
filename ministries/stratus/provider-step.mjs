// Kept self-contained: the launcher inserts this function into its generated runtime.
export async function requireProviderStep(response, stage) {
  let payload;
  try { payload=await response.json(); } catch {
    throw new Error(`The cloud provider returned an unreadable ${stage} response (HTTP ${response.status}).`);
  }
  if (!response.ok || Number(payload?.status)!==200) {
    const code=Number(payload?.status);
    const detail=Number.isFinite(code)?`provider ${code}`:`HTTP ${response.status}`;
    const reason=String(payload?.msg||'').replace(/https?:\/\/\S+/gi,'[link]').replace(/[\w.+-]+@[\w.-]+/g,'[email]').replace(/\b[A-Za-z0-9_-]{24,}\b/g,'[redacted]').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,120);
    throw new Error(`The cloud provider rejected ${stage} (${detail})${reason?`: ${reason}`:'.'}`);
  }
  return payload;
}
