(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  const levelName = document.getElementById('level-name');
  const roomLabel = document.getElementById('room-label');
  const dashLabel = document.getElementById('dash-label');
  const deathLabel = document.getElementById('deaths');
  const toast = document.getElementById('toast');
  const startCard = document.getElementById('start-card');
  const finishCard = document.getElementById('finish-card');
  const keys = new Set();
  const pressed = new Set();
  const touch = {left:false,right:false};
  let started = false, finished = false, deaths = 0, time = 0, toastTimer = 0, transition = 0;
  let soundOn = true, audioCtx = null;

  const rooms = [
    {name:'01 — THE FOOTHILLS', sky:['#91d5d3','#e5e3c9'], goal:{x:886,y:145}, solids:[
      [0,500,232,40],[154,424,148,18],[355,350,140,18],[553,276,138,18],[758,199,202,18],
      [0,0,18,540],[942,0,18,540]
    ], spikes:[[280,500,74,22],[495,500,60,22],[691,500,70,22],[835,500,58,22]], clouds:[[90,110,1],[440,82,.7],[790,110,.9]]},
    {name:'02 — THE WINDING WALL', sky:['#85c9d0','#d3dfd1'], goal:{x:884,y:123}, solids:[
      [0,500,156,40],[145,390,118,18],[316,313,125,18],[478,233,118,18],[653,166,112,18],[796,137,164,18],
      [0,0,18,540],[942,0,18,540],[274,355,18,145],[445,270,18,105],[602,208,18,94],[765,160,18,85]
    ], spikes:[[155,500,116,22],[320,500,125,22],[489,500,120,22],[656,500,110,22],[805,500,130,22]], clouds:[[170,125,.8],[510,92,1],[840,80,.7]]},
    {name:'03 — THE OPEN SKY', sky:['#84c6d5','#e7d9bb'], goal:{x:876,y:129}, solids:[
      [0,500,155,40],[168,429,98,18],[310,348,104,18],[470,278,100,18],[614,205,106,18],[766,144,194,18],
      [0,0,18,540],[942,0,18,540],[270,456,16,44],[418,375,16,125],[577,305,16,195],[722,231,16,269]
    ], spikes:[[154,500,164,22],[265,500,153,22],[414,500,164,22],[571,500,151,22],[718,500,169,22]], clouds:[[100,100,.9],[390,130,.65],[700,83,1]]},
    {name:'04 — THE LAST LEDGE', sky:['#789db5','#ead4b5'], goal:{x:880,y:123}, solids:[
      [0,500,130,40],[119,422,108,18],[280,342,112,18],[440,267,102,18],[589,198,115,18],[744,145,216,18],
      [0,0,18,540],[942,0,18,540],[241,372,18,128],[407,297,18,203],[557,228,18,272],[720,175,18,325]
    ], spikes:[[129,500,150,22],[225,500,182,22],[392,500,165,22],[542,500,178,22],[702,500,240,22]], clouds:[[130,100,.7],[450,75,1],[800,90,.8]]},
    {name:'05 — THE SUMMIT', sky:['#718eb0','#e8cda9'], goal:{x:862,y:125}, solids:[
      [0,500,128,40],[118,421,120,18],[286,348,116,18],[443,276,110,18],[594,207,110,18],[744,145,216,18],
      [0,0,18,540],[942,0,18,540],[252,370,18,130],[415,300,18,200],[565,230,18,270],[715,169,18,331]
    ], spikes:[[127,500,165,22],[235,500,180,22],[400,500,165,22],[552,500,170,22],[705,500,250,22]], clouds:[[120,105,.7],[455,90,1],[820,75,.8]]}
  ];
  const player = {x:55,y:462,w:20,h:30,vx:0,vy:0,face:1,onGround:false,wall:0,dash:1,dashTime:0,trail:[],blink:0};
  const particles = [];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const current=()=>rooms[Math.min(rooms.length-1,roomIndex)];
  let roomIndex=0;
  function beep(freq=500,dur=.07,type='sine',volume=.035){
    if(!soundOn)return;
    try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch(_){ }
  }
  function burst(x,y,color,n=12){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=1+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:.35+Math.random()*.4,size:2+Math.random()*3,color})}}
  function resetPlayer(){player.x=54;player.y=462;player.vx=player.vy=0;player.dash=1;player.dashTime=0;player.wall=0;player.onGround=false;player.trail=[];player.blink=.7}
  function showToast(text){toast.textContent=text;toast.classList.add('show');toastTimer=1.5}
  function begin(){started=true;startCard.classList.add('hidden');beep(540,.1);}
  function restart(){roomIndex=0;deaths=0;finished=false;started=true;finishCard.classList.add('hidden');startCard.classList.add('hidden');resetPlayer();updateHud();beep(480,.08)}
  function die(){if(player.blink>0)return;deaths++;deathLabel.textContent=deaths;burst(player.x+10,player.y+15,'#ff9e86',18);beep(150,.22,'sawtooth',.045);resetPlayer();showToast('THE MOUNTAIN WILL WAIT.');}
  function nextRoom(){if(roomIndex===rooms.length-1){finished=true;finishCard.classList.remove('hidden');document.getElementById('finish-copy').textContent=`Five screens. ${deaths} ${deaths===1?'fall':'falls'}. The whole world, holding its breath.`;beep(740,.18);setTimeout(()=>beep(990,.35),140);return}roomIndex++;transition=.8;resetPlayer();updateHud();burst(900,130,'#a9f4d0',24);beep(660,.17);showToast(['','A LITTLE HIGHER.','KEEP YOUR MOMENTUM.','THE AIR IS THINNER.','ALMOST THERE.'][roomIndex]);}
  function updateHud(){levelName.textContent=current().name;roomLabel.textContent=`0${roomIndex+1} / 05`;deathLabel.textContent=deaths;}
  function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function handleInput(dt){
    const left=keys.has('ArrowLeft')||keys.has('a')||touch.left,right=keys.has('ArrowRight')||keys.has('d')||touch.right;
    let move=(right?1:0)-(left?1:0);if(move)player.face=move;
    if(pressed.has('Space')||pressed.has('ArrowUp')||pressed.has('w')||pressed.has(' ')){
      if(player.onGround){player.vy=-10.4;player.onGround=false;burst(player.x+10,player.y+29,'#e9f4db',5);beep(450,.07)}
      else if(player.wall){player.vy=-10.5;player.vx=-player.wall*7.7;player.face=-player.wall;player.wall=0;player.dash=1;burst(player.x+(player.vx>0?0:20),player.y+15,'#a9f4d0',9);beep(590,.08)}
    }
    if(pressed.has('x')||pressed.has('Shift')||pressed.has('Control')){
      if(player.dash){let dx=(right?1:0)-(left?1:0),dy=(keys.has('ArrowUp')||keys.has('w')? -1:0)+(keys.has('ArrowDown')||keys.has('s')?1:0);if(!dx&&!dy)dx=player.face;if(dx&&dy){dx*=.707;dy*=.707}player.vx=dx*13.8;player.vy=dy*13.8;player.dash=0;player.dashTime=.15;burst(player.x+10,player.y+15,'#a9f4d0',8);beep(760,.1,'triangle');}
    }
    if(player.dashTime>0){player.dashTime-=dt;player.vx*=.985;player.vy*=.985}else{
      const target=move*3.5;player.vx+=(target-player.vx)*Math.min(1,dt*22);player.vy+=.48;player.vy=Math.min(player.vy,11);
    }
  }
  function physics(dt){
    const room=current();player.onGround=false;player.wall=0;
    player.x+=player.vx;
    for(const s of room.solids){const r={x:s[0],y:s[1],w:s[2],h:s[3]},p={x:player.x,y:player.y,w:player.w,h:player.h};if(rectsOverlap(p,r)){if(player.vx>0){player.x=r.x-player.w;player.wall=1}else if(player.vx<0){player.x=r.x+r.w;player.wall=-1}player.vx=0;if(player.dashTime>0){player.dashTime=0;player.dash=1;burst(player.x+(player.wall?0:10),player.y+15,'#d7f8e6',5)}}}
    player.y+=player.vy;
    for(const s of room.solids){const r={x:s[0],y:s[1],w:s[2],h:s[3]},p={x:player.x,y:player.y,w:player.w,h:player.h};if(rectsOverlap(p,r)){if(player.vy>0){player.y=r.y-player.h;player.onGround=true;if(player.dashTime>0)player.dashTime=0;player.dash=1}else if(player.vy<0){player.y=r.y+r.h;if(player.dashTime>0)player.dashTime=0}player.vy=0}}
    if(!player.onGround && player.vy>0){for(const s of room.solids){if(player.x+player.w>s[0]-3&&player.x<s[0]+s[2]+3&&player.y+player.h>s[1]&&player.y+player.h<s[1]+35){if(player.x+player.w<=s[0]+8)player.wall=1;else if(player.x>=s[0]+s[2]-8)player.wall=-1}}}
    if(player.wall&&player.vy>2.6){player.vy=2.6;player.dash=1}
    for(const h of room.spikes){const p={x:player.x+4,y:player.y+5,w:player.w-8,h:player.h-5};if(rectsOverlap(p,{x:h[0]+3,y:h[1]-14,w:h[2]-6,h:h[3]+14})){die();return}}
    if(player.y>H+30)die();
    if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:room.goal.x-15,y:room.goal.y-15,w:30,h:37})){nextRoom()}
    player.x=clamp(player.x,18,942-player.w);
    if(player.onGround){player.dash=1;}
    if(player.blink>0)player.blink-=dt;
    if(player.dashTime>0||Math.abs(player.vx)>6){player.trail.push({x:player.x,y:player.y,life:.22});if(player.trail.length>8)player.trail.shift()}
    player.trail.forEach(t=>t.life-=dt);player.trail=player.trail.filter(t=>t.life>0);
  }
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
  function drawBackground(room){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,room.sky[0]);g.addColorStop(1,room.sky[1]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // soft sun and high-altitude haze
    const sun=ctx.createRadialGradient(780,108,3,780,108,170);sun.addColorStop(0,'#fff6d78a');sun.addColorStop(1,'#fff6d700');ctx.fillStyle=sun;ctx.fillRect(580,0,380,300);
    ctx.globalAlpha=.16;ctx.fillStyle='#fff7e2';for(let i=0;i<5;i++){const x=((i*233-time*5)%1200+1200)%1200-120;const y=65+(i%3)*45;ctx.beginPath();ctx.ellipse(x,y,62,12,0,0,Math.PI*2);ctx.ellipse(x+27,y-5,36,13,0,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    // distant mountain silhouettes
    ctx.fillStyle='#577f8d55';ctx.beginPath();ctx.moveTo(0,330);for(let x=0;x<=W;x+=80){const y=250+Math.sin((x+roomIndex*127)*.013)*36+Math.sin(x*.027)*21;ctx.lineTo(x,y)}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
    ctx.fillStyle='#315b6d38';ctx.beginPath();ctx.moveTo(0,390);for(let x=0;x<=W;x+=60){const y=325+Math.sin((x+170)*.012)*31+Math.sin(x*.03)*12;ctx.lineTo(x,y)}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
    // fine drifting snow / pollen
    for(let i=0;i<28;i++){const x=(i*173+time*(8+i%4)* (i%2?1:-1)+1200)%960,y=(i*97+Math.sin(time+i)*13)%480;ctx.globalAlpha=.25+(i%3)*.1;ctx.fillStyle='#fff';ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;
  }
  function drawWorld(room){
    // glow behind exit
    const goal=room.goal;const pulse=.5+.5*Math.sin(time*3);let rg=ctx.createRadialGradient(goal.x,goal.y,3,goal.x,goal.y,65);rg.addColorStop(0,`rgba(169,244,208,${.35+pulse*.15})`);rg.addColorStop(1,'rgba(169,244,208,0)');ctx.fillStyle=rg;ctx.fillRect(goal.x-70,goal.y-70,140,140);
    ctx.save();ctx.translate(goal.x,goal.y);ctx.rotate(time*.45);ctx.strokeStyle='#e7ffe8';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,14+pulse*2,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#a9f4d0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle='#f8ffe5';ctx.beginPath();ctx.arc(goal.x,goal.y,3,0,Math.PI*2);ctx.fill();
    for(const s of room.solids){const [x,y,w,h]=s;const ground=y>=490;ctx.fillStyle=ground?'#253f4b':'#315867';ctx.fillRect(x,y,w,h);ctx.fillStyle=ground?'#64877e':'#87b79e';ctx.fillRect(x,y,w,4);ctx.fillStyle='#ffffff18';for(let xx=x+9;xx<x+w-4;xx+=24)ctx.fillRect(xx,y+9,9,2);ctx.fillStyle='#182f3a';ctx.fillRect(x,y+h-4,w,4);}
    for(const h of room.spikes){const [x,y,w,height]=h;const count=Math.ceil(w/18);for(let i=0;i<count;i++){const sx=x+i*w/count,sw=w/count;ctx.fillStyle='#b45859';ctx.beginPath();ctx.moveTo(sx,y+height);ctx.lineTo(sx+sw*.5,y+2);ctx.lineTo(sx+sw,y+height);ctx.closePath();ctx.fill();ctx.fillStyle='#f0a08d';ctx.beginPath();ctx.moveTo(sx+sw*.35,y+height*.7);ctx.lineTo(sx+sw*.5,y+2);ctx.lineTo(sx+sw*.61,y+height*.7);ctx.closePath();ctx.fill()}}
  }
  function drawPlayer(){
    for(const t of player.trail){ctx.globalAlpha=Math.max(0,t.life/.25)*.25;rounded(t.x,t.y,player.w,player.h,6,'#ddfff0');}ctx.globalAlpha=1;
    if(player.blink>0&&Math.floor(time*18)%2===0)return;
    const x=player.x,y=player.y;const run=Math.sin(time*18)*Math.min(2,Math.abs(player.vx)*.35);
    // scarf trailing in the wind
    ctx.fillStyle='#ef887c';ctx.beginPath();ctx.moveTo(x+10-player.face*4,y+9);ctx.quadraticCurveTo(x-player.face*12,y+6+run,x-player.face*20,y+13+run);ctx.lineTo(x-player.face*5,y+16);ctx.closePath();ctx.fill();
    rounded(x+2,y+5+run,16,22,5,'#ee735f');rounded(x+4,y+1+run,13,13,6,'#f3c3a0');
    ctx.fillStyle='#263a49';ctx.fillRect(x+(player.face>0?13:6),y+7+run,2,3);
    ctx.fillStyle='#fff1db';ctx.fillRect(x+4,y+20+run,5,8);ctx.fillRect(x+12,y+20+run,5,8);
    ctx.fillStyle='#e9eee1';ctx.fillRect(x+3,y+27+run,7,3);ctx.fillRect(x+11,y+27+run,7,3);
    ctx.fillStyle='#ffae8c';ctx.fillRect(x+3,y+14+run,15,3);
  }
  function frame(dt){time+=dt;ctx.clearRect(0,0,W,H);const room=current();drawBackground(room);drawWorld(room);
    if(started&&!finished){handleInput(dt);physics(dt)}
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)});ctx.globalAlpha=1;for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);
    drawPlayer();if(transition>0){transition=Math.max(0,transition-dt);ctx.fillStyle=`rgba(16,23,36,${transition*.35})`;ctx.fillRect(0,0,W,H)}
    if(player.dash){dashLabel.textContent='DASH READY';dashLabel.style.color='#a9f4d0'}else{dashLabel.textContent='DASH SPENT';dashLabel.style.color='#ffb29c'}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show')}
    pressed.clear();requestAnimationFrame((t)=>frame(Math.min(.033,(t-lastFrame)/1000)));lastFrame=performance.now();
  }
  let lastFrame=performance.now();
  window.addEventListener('keydown',e=>{const key=e.key===' '? 'Space':e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(key))e.preventDefault();if(!keys.has(key))pressed.add(key);keys.add(key);if(key==='Escape'||key==='r'){if(started)restart()}});
  window.addEventListener('keyup',e=>{const key=e.key===' '?'Space':e.key.length===1?e.key.toLowerCase():e.key;keys.delete(key)});
  window.addEventListener('blur',()=>keys.clear());
  document.getElementById('start-button').addEventListener('click',begin);
  document.getElementById('replay-button').addEventListener('click',restart);
  document.getElementById('sound-toggle').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.innerHTML=soundOn?'♫ <span>ON</span>':'♫ <span>OFF</span>';if(soundOn)beep(560,.08)});
  document.querySelectorAll('[data-control]').forEach(button=>{const name=button.dataset.control;const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);if(name==='left'||name==='right')touch[name]=true;else pressed.add(name==='jump'?'Space':'x')};const up=e=>{e.preventDefault();if(name==='left'||name==='right')touch[name]=false};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up)});
  updateHud();requestAnimationFrame(t=>{lastFrame=t;frame(0)});
})();
