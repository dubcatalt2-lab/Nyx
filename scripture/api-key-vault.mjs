import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';

// Keep this persistent file outside the public site and database backups.
export function createApiKeyVault(file=process.env.NYX_API_KEY_VAULT_FILE||
  (process.platform==='win32'?join(homedir(),'.nyx','api-key-vault.key'):'/var/lib/nyx/api-keys/vault.key')) {
  let pending;
  function key(create=true){
    return pending ||= (async()=>{
      try{return await readKey();}catch(error){if(error.code!=='ENOENT'||!create)throw error;}
      await mkdir(dirname(file),{recursive:true,mode:0o700});
      try{await writeFile(file,randomBytes(32),{flag:'wx',mode:0o600});}
      catch(error){if(error.code!=='EEXIST')throw error;}
      return readKey();
    })().catch(error=>{pending=null;throw error;});
  }
  async function readKey(){const value=await readFile(file);if(value.length!==32)throw Error('Invalid API key vault file.');return value;}
  return {
    async seal(value,context){
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await key(),iv);
      cipher.setAAD(Buffer.from(context));
      const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
      return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
    },
    async open(value,context){
      if(value?.version!==1||typeof value.data!=='string'||value.data.length>256)throw Error('Invalid encrypted API key.');
      const decipher=createDecipheriv('aes-256-gcm',await key(false),Buffer.from(value.iv,'base64'));
      decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(value.tag,'base64'));
      return Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8');
    }
  };
}
