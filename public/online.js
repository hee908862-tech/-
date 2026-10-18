'use strict';
// Online extension for original v9. The room owner's browser runs the authoritative game engine.
const Online={role:null,seat:null,code:null,ws:null,roster:[],max:4,started:false,seats:[],sending:false,queued:false,disconnected:false,observer:null,lastCue:'',lastPhase:'',lastActor:-1,guestAudioReady:false};
const onlineEl=id=>document.getElementById(id);
function onlineStatus(message){onlineEl('onlineStatus').textContent=message}
function onlineVisible(show){onlineEl('onlineSection').classList.toggle('hide',!show);onlineEl('setup').classList.toggle('hide',show)}
function onlineLobby(){
 const members=Online.roster.map(p=>`<div class="net-member"><span>🧑 ${S(p.name)}</span><span>${p.seat===0?'방장':`${p.seat+1}번`}</span></div>`).join('');
 onlineEl('onlineRoster').innerHTML=members;
 onlineEl('onlineCode').textContent=Online.code||'------';
 onlineEl('onlineCapacity').textContent=`${Online.roster.length}명 / ${Online.max}명 · 남는 자리 AI 충원`;
 onlineEl('onlineStart').classList.toggle('hide',Online.role!=='host'||Online.started);
 onlineEl('onlineStart').disabled=Online.roster.length<2;
 onlineEl('onlineInvite').textContent=location.origin+'/?room='+Online.code;
}
function openOnlinePanel(){onlineVisible(true);onlineEl('onlineJoinSection').classList.remove('hide');onlineEl('onlineWaiting').classList.add('hide');onlineStatus('방을 만들거나 참가할 수 있습니다.')}
function resetOnline(){if(Online.ws)Online.ws.close();Object.assign(Online,{role:null,seat:null,code:null,ws:null,roster:[],started:false,seats:[],disconnected:false});onlineVisible(false);onlineEl('onlineJoinSection').classList.remove('hide');onlineEl('onlineWaiting').classList.add('hide')}
function onlineSend(obj){if(Online.ws?.readyState===WebSocket.OPEN)Online.ws.send(JSON.stringify(obj))}
function onlineConnect(type){
 if(location.protocol==='file:'){alert('온라인 플레이는 서버 주소로 접속해야 합니다. README의 실행·배포 방법을 확인해 주세요.');return}
 const name=(onlineEl('onlineName').value||'플레이어').trim().slice(0,15);
 const code=onlineEl('onlineJoinCode').value.trim().toUpperCase();
 const max=+onlineEl('onlineCount').value;
 if(type==='join'&&code.length!==6){onlineStatus('6자리 방 코드를 입력해 주세요.');return}
 if(Online.ws&&Online.ws.readyState<2){Online.ws.close()}
 let protocol=location.protocol==='https:'?'wss:':'ws:';
 let sock=new WebSocket(`${protocol}//${location.host}/ws`);
 Online.ws=sock;Online.role=type==='create'?'host':'guest';Online.max=max;
 onlineStatus('서버에 연결 중입니다…');
 sock.onopen=()=>onlineSend({type,name,...(type==='create'?{max}:{code})});
 // Joining is a user gesture. Resume audio on this device; browsers may still require a second tap.
 try{ensureAudio(); Online.guestAudioReady=!!audioCtx&&audioCtx.state==='running'}catch(e){}
 sock.onmessage=evt=>{
  let d;try{d=JSON.parse(evt.data)}catch{return}
  if(d.type==='welcome'){
   Online.seat=d.seat;Online.code=d.code;Online.max=d.max;
   onlineEl('onlineJoinSection').classList.add('hide');onlineEl('onlineWaiting').classList.remove('hide');onlineLobby();
   onlineStatus(d.seat===0?'친구에게 초대 링크나 방 코드를 공유하세요.':'방장이 게임을 시작하기를 기다리고 있습니다.');
  }else if(d.type==='roster'){
   Online.roster=d.players;Online.max=d.max;Online.started=d.started;onlineLobby();
  }else if(d.type==='snapshot'&&Online.role==='guest')onlineRender(d);
  else if(d.type==='action'&&Online.role==='host')onlineHostAction(d);
  else if(d.type==='error')onlineStatus('⚠️ '+d.message);
  else if(d.type==='closed'||d.type==='disconnected'){
   Online.disconnected=true;
   onlineStatus('⚠️ '+d.message);
   alert(d.message+' 온라인 방을 다시 만드세요.');
  }
 };
 sock.onclose=()=>{if(!Online.disconnected&&Online.role)onlineStatus('서버 연결이 끊겼습니다. 새로고침 후 다시 접속해 주세요.')};
 sock.onerror=()=>onlineStatus('연결 실패. 온라인 서버가 실행 중인지 확인해 주세요.');
}
function onlineCopy(){const url=onlineEl('onlineInvite').textContent;navigator.clipboard?.writeText(url).then(()=>onlineStatus('초대 링크를 복사했습니다.')).catch(()=>window.prompt('링크를 복사하세요',url))||window.prompt('초대 링크',url)}
function onlineStart(){
 if(Online.role!=='host'||Online.roster.length<2)return;
 // 1. Host starts the identical original v9 game with room players as human seats.
 setGameMode('multi');onlineEl('count').value=String(Online.max);updateNames();
 onlineEl('humans').value=String(Online.roster.length);updateHumanNames();
 const names=[...onlineEl('names').querySelectorAll('input')];
 Online.roster.forEach((p,i)=>names[i].value=p.name);
 Online.seats=Online.roster.map(p=>p.seat);
 Online.started=true;
 onlineSend({type:'start'});
 onlineEl('onlineSection').classList.add('hide');
 onlineEl('onlineHeaderButton').classList.add('hide');
 startGame();
 onlineStatus('게임이 시작됐습니다.');
 onlineObserve();onlineSync();
}
function scrubInlineHandlers(root){for(const el of [root,...root.querySelectorAll('*')])for(const attr of [...el.attributes])if(/^on/i.test(attr.name))el.removeAttribute(attr.name)}
function onlinePrivateHtml(){
 let p=P[idx];if(!p||p.ai||Online.seats[idx]===undefined)return '';
 return [{kind:'y',obj:YUT[p.ySkill],used:p.yUsed,cls:''},{kind:'t',obj:TOKEN[p.tSkill],used:p.tUsed,cls:'orange'}].map(a=>`<button data-net-ability="${a.kind}" class="ability ${a.cls} ${a.used?'used':''}" ${a.used||phase!=='pre'||busy?'disabled':''}><strong>${a.kind==='y'?'🟣':'🟠'} ${S(a.obj.name)}</strong><span>${S(a.obj.desc)}${a.used?' · 사용 완료':''}</span></button>`).join('');
}
function onlineScrub(root){scrubInlineHandlers(root);return root.outerHTML}
function onlineSync(){
 if(Online.role!=='host'||!Online.started||!P.length)return;
 const gameClone=onlineEl('game').cloneNode(true),abilities=gameClone.querySelector('#abilities');
 if(abilities)abilities.innerHTML='<div class="concealed-skills"><div class="conceal-lock">🔒</div><strong>현재 플레이어의 능력은 비공개입니다</strong></div>';
 const voteClone=onlineEl('powerVote').cloneNode(true);
 // Settings, help and audio belong to EACH device, not the shared match.
 const publicData={game:onlineScrub(gameClone),vote:onlineScrub(voteClone)};
 const cue={phase,actor:idx,throwText:onlineEl('throwResult')?.textContent||'',sticks:onlineEl('sticks')?.innerHTML||'',message:onlineEl('message')?.textContent||''};
 const actor=Online.seats[idx]??-1;
 onlineSend({type:'snapshot',actor,private:onlinePrivateHtml(),public:publicData,cue});
}
function onlineScheduleSync(){if(Online.queued)return;Online.queued=true;setTimeout(()=>{Online.queued=false;onlineSync()},125)}
function onlineObserve(){
 if(Online.role!=='host')return;
 const o=new MutationObserver(onlineScheduleSync);
 for(const id of ['game','powerVote'])o.observe(onlineEl(id),{subtree:true,childList:true,characterData:true,attributes:true});
 Online.observer=o;
 // do not flood network with unused poll intervals
}
function onlineRender(d){
 Online.started=true;
 onlineEl('onlineHeaderButton').classList.add('hide');
 onlineEl('onlineSection').classList.add('hide');onlineEl('setup').classList.add('hide');
 let game=onlineEl('game'),vote=onlineEl('powerVote');
 const sanitize=html=>{const template=document.createElement('template');template.innerHTML=html;const root=template.content.firstElementChild;if(root){scrubInlineHandlers(root);root.querySelectorAll('script').forEach(el=>el.remove());}return root};
 let next=sanitize(d.public.game);
 if(!next)return;
 game.replaceWith(next);
 next=sanitize(d.public.vote);if(next)vote.replaceWith(next);
 // Never mirror the host's settings/help modal into another player's browser.
 const actor=d.actor===Online.seat;
 if(actor&&d.private){const ability=onlineEl('abilities');if(ability)ability.innerHTML=d.private}
 // Every person may vote only for their own seat, even if all votes are visible.
 const myIndex=Online.roster.findIndex(p=>p.seat===Online.seat);
 onlineEl('powerVote').querySelectorAll('button[data-voter]').forEach(btn=>{
   if(+btn.dataset.voter!==myIndex){btn.disabled=true;btn.title='다른 플레이어의 투표입니다.'}
 });
 document.body.classList.toggle('net-spectator',!actor);
 document.body.classList.add('net-guest');
 onlineGuestAudio(d);
 onlineMobileFit();
 onlineEl('exitBtn').classList.remove('hide');onlineEl('exitBtn').textContent='🚪 온라인 게임 나가기';
 onlineEl('exitBtn').onclick=()=>{if(confirm('방에서 나가시겠습니까?'))location.reload()};
}

