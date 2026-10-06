import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199';
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{}}));
 await page.route('**/api/nyx-ai/providers',r=>r.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}}));
 await page.route('**/api/nyx-ai/models*',r=>r.fulfill({json:{models:[{id:'google/gemini-2.5-flash-image',label:'Gemini Image',imageGeneration:true,vision:true}]}}));
 let image,mode='image',request,personalRequest;
 await page.route('**/api/nyx-ai',r=>{request=r.request().postDataJSON();return r.fulfill({json:mode==='image'?{text:'',images:[{dataUrl:image}]}:mode==='unsafe'?{text:'',images:[{dataUrl:'https://example.com/unsafe.svg'}]}:{text:'I cannot generate that image.',images:[]}});});
 await page.route('https://openrouter.ai/api/v1/chat/completions',r=>{personalRequest=r.request().postDataJSON();return r.fulfill({json:{choices:[{message:{content:null,images:[{image_url:{url:image}}]}}]}});});
 await page.goto(base+'/ai.html');
 image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);return canvas.toDataURL();});
 const send=async prompt=>{await page.locator('#input').fill(prompt);await page.locator('#form').evaluate(f=>f.requestSubmit());};
 await send('Create a beach');await page.locator('.ai-generated-image img').waitFor();
 assert.equal(request.generateImage,true);assert.equal(request.stream,false);
 assert.equal(await page.locator('.ai-generated-image img').evaluate(i=>i.complete&&i.naturalWidth===64),true);
 const downloadPromise=page.waitForEvent('download');await page.locator('.ai-generated-image a').click();assert.equal((await downloadPromise).suggestedFilename(),'nyx-image.png');
 await page.reload();await page.locator('.ai-generated-image img').waitFor();assert.equal(await page.locator('.ai-generated-image img').getAttribute('src'),image);
 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('data:image/png;base64,'))),false,'Image bytes must stay out of localStorage');
 mode='unsafe';await send('Create another image');await page.getByText('The model returned an unsupported or oversized image.',{exact:true}).waitFor();
 mode='refusal';await send('A restricted prompt');await page.getByText('I cannot generate that image.',{exact:true}).waitFor();
 await page.locator('#customKeyButton').click();await page.locator('#customKeyInput').fill('sk-or-'+'a'.repeat(30));await page.locator('#customKeyForm').evaluate(f=>f.requestSubmit());
 await send('Create with my key');await page.waitForFunction(()=>document.querySelectorAll('.ai-generated-image img').length===2);
 assert.deepEqual(personalRequest.modalities,['text','image']);assert.equal(personalRequest.stream,false);assert.equal(personalRequest.max_tokens,2200);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS AI image chat: image-only display/download, durable reload, compact history, unsafe output rejection, explanations, personal OpenRouter key and mobile layout');
}finally{await browser.close();}
