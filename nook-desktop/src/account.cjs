const fs = require('node:fs');
const ORIGIN = 'https://nook.nyxlearning.org';
const allowed = new Set([ORIGIN, 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com']);
class Account {
  constructor({file,safeStorage,fetcher=fetch}) { Object.assign(this,{file,safeStorage,fetcher}); this.session=null; this.pending=null; }
  load() { if(fs.existsSync(this.file)&&this.safeStorage.isEncryptionAvailable()){const value=JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.file)));if(typeof value.uid==='string'&&typeof value.refreshToken==='string'&&/^n_api_[A-Za-z0-9_-]{43}$/.test(value.key))this.session=value;} }
  persist() { if(!this.safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');const temporary=this.file+'.tmp';fs.writeFileSync(temporary,this.safeStorage.encryptString(JSON.stringify(this.session)),{mode:0o600});fs.renameSync(temporary,this.file); }
  forget() { this.session=null;if(fs.existsSync(this.file))fs.unlinkSync(this.file); }
  async json(url,{body,token,method,form=false}={}) {
    if(!allowed.has(new URL(url).origin))throw Error('Untrusted account endpoint.');
    const response=await this.fetcher(url,{method:method||(body?'POST':'GET'),redirect:'error',signal:AbortSignal.timeout(30000),headers:{Origin:ORIGIN,...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:form?new URLSearchParams(body).toString():JSON.stringify(body)}:{})});
    const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2000000)throw Error('Account response is too large.');chunks.push(Buffer.from(chunk));}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Error('Account service is temporarily unavailable.');}
    if(!response.ok){const code=typeof data.error==='string'?data.error:data.error?.message;const friendly={INVALID_LOGIN_CREDENTIALS:'Email or password is incorrect.',EMAIL_NOT_FOUND:'Email or password is incorrect.',INVALID_PASSWORD:'Email or password is incorrect.',USER_DISABLED:'This account is disabled.',TOO_MANY_ATTEMPTS_TRY_LATER:'Too many attempts. Please try again later.',TOKEN_EXPIRED:'Your session expired. Sign in again.',INVALID_REFRESH_TOKEN:'Your session expired. Sign in again.',EMAIL_EXISTS:'This email already has an account.'};throw Error(friendly[code]||(response.status===404?'This server does not have desktop accounts enabled yet.':typeof code==='string'?code.slice(0,250):'Account request failed.'));}
    return data;
  }
  async config() { const config=await this.json(ORIGIN+'/api/founder-profile/auth-config');if(!config.enabled||typeof config.apiKey!=='string')throw Error('Account sign-in is unavailable.');return config.apiKey; }
  async signIn({email,password,username,create=false}) {
    if(typeof email!=='string'||email.length>254||!email.includes('@')||typeof password!=='string'||password.length<1||password.length>256)throw Error('Enter your email and password.');
    if(!this.safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');
    const apiKey=await this.config();let data;
    if(create){if(typeof username!=='string'||!username.trim())throw Error('Enter a username.');const result=await this.json(ORIGIN+'/api/nook-account/register',{body:{email:email.trim(),password,username:username.trim().toLowerCase()}});if(!result.customToken)throw Error('Account created. Sign in to continue.');data=await this.json('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+encodeURIComponent(apiKey),{body:{token:result.customToken,returnSecureToken:true}});}
    else data=await this.json('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(apiKey),{body:{email:email.trim(),password,returnSecureToken:true}});
    if(!data.idToken||!data.refreshToken||!data.localId)throw Error('Sign-in did not complete.');
    const connection=await this.json(ORIGIN+'/api/nook-desktop/account/connect',{body:{},token:data.idToken});
    if(connection.uid!==data.localId||!/^n_api_[A-Za-z0-9_-]{43}$/.test(connection.key))throw Error('Account connection could not be verified.');
    const previous=this.session;this.session={uid:data.localId,email:email.trim(),refreshToken:data.refreshToken,idToken:data.idToken,expires:Date.now()+Number(data.expiresIn||3600)*1000,apiKey,key:connection.key};
    try{this.persist();}catch(error){this.session=previous;throw error;}
    return {uid:this.session.uid,email:this.session.email};
  }
  async token() {
    if(!this.session)throw Error('Sign in to your Nook account.');
    if(this.session.idToken&&this.session.expires>Date.now()+60000)return this.session.idToken;
    if(this.pending)return this.pending;
    const session=this.session;
    this.pending=(async()=>{const data=await this.json('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(session.apiKey),{form:true,body:{grant_type:'refresh_token',refresh_token:session.refreshToken}});if(this.session!==session)throw Error('Account changed. Please retry.');if(data.user_id!==session.uid||!data.id_token||!data.refresh_token)throw Error('Session could not be verified.');Object.assign(session,{idToken:data.id_token,refreshToken:data.refresh_token,expires:Date.now()+Number(data.expires_in||3600)*1000});this.persist();return session.idToken;})().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async details() { const data=await this.json(ORIGIN+'/api/nook-desktop/account',{token:await this.token()});if(data.uid!==this.session?.uid)throw Error('Account changed. Please sign in again.');return data; }
  async revoke() { await this.json(ORIGIN+'/api/nook-desktop/account/key',{token:await this.token(),method:'DELETE'});this.forget(); }
  async reset(email) { if(typeof email!=='string'||!email.includes('@')||email.length>254)throw Error('Enter your account email first.');const apiKey=await this.config();await this.json('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(apiKey),{body:{requestType:'PASSWORD_RESET',email:email.trim()}});return true; }
}
module.exports={Account};