// Audio is deliberately NOT streamed from the host: each connected browser synthesizes its own sound.
// The host sends public event cues only. The actual secret cards are never included.
function onlineGuestAudio(d){
 if(Online.role!=='guest'||!Online.started)return;
 const cue=d.cue||{};
 if(!Online.guestAudioReady){
  let chip=document.getElementById('netAudioUnlock');
  if(!chip){chip=document.createElement('button');chip.id='netAudioUnlock';chip.textContent='🔊 소리 켜기';chip.type='button';
   chip.style.cssText='position:fixed;z-index:31;right:10px;bottom:16px;background:#76593f;color:#fff;border:1px solid #d4ae7f;border-radius:40px;padding:11px 16px;box-shadow:0 4px 15px #0004;font-weight:bold';
   chip.onclick=()=>{ensureAudio();Online.guestAudioReady=!!audioCtx&&audioCtx.state==='running';if(Online.guestAudioReady)chip.remove()};document.body.appendChild(chip)}
 } else document.getElementById('netAudioUnlock')?.remove();
 const phaseNow=cue.phase||'';
 const result=cue.throwText||'';
 const cueKey=JSON.stringify([cue.actor,phaseNow,result,cue.sticks]);
 if(Online.lastCue&&cueKey!==Online.lastCue){
   if(phaseNow==='rolling')soundFx('throw');
   if(result&&result!=='윷을 던져 주세요'&&result!==Online.lastThrow){
    const name=result.split(/[ (]/)[0];if(['도','개','걸','윷','모','빽도','낙'].includes(name)){soundFx('step');announceRoll(name)}
   }
   if(phaseNow==='end'&&Online.lastPhase!=='end')soundFx('turn');
   if(cue.message&&/잡았|잡기 성공|상대 말을 잡/.test(cue.message)&&cue.message!==Online.lastMessage)soundFx('clap');
   if(cue.message&&/골인/.test(cue.message)&&cue.message!==Online.lastMessage)soundFx('finish');
 }
 Online.lastCue=cueKey;Online.lastThrow=result;Online.lastPhase=phaseNow;Online.lastMessage=cue.message||'';
}
// The game occupies the available mobile visual viewport; viewport chrome can change on scroll.
function onlineMobileFit(){
 if(!window.matchMedia('(max-width:780px)').matches)return;
 const h=window.visualViewport?.height||window.innerHeight;
 document.documentElement.style.setProperty('--net-visible-height',Math.round(h)+'px');
}
window.visualViewport?.addEventListener('resize',onlineMobileFit);
window.addEventListener('orientationchange',onlineMobileFit);

function onlineGetAction(target){
 const vote=target.closest('#powerVote [data-voter]');if(vote)return{kind:'vote',index:+vote.dataset.voter};
 const ability=target.closest('#abilities [data-net-ability]');if(ability)return{kind:'ability',power:ability.dataset.netAbility};
 const bt=target.closest('#buttons button[id^="action"]');if(bt)return{kind:'action',index:+bt.id.slice(6)};
 const pick=target.closest('#pieceList button[id^="pick"]');if(pick)return{kind:'pick',index:+pick.id.slice(4)};
 const piece=target.closest('#pieceList button[id^="piece"]');if(piece)return{kind:'piece',index:+piece.id.slice(5)};
 const pb=target.closest('#board .piece-group');if(pb)return{kind:'boardPiece',owner:+pb.dataset.owner,piece:+pb.dataset.piece};
 // A destination has three valid tap surfaces: glowing ring, label, and nearby board area.
 // On mobile the SVG label was previously pointer-events:none, so tapping text
 // never produced a remote action. Resolve taps by the *visible target position*.
 const board=target.closest('#board');
 if(board){
  const targetEl=board.querySelector('.destination-hit[data-dest]');
  if(targetEl){
   const explicit=target.closest('.destination-hit,.destination-label');
   if(explicit)return{kind:'destination',pos:String(targetEl.dataset.dest)};
   // Convert browser touch/click coordinates to SVG coordinate space; works
   // with responsive viewBox scaling, both portrait and landscape screens.
   const svgPoint=board.createSVGPoint();
   svgPoint.x=window.__yutLastClickX??0;svgPoint.y=window.__yutLastClickY??0;
   const ctm=board.getScreenCTM();
   if(ctm){
    const tap=svgPoint.matrixTransform(ctm.inverse());
    const cx=Number(targetEl.getAttribute('cx')),cy=Number(targetEl.getAttribute('cy'));
    const label=board.querySelector('.destination-label');
    const nearCircle=Math.hypot(tap.x-cx,tap.y-cy)<=44;
    const nearLabel=label&&Math.abs(tap.x-cx)<=78&&tap.y>=cy-65&&tap.y<=cy-20;
    if(nearCircle||nearLabel)return{kind:'destination',pos:String(targetEl.dataset.dest)};
   }
  }
 }

 const node=target.closest('#board .node');if(node)return{kind:'node',index:[...onlineEl('board').querySelectorAll('.node')].indexOf(node)};
 return null;
}
// Guest does not execute game logic; every input is forwarded to the host.
document.addEventListener('click',e=>{
 if(Online.role!=='guest'||!Online.started)return;
 // Save coordinates before resolving a touch target in the SVG viewBox.
 window.__yutLastClickX=e.clientX;window.__yutLastClickY=e.clientY;
 const a=onlineGetAction(e.target);if(!a)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(a.kind!=='vote'&&onlineEl('game').classList.contains('hide'))return;
 onlineSend({type:'action',action:a});
},true);
// Prevent room owner from clicking controls belonging to remote human seats.
document.addEventListener('click',e=>{
 if(Online.role!=='host'||!Online.started||!P.length||!e.isTrusted)return;
 if(e.target.closest('#powerVote [data-voter]')){
  const k=+e.target.closest('[data-voter]').dataset.voter;
  if(Online.seats[k]!==0){e.preventDefault();e.stopImmediatePropagation();}return;
 }
 if(!e.target.closest('#game'))return;
 if(!P[idx].ai&&Online.seats[idx]!==0){e.preventDefault();e.stopImmediatePropagation()}
},true);
function onlineHostAction({seat,action:a}){
 if(Online.role!=='host'||!Online.started||!a||!P.length)return;
 if(a.kind==='vote'){
  if(!powerVoteState||Online.seats[a.index]!==seat)return;
  const b=onlineEl('powerVote').querySelector(`button[data-voter="${a.index}"]`);
  if(b&&!b.disabled)b.click();onlineScheduleSync();return;
 }
 if(Online.seats[idx]!==seat||P[idx].ai||gameOver)return;
 // Semantic commands drive the actual engine, not a possibly hidden/disabled mirrored UI element.
 try{
  if(a.kind==='ability'){
   if(['y','t'].includes(a.power)&&phase==='pre')power(a.power);
  }else if(a.kind==='piece'){
   if(Number.isInteger(a.index)&&a.index>=0&&a.index<4&&['move','destination'].includes(phase))selectPiece(a.index);
  }else if(a.kind==='boardPiece'){
   if(Number.isInteger(a.owner)&&Number.isInteger(a.piece)&&a.owner>=0&&a.owner<P.length&&a.piece>=0&&a.piece<4)onBoardClick(a.owner,a.piece);
  }else if(a.kind==='destination'){
   // The host validates the intended destination against the current move.
   // This prevents stale guest taps from moving a different piece/turn.
   if(phase==='destination'&&selectedPiece!==null&&currentRoll){
    const expected=moveCalc(P[idx].pieces[selectedPiece],currentRoll.step);
    if(expected&&String(expected.pos)===String(a.pos))confirmDestination();
   }
  }else if(a.kind==='pick'){
   if(phase==='choose'&&Number.isInteger(a.index)&&a.index>=0&&a.index<selectionOptions.length)completeSelection(selectionOptions[a.index]);
  }else if(a.kind==='node'){
   if(phase==='choose'&&Number.isInteger(a.index)){
    const nodes=[...onlineEl('board').querySelectorAll('.node')];
    const node=nodes[a.index];if(node)node.click();
   }
  }else if(a.kind==='action'){
   if(Number.isInteger(a.index)&&a.index>=0&&a.index<20){
    const b=onlineEl('buttons').querySelector(`#action${a.index}`);
    if(b&&!b.disabled)b.click();
   }
  }
 }catch(err){console.error('Remote command failed',a,err)}
 onlineScheduleSync();
}
// Original engine remains unchanged. Conceal remote person's cards on the hosting PC.
const onlineOriginalAbilities=renderAbilities;
renderAbilities=function(){
 onlineOriginalAbilities();
 if(Online.role==='host'&&Online.started&&P[idx]&&!P[idx].ai&&Online.seats[idx]!==0){
  onlineEl('abilities').innerHTML=`<div class="concealed-skills"><div class="conceal-lock">🔒</div><strong>${S(P[idx].name)} 님의 비공개 초능력</strong><span>해당 플레이어가 자신의 기기에서 조작하고 있습니다.</span></div>`;
 }
};
// Exiting an online game closes the room rather than leaving disconnected guests in a dead turn.
const originalOnlineExit=exitGame;
exitGame=function(){
 if(Online.role&&Online.started){
  if(confirm('온라인 게임방을 종료하고 나가시겠습니까?'))location.reload();
  return;
 }
 return originalOnlineExit();
};
(function initOnline(){
 const room=new URLSearchParams(location.search).get('room');if(room){openOnlinePanel();onlineEl('onlineJoinCode').value=room.toUpperCase();onlineStatus('초대 코드가 입력됐습니다. 이름을 입력하고 참가하세요.')}
})();
