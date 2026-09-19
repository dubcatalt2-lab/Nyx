import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createDomainPages} from '../services/domain-pages/server.mjs';
const dataDir=process.env.DOMAIN_PAGES_DATA_DIR||join(homedir(),'.nyx','domain-pages');
await mkdir(dataDir,{recursive:true});
const service=await createDomainPages({dataDir,adminPort:0,publicPort:0}),browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1200,height:1100}});
 await page.goto(`http://127.0.0.1:${service.admin.address().port}/textbook`);await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const layout=await page.evaluate(()=>[...document.querySelectorAll('.sheet')].map((sheet,i)=>({page:i+1,overflow:sheet.querySelector('.page-body').getBoundingClientRect().bottom>sheet.querySelector('footer').getBoundingClientRect().top-10})));
 if(layout.length!==150||layout.some(item=>item.overflow))throw new Error('Textbook layout failed: '+JSON.stringify(layout.filter(item=>item.overflow)));
 const path=join(dataDir,'textbook.pdf');await page.pdf({path,preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
 const pdf=await readFile(path);const pageCount=[...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;if(pageCount!==150)throw new Error(`Expected 150 PDF pages, got ${pageCount}`);
 console.log(`Built and checked ${pageCount} pages: ${path}`);
}finally{await browser.close();await service.close();}
