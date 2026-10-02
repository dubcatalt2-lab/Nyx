// Logs into an existing provider account; never registers accounts or requests email codes.
export async function loginProviderAccount({email, password, sn}, request) {
  if(!email || !password || !sn)throw new Error('Cloud Gaming needs a configured provider account. Ask the owner to finish setup.');
  const response=await request('/users/emailLogin',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password,sn,model:'Chrome/147.0.0.0',version_code:'1',version_name:'1.0.0',device_name:'Cloud Gaming',os:'web'})});
  let data;try{data=await response.json()}catch{throw new Error('The cloud provider returned an unreadable sign-in response.');}
  if(!response.ok || Number(data?.status)!==200)throw new Error(`The cloud provider rejected account sign-in (status ${Number(data?.status)||response.status}). Check the configured provider account.`);
  const cookie=response.headers.get('set-cookie')||'';
  const token=String(cookie.match(/(?:^|[;,]\s*)as_user_token=([^;]+)/)?.[1] || data.data?.user_token || '');
  if(!token)throw new Error('The cloud provider signed in without returning a session token.');
  return {sn,token};
}

// checkCost is a preflight, not a payment. Never request a game server after it
// rejects the account, and never pass raw provider/account details to a client.
export async function requireGameAccess(response) {
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('The cloud provider returned an unreadable game-access check.'); }
  const code = Number(payload?.status);
  if (code === 3004) throw new Error('Cloud Gaming needs streaming credit on the provider account. The owner must top up that account before games can start.');
  if (!response.ok || code !== 200) throw new Error(`The cloud provider denied game access (status ${Number.isFinite(code) ? code : response.status}). Ask the owner to check the provider account.`);
  return payload;
}
