import React,{useRef,useEffect} from 'react';import {createRoot} from 'react-dom/client';import Phaser from 'phaser';
// CURRENT_GAME_DEFINITIONS
const B=mh;
function Game(){const host=useRef(null),game=useRef(null);useEffect(()=>{
 game.current=new Phaser.Game({type:Phaser.HEADLESS,width:500,height:400,parent:host.current,audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{create(){
 window.fixtureScene=this;window.fixtureGame=this.sys.game;window.fixtureEvents=[];
 this.gameData={coins:100,health:80,round:3,towers:[],difficulty:'normal'};this.eventBus=new Phaser.Events.EventEmitter();const emit=this.eventBus.emit;this.eventBus.emit=function(name,...args){fixtureEvents.push([name,...args]);return emit.call(this,name,...args);};
 this.gameManager=new uv(this);this.dmgCounterService=new sv(this);this.mapService={getMap:()=>({tiles:[]})};this.rangeService={clearRange(){}};
 this.nightmareService={getUnlockedTowers:()=>[],showUnlockableTowers(){}};this.towerAbilityService={removeFish(){}};this.sfxService={waveDone(){},playMusic(){}};
 const towers=this.physics.add.group({classType:wt});const tower=towers.get();tower.type="chick";tower.stats=Cd("chick",0);tower.towerPlatform={setLevel(){}};tower.buffs={};window.fixtureTower=tower;
 this.towerService=Object.assign(Object.create(fw.prototype),{sc:this,selectedGameTower:null,towers:{basic:towers,buffAuraTowers:this.physics.add.group(),toucans:this.physics.add.group()}});
 const enemies=this.physics.add.group({classType:ov});const enemy=enemies.get();enemy.hp=20;window.fixtureEnemy=enemy;
 this.enemyService=Object.assign(Object.create(lv.prototype),{sc:this,waveNum:3,isWaveActive:false,canStartWave:true,enemyQueue:[{health:2}],extraRounds:[{count:4,types:[3],ghostTypes:[false]}],nextEnemy:10,enemies});
 window.fixtureReady=true;
 }}});return()=>game.current.destroy(true);},[]);return React.createElement('div',{ref:host});}
createRoot(document.getElementById('root')).render(React.createElement(Game));
