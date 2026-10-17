import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/build-vps.mjs'],{stdio:'inherit',env:{...process.env,NYX_ZAKA_OBFUSCATION:'1',NYX_BUILD_OUTPUT:process.env.NYX_BUILD_OUTPUT||'.codex-artifacts/nyx-zaka-build'}});
process.exitCode=result.status??1;
