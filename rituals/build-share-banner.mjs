import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});await page.setContent('<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}</style>'+await readFile(resolve(root,'relics/social/prayer-reflection.svg'),'utf8'));await page.screenshot({path:resolve(root,'relics/social/prayer-reflection.png')});}finally{await browser.close();}
