function removeDistraction(cleanup){
 const overlays=[...document.querySelectorAll('._wrapper_10lfc_1')];
 if(!overlays.length)throw Error('No fishing distraction is on screen.');
 for(const element of overlays){const display=element.style.getPropertyValue('display'),priority=element.style.getPropertyPriority('display');element.style.setProperty('display','none','important');cleanup(()=>{if(element.style.getPropertyValue('display')==='none'){if(display)element.style.setProperty('display',display,priority);else element.style.removeProperty('display');}});}
}
export function adaptFishingAction(path){if(path!=='fishing/removeDistraction.js')return null;return {code:`(${removeDistraction.toString()})(onBlooketCleanup)`,adapted:0,expected:[],requirements:[{kind:'selector',value:'._wrapper_10lfc_1'}],implementation:'native-fishing'};}
