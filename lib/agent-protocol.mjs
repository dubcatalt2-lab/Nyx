export {agentInstruction} from '../apps/agents/agent-instruction.js';
export function parseAgentReply(text){
  if(typeof text!=='string'||text.length>270000)throw new Error('Invalid agent response.');
  const value=JSON.parse(text);
  if(!value||typeof value.message!=='string'||value.message.length>6000)throw new Error('The model did not return a valid agent response.');
  if(value.done===true&&!value.tool)return {message:value.message,done:true};
  if(!['list','read','search','write','delete','command'].includes(value.tool)||!value.args||Array.isArray(value.args)||typeof value.args!=='object')throw new Error('The model requested an unsupported action.');
  return {message:value.message,tool:value.tool,args:value.args};
}
