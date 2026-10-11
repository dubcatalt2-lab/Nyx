export function arithmetic(input,x=0){
  const text=String(input);
  if(text.length>512)throw new Error('Expression is too long.');
  const parts=[];
  let cursor=0;
  while(cursor<text.length){
    if(/\s/.test(text[cursor])){cursor++;continue;}
    const number=text.slice(cursor).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    const name=text.slice(cursor).match(/^[a-zA-Z]+|^π/);
    if(number){parts.push({kind:'number',value:Number(number[0])});cursor+=number[0].length;}
    else if(name){parts.push({kind:'name',value:name[0].toLowerCase()});cursor+=name[0].length;}
    else if('+-*/%^(),'.includes(text[cursor])){const op=text.slice(cursor,cursor+2)==='**'?'^':text[cursor];parts.push({kind:'operator',value:op});cursor+=op==='^'&&text[cursor]==='*'?2:1;}
    else throw new Error('Unsupported symbol in expression.');
  }
  const functions={sqrt:Math.sqrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,log:Math.log10,ln:Math.log,abs:Math.abs};
  let index=0;
  const value=()=>parts[index]?.value;
  const primary=()=>{
    const token=parts[index++];
    if(!token)throw new Error('Expected a number.');
    if(token.kind==='number')return token.value;
    if(token.value==='('){const n=expression();if(value()!==')')throw new Error('Missing closing parenthesis.');index++;return n;}
    if(token.kind==='name'){
      if(['pi','π','e','x'].includes(token.value))return token.value==='x'?Number(x):token.value==='e'?Math.E:Math.PI;
      if(!Object.hasOwn(functions,token.value)||value()!=='(')throw new Error('Unknown function.');
      index++;const n=expression();if(value()!==')')throw new Error('Missing closing parenthesis.');index++;return functions[token.value](n);
    }
    throw new Error('Expected a number.');
  };
  const power=()=>{let n=primary();if(value()==='^'){index++;n=n**unary();}return n;};
  const unary=()=>{if(value()==='+'||value()==='-'){const sign=value();index++;return(sign==='-'?-1:1)*unary();}return power();};
  const product=()=>{
    let n=unary();
    while(index<parts.length){
      const explicit=['*','/','%'].includes(value()),implicit=parts[index]?.kind==='name'||value()==='(';
      if(!explicit&&!implicit)break;
      const op=explicit?parts[index++].value:'*',right=unary();
      n=op==='*'?n*right:op==='/'?n/right:n%right;
    }
    return n;
  };
  const expression=()=>{let n=product();while(value()==='+'||value()==='-'){const op=parts[index++].value,right=product();n=op==='+'?n+right:n-right;}return n;};
  const result=expression();
  if(index!==parts.length)throw new Error('Unexpected expression input.');
  return result;
}
