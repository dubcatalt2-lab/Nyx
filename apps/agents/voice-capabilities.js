export function supportsConversationVoice(model){
 return !!model?.outputModalities?.includes('audio')&&!/(?:^|[\/ _-])(lyria|musicgen|suno|udio)(?:[\/ _-]|$)/i.test(String(model.id||model.model||''));
}
