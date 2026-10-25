import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
function Quiz(){
 const [question,setQuestion]=useState({question:'First question',answers:['A','B'],correctAnswers:['A']});
 const [answer,setAnswer]=useState('');
 window.fixtureNext=()=>{setAnswer('');setQuestion({question:'Second question',answers:['C','D'],correctAnswers:['D']});};
 return <main>{question&&<section><h1>{question.question}</h1>{question.answers.map(text=><button key={text} onClick={()=>{setAnswer(text);setQuestion(null)}}>{text}</button>)}</section>}<output aria-label="Selected answer">{answer}</output></main>;
}
createRoot(document.getElementById('root')).render(<Quiz/>);
