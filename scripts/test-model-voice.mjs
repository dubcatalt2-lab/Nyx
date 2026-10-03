import assert from 'node:assert/strict';
import {configureModelVoice,collectModelVoice} from '../lib/model-voice.mjs';
const payload={model:'openai/voice',stream:false};configureModelVoice(payload,{outputModalities:['text','audio']},{voice:'nova'});assert.deepEqual(payload.modalities,['text','audio']);assert.equal(payload.audio.voice,'nova');assert.equal(payload.stream,true);
assert.throws(()=>configureModelVoice({},{}),/native audio/);assert.throws(()=>configureModelVoice({},{outputModalities:['audio']},{computerAgent:true}),/Chat mode/);
const events=[{model:'openai/voice',choices:[{delta:{audio:{data:Buffer.from('first').toString('base64'),transcript:'Hello '}}}]},{choices:[{delta:{audio:{data:Buffer.from('second').toString('base64'),transcript:'there'}},finish_reason:'stop'}],usage:{completion_tokens:12}}];
const wire=events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')+'data: [DONE]\n';let offset=0;const response=new Response(new ReadableStream({pull(controller){if(offset>=wire.length){controller.close();return;}controller.enqueue(new TextEncoder().encode(wire.slice(offset,offset+=7)));}}));
const result=await collectModelVoice(response);assert.equal(Buffer.from(result.voiceAudio.data,'base64').toString(),'firstsecond');assert.equal(result.choices[0].message.content,'Hello there');assert.equal(result.usage.completion_tokens,12);
await assert.rejects(()=>collectModelVoice(new Response('data: [DONE]\n')),/no audio/);await assert.rejects(()=>collectModelVoice(new Response('data: {"error":{"message":"upstream error"}}\n')),/provider/);
console.log('PASS native voice request capability guards, split SSE chunks, audio concatenation, transcript, usage and failure handling');

assert.equal(payload.audio.format,'pcm16');
assert.throws(()=>configureModelVoice({model:'google/lyria-3-pro-preview'},{outputModalities:['text','audio']}),/native audio/);
const pcm=Buffer.from([0,0,255,127,0,128,0,0]);
const pcmWire='data: '+JSON.stringify({choices:[{delta:{audio:{data:pcm.toString('base64'),transcript:'Hi'}}}]})+'\n\ndata: [DONE]\n';
const wav=await collectModelVoice(new Response(pcmWire),{format:'pcm16'});
const bytes=Buffer.from(wav.voiceAudio.data,'base64');
assert.equal(wav.voiceAudio.mime,'audio/wav');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),24000);assert.equal(bytes.readUInt16LE(22),1);assert.deepEqual(bytes.subarray(44),pcm);
await assert.rejects(()=>collectModelVoice(new Response(wire),{format:'pcm16'}),/incomplete audio/);
console.log('PASS music exclusion, streamed PCM request and playable WAV conversion');
