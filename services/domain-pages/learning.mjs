import {units,lessons,makeProblem,correctAnswer,numericAnswer} from './curriculum.mjs';
const $=id=>document.getElementById(id),key='learning.progress.v1:'+document.title;
let records={},current=null,skill=null,answered=false,attempted=false,filter='';
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const lesson of lessons){const row=saved?.[lesson.id];if(row&&Number.isSafeInteger(row.correct)&&Number.isSafeInteger(row.attempted)&&row.correct>=0&&row.attempted>=row.correct)records[lesson.id]=row;}}catch{}
const score=id=>records[id]||{correct:0,attempted:0};
function save(){try{localStorage.setItem(key,JSON.stringify(records));}catch{$('storage-status').textContent='Storage is unavailable. Progress will last only until this page closes.';}updateProgress();}
function updateProgress(){
 let completed=0,active=0,correct=0;
 for(const lesson of lessons){const row=score(lesson.id);correct+=row.correct;if(row.correct>=5)completed++;else if(row.attempted)active++;document.querySelector(`[data-count="${lesson.id}"]`).textContent=row.correct>=5?'Completed':`${row.correct} of 5 correct`;document.querySelector(`[data-progress="${lesson.id}"]`).value=Math.min(5,row.correct);document.querySelector(`[data-skill="${lesson.id}"]`).classList.toggle('complete',row.correct>=5);}
 $('stat-skills').textContent=`${completed} / ${lessons.length}`;$('stat-correct').textContent=correct;$('stat-active').textContent=active;
 $('progress-rows').replaceChildren(...lessons.map(lesson=>{const tr=document.createElement('tr'),row=score(lesson.id);for(const value of [lesson.name,row.correct,row.attempted,row.correct>=5?'Complete':row.attempted?'In progress':'Not started']){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
 if(skill)$('practice-count').textContent=score(skill.id).correct>=5?'Skill complete · Extra practice':`${score(skill.id).correct} / 5 correct`;
}
function filterSkills(){let visible=0;for(const unit of units){let count=0;for(const lesson of lessons.filter(item=>item.unit===unit.id)){const show=(!filter||filter===unit.id)&&`${lesson.name} ${lesson.objective}`.toLowerCase().includes($('skill-search').value.toLowerCase().trim());document.querySelector(`[data-skill="${lesson.id}"]`).hidden=!show;if(show)count++;}document.querySelector(`[data-unit="${unit.id}"]`).hidden=!count;visible+=count;}$('no-skills').hidden=visible!==0;}
function nextQuestion(){
 current=makeProblem(skill.id);answered=false;attempted=false;$('answer').value='';$('answer').disabled=false;$('check-answer').disabled=false;$('next-question').hidden=true;
 for(const id of ['feedback','hint','solution'])$(id).hidden=true;
 $('problem').textContent=current.prompt;$('problem-diagram').replaceChildren();
 if(current.diagram){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 260 180');svg.classList.add('triangle');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Right triangle with base ${current.labels[0]} and perpendicular height ${current.labels[1]}`);svg.innerHTML='<path d="M45 20V145H225Z" fill="#eef5fa" stroke="currentColor" stroke-width="2"/><path d="M45 130h15v15" fill="none" stroke="currentColor"/>';current.labels.forEach((label,i)=>{const text=document.createElementNS(ns,'text');text.setAttribute('x',i?'8':'110');text.setAttribute('y',i?'88':'169');text.setAttribute('font-size','14');text.textContent=label;svg.append(text);});$('problem-diagram').append(svg);const caption=document.createElement('p');caption.className='help-text';caption.textContent='Diagram not to scale.';$('problem-diagram').append(caption);}
 updateProgress();$('answer').focus({preventScroll:true});
}
function route(){
 const [view,rawId]=(location.hash.slice(1)||'courses').split('/');
 const id=view==='course'?({foundations:'grade7',algebra:'grade9',geometry:'grade10'}[rawId]||rawId):rawId;
 const lesson=lessons.find(item=>item.id===id),unit=units.find(item=>item.id===id);
 const valid=['courses','progress'].includes(view)||(view==='course'&&unit)||(['lesson','practice'].includes(view)&&lesson);
 if(!valid){location.hash='courses';return;}
 $('course-view').hidden=!['courses','course'].includes(view);$('progress-view').hidden=view!=='progress';$('practice-view').hidden=view!=='practice';
 for(const element of document.querySelectorAll('[data-lesson]'))element.hidden=view!=='lesson'||element.dataset.lesson!==id;
 for(const link of document.querySelectorAll('[data-nav]')){const active=link.dataset.nav===(view==='course'?`course/${id}`:view==='lesson'||view==='practice'?`course/${lesson.unit}`:view);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 filter=view==='course'?id:'';$('course-heading').textContent=unit?.name||'My courses';$('course-description').textContent=unit?.description||'Choose a skill to study or pick up where you left off.';filterSkills();
 if(view==='practice'){skill=lesson;$('practice-title').textContent=lesson.name;$('review-lesson').href=`#lesson/${lesson.id}`;nextQuestion();}
 updateProgress();scrollTo({top:0,behavior:'instant'});
}
$('skill-search').addEventListener('input',filterSkills);
$('answer-form').onsubmit=event=>{event.preventDefault();if(answered)return;const feedback=$('feedback');feedback.hidden=false;if(numericAnswer($('answer').value)===null){feedback.dataset.kind='incorrect';feedback.textContent='Enter a number or a fraction with a nonzero denominator.';return;}const row={...score(skill.id)};if(!attempted){row.attempted++;attempted=true;}if(correctAnswer($('answer').value,current.answer)){row.correct++;answered=true;feedback.dataset.kind='correct';feedback.textContent=row.correct===5?'Correct. You have completed this skill!':'Correct. Good work.';$('next-question').hidden=false;$('check-answer').disabled=true;$('answer').disabled=true;}else{feedback.dataset.kind='incorrect';feedback.textContent='Not quite. Try again, or open a hint to see the next step.';}records[skill.id]=row;save();};
$('next-question').onclick=nextQuestion;
$('show-hint').onclick=()=>{$('hint').textContent=current.hint;$('hint').hidden=false;};
$('show-solution').onclick=()=>{const title=document.createElement('h3');title.textContent='Worked solution';const list=document.createElement('ol');list.className='steps';for(const step of current.steps){const li=document.createElement('li');li.textContent=step;list.append(li);}$('solution').replaceChildren(title,list);$('solution').hidden=false;if(!attempted){const row={...score(skill.id)};row.attempted++;records[skill.id]=row;attempted=true;save();}answered=true;$('answer').disabled=true;$('check-answer').disabled=true;$('next-question').hidden=false;};
$('reset-progress').onclick=()=>{if(confirm('Clear all practice progress saved for this site on this device?')){records={};save();}};
addEventListener('hashchange',route);route();
