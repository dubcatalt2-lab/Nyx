import React,{useRef,useEffect} from 'react';import {createRoot} from 'react-dom/client';import Phaser from 'phaser';
const Yt='__WHITE',he={ENEMY:1},ie=()=>0,Mn=()=>1,wb=2591;
// CURRENT_GAME_DEFINITIONS
function Game(){const host=useRef(null),game=useRef(null);useEffect(()=>{
 game.current=new Phaser.Game({type:Phaser.HEADLESS,width:500,height:400,parent:host.current,audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{create(){
 window.fixtureScene=this;window.fixtureGame=this.sys.game;window.fixtureEvents=[];
 this.gameData={map:'snow',difficulty:Object.keys(Fb.snow)[0]};
 this.eventBus=new Phaser.Events.EventEmitter();const emit=this.eventBus.emit;this.eventBus.emit=function(name,...args){fixtureEvents.push(name);return emit.call(this,name,...args)};
 this.gameManager=new Kb(this);this.gameManager.level=5;
 this.sfxService={won(){},playHit(){},reduce(){}};this.textService={spawnText(){}};
 this.inputService={enableInputs(){},disableInputs(){}};
 const player=Object.assign(Object.create(tw.prototype),{sc:this,hp:40,invulnerableTime:0,magnetTime:0,speed:225,getPlayerCenter:()=>({x:200,y:200})});
 this.playerService={getPlayer:()=>player};window.fixturePlayer=player;
 this.mapService={obstacles:this.physics.add.group()};window.fixtureObstacle=this.mapService.obstacles.get(10,10,'__WHITE');
 this.enemyService={enemies:this.physics.add.group({classType:Tf}),spawnNewWave(){}};
 const enemy=this.enemyService.enemies.get();enemy.spawn(Object.keys(Fb.snow[this.gameData.difficulty])[0]);window.fixtureEnemy=enemy;window.fixtureBase={xp:enemy.val,speed:enemy.speed,hp:enemy.hp};
 this.abilityService=new Ib(this);this.abilityService.unlockAbility('laser');this.abilityService.unlockAbility('card');
 this.projectileService={};window.fixtureChoices=()=>Cb(this.abilityService.abilityLevels,this.gameManager.getLevel()+1);new Qb(this).initEventListeners();window.fixtureReady=true;
 }}});return()=>game.current.destroy(true);},[]);return React.createElement('div',{ref:host});}
createRoot(document.getElementById('root')).render(React.createElement(Game));
