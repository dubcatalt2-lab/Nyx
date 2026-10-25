import React,{useRef,useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';import Phaser from 'phaser';
function Game(){const host=useRef(null),game=useRef(null),[score,setScore]=useState(0);useEffect(()=>{const calls=window.fixtureCalls={damage:0,magnet:0,respawn:0,spawn:null,levels:[]};class Enemy extends Phaser.Physics.Arcade.Sprite{start(){this.val=10;this.speed=8;this.hp=12;}receiveDamage(){calls.damage++;}}
 game.current=new Phaser.Game({type:Phaser.HEADLESS,width:500,height:400,parent:host.current,audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{create(){
 window.fixtureScene=this;window.fixtureGame=this.sys.game;this.sys.game.events.on('respawn',()=>calls.respawn++);this.sys.game.events.on('level up',(...a)=>calls.levels.push(a));
 const avatarCanvas=document.createElement('canvas');avatarCanvas.width=2;avatarCanvas.height=2;this.textures.addCanvas('blook-test',avatarCanvas);const player=this.physics.add.sprite(0,0,'blook-test');window.fixtureAvatar=player;const unusedPlayer=player,enemies=this.physics.add.group({classType:Enemy});const enemy=enemies.get(200,200,'__WHITE');enemy.start();window.fixtureEnemy=enemy;window.fixtureEnemies=enemies;
 this.physics.add.overlap(player,enemies,()=>calls.damage++,null,function(){return 'dmgCd'});
 this.physics.add.overlap(player,this.physics.add.sprite(300,300,'__WHITE'),function(){const magnetTime=1;calls.magnet+=magnetTime;});
 const xp={get:()=>({spawn:(...a)=>calls.spawn=a})};const xpCollider=this.physics.add.overlap(player,this.physics.add.sprite(400,300,'__WHITE'),function(){return 'emit("xp'});xpCollider.object2=xp;
 const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;this.textures.addCanvas('obstacle-test',canvas);window.fixtureObstacle=this.physics.add.sprite(350,350,'obstacle-test');
 window.fixtureReady=true;
 }}});return()=>game.current.destroy(true);},[game,setScore]);return React.createElement('div',{ref:host,id:'phaser-bouncy'},React.createElement('span',{id:'score'},score));}
class App extends React.Component{constructor(p){super(p);this.state={abilities:{laser:2},level:5};this.xp=2;window.fixtureController=this;}render(){return React.createElement(React.Fragment,null,React.createElement('span',{id:'level'},this.state.level),React.createElement(Game));}}
createRoot(document.getElementById('root')).render(React.createElement(App));
