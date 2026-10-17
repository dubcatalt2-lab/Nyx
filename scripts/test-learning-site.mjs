import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDomainPages} from '../services/domain-pages/server.mjs';
import {lessons,makeProblem,numericAnswer,correctAnswer} from '../services/domain-pages/curriculum.mjs';
import {textbookData,bookUnits} from '../services/domain-pages/textbook.mjs';
const expected=[1,2,2,1,1,1,4,160,5];
lessons.slice(0,9).forEach((lesson,i)=>assert.equal(makeProblem(lesson.id,()=>0).answer,expected[i]));
const secondaryExpected={integers:-17,coordinates:2,slope:-12,'linear-functions':-9,systems:-5,quadratics:-7,distance:5,exponents:0,logarithms:-3,trigonometry:4/5,'arithmetic-sequences':-23,'polynomial-remainder':16,composition:51,'geometric-sequences':8,derivatives:-20};
for(const [id,answer] of Object.entries(secondaryExpected))assert.equal(makeProblem(id,()=>0).answer,answer,id);
for(const lesson of lessons){assert.equal(lesson.examples.length,2);for(let i=0;i<100;i++){const problem=makeProblem(lesson.id);assert(Number.isFinite(problem.answer),lesson.id);assert(problem.hint&&problem.steps.length);assert(correctAnswer(String(problem.answer),problem.answer));}}
assert.equal(numericAnswer('1/0'),null);assert.equal(numericAnswer('alert(1)'),null);assert(correctAnswer('2/4',.5));assert(correctAnswer(' -3 / 2 ',-1.5));assert(!correctAnswer('0.333',1/3));
assert.equal(bookUnits.length,15);for(const unit of textbookData()){const all=[...unit.guided,...unit.independent,...unit.applications,...unit.review];assert.equal(all.length,24);for(const problem of all){assert(Number.isFinite(problem.answer));assert(problem.steps.length);}assert.equal(new Set([...unit.guided,...unit.independent,...unit.review].map(q=>q.prompt)).size,20);}
const dataDir=await mkdtemp(join(tmpdir(),'learning-test-')),service=await createDomainPages({dataDir,adminPort:0,publicPort:0}),browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));const origin=`http://127.0.0.1:${service.admin.address().port}`;
 await page.goto(origin+'/preview?title=StudyReady');await page.locator('#course-view:not([hidden])').waitFor();assert.equal(await page.locator('.skill:visible').count(),24);
 await page.screenshot({path:join(tmpdir(),'learning-desktop.png'),fullPage:true});
 await page.fill('#skill-search','triangle');assert.equal(await page.locator('.skill:visible').count(),4);await page.fill('#skill-search','no such topic');assert(await page.locator('#no-skills').isVisible());await page.fill('#skill-search','');
 await page.locator('a[href="#practice/one-step"]').first().click();
 await page.fill('#answer','99999');await page.locator('#check-answer').click();assert.equal(await page.locator('#feedback').getAttribute('data-kind'),'incorrect');
 for(let i=0;i<5;i++){const prompt=await page.locator('#problem').textContent(),[,a,b]=prompt.match(/x \+ (\d+) = (\d+)/);await page.fill('#answer',String(Number(b)-Number(a)));await page.locator('#check-answer').click();assert.equal(await page.locator('#feedback').getAttribute('data-kind'),'correct');if(i<4)await page.locator('#next-question').click();}
 assert.match(await page.locator('#practice-count').textContent(),/Skill complete/);await page.reload();assert.match(await page.locator('#practice-count').textContent(),/Skill complete/);
 await page.locator('#show-hint').click();assert(await page.locator('#hint').isVisible());await page.locator('#show-solution').click();assert(await page.locator('#solution').isVisible());assert(await page.locator('#answer').isDisabled());
 await page.locator('#review-lesson').click();await page.locator('#lesson-one-step').waitFor({state:'visible'});await page.locator('a[data-nav=progress]').click();assert.match(await page.locator('#progress-rows').textContent(),/Complete/);
 await page.goto(origin+'/preview?title=StudyReady#practice/area');await page.locator('.triangle').waitFor();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(tmpdir(),'learning-mobile.png'),fullPage:true});
 await page.addInitScript(()=>{Math.random=()=>0;});
 for(const [id,answer] of Object.entries(secondaryExpected)){await page.goto(origin+'/preview?title=StudyReady&fixture='+id+'#practice/'+id);await page.locator('#answer').waitFor();await page.fill('#answer',String(answer));await page.locator('#check-answer').click();assert.equal(await page.locator('#feedback').getAttribute('data-kind'),'correct',id);}
 for(let grade=7;grade<=12;grade++){await page.goto(origin+'/preview?title=StudyReady&fixture=grade'+grade+'#course/grade'+grade);await page.locator('#course-view:not([hidden])').waitFor();assert.equal(await page.locator('.skill:visible').count(),4);assert.equal(await page.locator('#course-heading').textContent(),`Grade ${grade} Math`);}
 await page.goto(origin+'/textbook');assert.equal(await page.locator('.sheet').count(),150);assert.equal(await page.locator('.answers li').count(),360);assert.equal(await page.locator('.model').count(),15);
 assert.deepEqual(errors,[]);console.log('PASS learning site: answer parsing, 24 generators, 15 textbook units/360 questions, search, incorrect/correct retries, completion/persistence, hints/solutions, lessons, progress and mobile.');
}finally{await browser.close();await service.close();await rm(dataDir,{recursive:true,force:true});}
