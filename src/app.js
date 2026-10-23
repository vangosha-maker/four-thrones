(() => {
  'use strict';
  const E=FourThrones,$=id=>document.getElementById(id),STORE='four-thrones-v9';
  const names={K:'король',B:'слон',N:'конь',R:'ладья'},short={K:'Кр',B:'С',N:'К',R:'Л'},colors={w:'Белые',b:'Чёрные'},levels={easy:'Разминка',normal:'Соперник',hard:'Тактик'};
  const shapes={
    K:'<path d="M32 7v14m-6-8h12" fill="none" stroke-linecap="round"/><path d="M24 24c-9-7-15 2-9 11l8 8h18l8-8c6-9 0-18-9-11-2-9-14-9-16 0Z"/><path d="M23 42h18l3 10H20Z"/><path d="M19 52h26l3 5H16Z"/><path d="M24 32h16" fill="none"/>',
    R:'<path d="M15 10h8v8h6v-8h6v8h6v-8h8v15l-7 5 2 22H20l2-22-7-5Z"/><path d="M21 29h22M20 47h24" fill="none"/><path d="M18 52h28l3 5H15Z"/>',
    B:'<circle cx="32" cy="8" r="3"/><path d="M32 12c-7 6-14 13-12 20 1 5 6 8 12 8s11-3 12-8c2-7-5-14-12-20Z"/><path d="m32 18-5 10" fill="none" stroke-linecap="round"/><path d="M26 40h12l5 12H21Z"/><path d="M19 52h26l4 5H15Z"/>',
    N:'<path d="m25 14 2-8 7 6c14 2 18 13 17 27l-7 13H19l1-9 11-11-9 2-9-6 6-10Z"/><path d="m28 17 3 5-9 7M35 18c8 7 7 16 1 23" fill="none" stroke-linecap="round"/><circle cx="25" cy="22" r="1.6" fill="currentColor" stroke="none"/><path d="M18 52h28l3 5H15Z"/>'
  };
  function svg(p,cls='piece'){const white=p[0]==='w';return '<svg class="'+cls+'" viewBox="0 0 64 64" aria-hidden="true" fill="'+(white?'#fff8e5':'#253a33')+'" stroke="'+(white?'#596052':'#e0e3d0')+'" style="color:'+(white?'#596052':'#e0e3d0')+'" stroke-width="1.7" stroke-linejoin="round">'+shapes[p[1]]+'</svg>';}
  let state=E.initial(),history=[],records=[],config={mode:'bot',color:'w',level:'normal'},flipped=false,selected=null,thinking=false,worker=null,timer=null,job=0,toastTimer=null,storageWorks=true;
  function validState(s){return s&&Array.isArray(s.board)&&s.board.length===16&&s.board.every(p=>p===null||/^[wb][KBNR]$/.test(p))&&s.board.filter(p=>p==='wK').length===1&&s.board.filter(p=>p==='bK').length===1&&['w','b'].includes(s.turn)&&s.counts&&Number.isInteger(s.ply)&&Number.isInteger(s.quiet)&&s.quiet>=0;}
  try{const saved=JSON.parse(localStorage.getItem(STORE));if(saved&&saved.version===9&&validState(saved.state)&&Array.isArray(saved.history)&&saved.history.every(validState)&&Array.isArray(saved.records)&&['bot','local'].includes(saved.config.mode)&&['w','b'].includes(saved.config.color)&&levels[saved.config.level]){state=saved.state;history=saved.history;records=saved.records;config=saved.config;flipped=!!saved.flipped;}}catch(_){/* A blocked storage area or old save does not block play. */}
  function persist(){try{localStorage.setItem(STORE,JSON.stringify({version:9,state,history,records,config,flipped}));}catch(_){storageWorks=false;$('save-note').textContent='Партия хранится до закрытия страницы';}}
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
  const humanTurn=()=>config.mode==='local'||state.turn===config.color;
  function renderBoard(){
    const focused=document.activeElement?.dataset?.square,moves=selected===null?[]:E.legalMoves(state).filter(m=>m.from===selected),indices=Array.from({length:16},(_,i)=>flipped?15-i:i);
    $('board').innerHTML=indices.map(i=>{const p=state.board[i],legal=moves.find(m=>m.to===i),central=E.CENTER.includes(i);let cls='square'+(((i>>2)+i%4)%2?' dark':'')+(selected===i?' selected':'')+(central?' throne':'')+(state.pending?.square===i?' pending':'')+((state.lastMove?.from===i||state.lastMove?.to===i)?' last':'')+(p?.[1]==='K'&&E.inCheck(state.board,p[0])?' check':'');return '<button type="button" class="'+cls+'" data-square="'+i+'" aria-pressed="'+(selected===i)+'" aria-label="'+E.coord(i)+(p?', '+(p[0]==='w'?'белый ':'чёрный ')+names[p[1]]:', пусто')+(central?', трон':'')+(legal?', доступный ход':'')+'">'+(central?'<span class="throne-mark" aria-hidden="true">♔</span>':'')+(p?svg(p):'')+(legal?'<span class="move-dot'+(p?' capture':'')+'"></span>':'')+'</button>';}).join('');
    $('ranks').innerHTML=(flipped?['1','2','3','4']:['4','3','2','1']).map(x=>'<span>'+x+'</span>').join('');$('files').innerHTML=(flipped?['d','c','b','a']:['a','b','c','d']).map(x=>'<span>'+x+'</span>').join('');
    if(focused!==undefined)$('board').querySelector('[data-square="'+focused+'"]').focus({preventScroll:true});
  }
  function player(color){
    const bot=config.mode==='bot'&&color!==config.color,name=bot?'Компьютер':config.mode==='local'?colors[color]:'Ты',initial=E.initial().board.filter(p=>p&&p[0]===E.OTHER(color)),captured=initial.filter(p=>!state.board.includes(p));
    return '<span class="player-avatar '+(color==='b'?'black':'')+'" aria-hidden="true">♚</span><div><div class="player-name">'+name+'</div><div class="player-sub">'+colors[color]+(bot?' · '+levels[config.level]:'')+'</div></div>'+(captured.length?'<span class="captured" aria-label="Взятые фигуры: '+captured.map(p=>names[p[1]]).join(', ')+'">'+captured.map(p=>svg(p,'mini-piece')).join('')+'</span>':'')+(!state.result&&state.turn===color?'<span class="player-active">'+(thinking?'Думает':'Ходят')+'</span>':'');
  }
  function renderStatus(){
    let title,description,label=colors[state.turn].toUpperCase()+' ХОДЯТ';
    const check=E.inCheck(state.board,state.turn);
    if(state.result){const r=state.result;label='ПАРТИЯ ЗАВЕРШЕНА';title=r.winner?colors[r.winner]+' победили':'Ничья';description={throne:'Трон удержан: ответный ход прошёл, король остался в центре без шаха.',mate:'Мат. У короля нет законного способа уйти от шаха.',kings:'На доске остались только короли. По правилам это ничья.',stalemate:'Пат: шаха нет, но ни одного допустимого хода не осталось.',repetition:'Позиция повторилась три раза с тем же игроком на ходу.',inactivity:'Прошло 24 полухода без взятия и без нового занятия трона королём.'}[r.reason];}
    else if(state.pending){label='ТРОН ПОД КОНТРОЛЕМ';title='Один ход до победы';description=colors[state.pending.color]+' заняли '+E.coord(state.pending.square)+'. '+(thinking?'Компьютер ищет ответ.':(humanTurn()&&config.mode==='bot'?'Дай':'Нужно дать')+' шах, чтобы сорвать захват.')+(check?' Твой король под шахом.':'');}
    else if(check){title='Король под шахом';description='Защити короля: уйди, перекрой атаку или возьми атакующую фигуру.';}
    else{title=thinking?'Соперник думает…':config.mode==='local'?'Ход '+(state.turn==='w'?'белых':'чёрных'):'Твой ход';description=thinking?'Ищет путь к центру. И проверяет твои планы.':state.ply===0?'Выбери фигуру. Подготовь королю путь к одному из четырёх тронов.':'Открой путь к центру и поддержи короля остальными фигурами.';}
    $('status-label').textContent=label;$('status-title').textContent=title;$('status-description').textContent=description;$('move-number').textContent='Ход '+(Math.floor(state.ply/2)+1);$('status-dot').className='status-dot'+(thinking?' thinking':'');$('play-again').hidden=!state.result;$('throne-track').hidden=!!state.result;$('throne-track').classList.toggle('claimed',!!state.pending);
    $('undo').disabled=!history.length||(config.mode==='bot'&&!history.some(s=>s.turn===config.color));
    $('board-help').textContent=state.result?'Партия завершена. Сыграй ещё или верни ход.':thinking?'Компьютер выбирает ход…':selected!==null?names[state.board[selected][1]][0].toUpperCase()+names[state.board[selected][1]].slice(1)+': выбери отмеченную клетку.':'Выбери фигуру — точки покажут доступные ходы.';
  }
  function renderHistory(){
    $('session-meta').innerHTML='<span class="meta-pill">'+(config.mode==='local'?'Двое за одной доской':'Ты '+(config.color==='w'?'белыми':'чёрными'))+'</span><span class="meta-pill">'+(config.mode==='local'?'По очереди':levels[config.level])+'</span>';
    $('moves-count').textContent=records.length;
    let html='';for(let i=0;i<records.length;i+=2)html+='<div class="move-row"><span>'+(i/2+1)+'.</span><span class="'+(i===records.length-1?'latest':'')+'">'+records[i]+'</span><span class="'+(i+1===records.length-1?'latest':'')+'">'+(records[i+1]||'—')+'</span></div>';
    const list=$('move-list');list.innerHTML=html||'<p class="empty-history">Первый ход — начало истории.</p>';list.scrollTop=list.scrollHeight;
  }
  function render(){renderBoard();$('top-player').innerHTML=player(flipped?'w':'b');$('bottom-player').innerHTML=player(flipped?'b':'w');renderStatus();renderHistory();}
  function stopBot(){job++;clearTimeout(timer);if(worker){worker.terminate();worker=null;}thinking=false;}
  function play(move){
    const old=state;let next;try{next=E.advance(state,move);}catch(_){toast('Этот ход недоступен.');return;}
    history.push(old);const p=old.board[move.from];records.push(short[p[1]]+' '+E.coord(move.from)+(old.board[move.to]?'×':'–')+E.coord(move.to)+(next.result?.reason==='mate'?'#':E.inCheck(next.board,next.turn)?'+':''));
    state=next;selected=null;persist();render();scheduleBot();
  }
  function scheduleBot(){
    if(state.result||config.mode!=='bot'||humanTurn()){thinking=false;renderStatus();return;}
    thinking=true;render();const id=++job,opts={easy:{depth:2,ms:120},normal:{depth:5,ms:400},hard:{depth:7,ms:1000}}[config.level];
    timer=setTimeout(()=>{
      if(id!==job)return;
      const complete=m=>{if(id!==job)return;thinking=false;if(worker){worker.terminate();worker=null;}if(m)play(m);else render();};
      const fallback=()=>{if(id!==job)return;complete(E.chooseMove(state,{...opts,ms:Math.min(opts.ms,200)}));};
      try{const blob=new Blob([$('engine-code').textContent,'\nself.onmessage=function(e){self.postMessage(FourThrones.chooseMove(e.data.state,e.data.options));};'],{type:'text/javascript'}),url=URL.createObjectURL(blob);worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>complete(e.data);worker.onerror=()=>{if(worker){worker.terminate();worker=null;}fallback();};worker.postMessage({state,options:opts});}catch(_){fallback();}
    },350);
  }
  $('board').addEventListener('click',e=>{
    const button=e.target.closest('[data-square]');if(!button)return;const i=Number(button.dataset.square);
    if(state.result){toast('Партия закончена. Начни новую или верни ход.');return;}if(thinking||!humanTurn()){toast('Сейчас ход компьютера.');return;}
    const p=state.board[i];if(selected===i){selected=null;renderBoard();renderStatus();return;}
    if(selected!==null){const m=E.legalMoves(state).find(x=>x.from===selected&&x.to===i);if(m){play(m);return;}}
    if(p&&p[0]===state.turn){selected=i;renderBoard();renderStatus();if(!E.legalMoves(state).some(m=>m.from===i))toast('У этой фигуры сейчас нет допустимых ходов.');}
    else{if(selected!==null)toast('Сюда нельзя: выбери клетку с отметкой.');else toast('Выбери '+(state.turn==='w'?'белую':'чёрную')+' фигуру.');}
  });
  $('board').addEventListener('keydown',e=>{const i=Number(e.target.dataset.square);if(!Number.isInteger(i))return;let screen=flipped?15-i:i,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[e.key];if(delta!==undefined){e.preventDefault();const next=screen+delta;if(next>=0&&next<16&&(Math.abs(delta)===4||(next>>2)===(screen>>2)))$('board').querySelector('[data-square="'+(flipped?15-next:next)+'"]').focus();}if(e.key==='Escape'){selected=null;render();}});
  $('undo').onclick=()=>{if(!history.length)return;stopBot();state=history.pop();records.pop();if(config.mode==='bot'&&state.turn!==config.color&&history.length){state=history.pop();records.pop();}selected=null;persist();render();scheduleBot();};
  $('flip').onclick=()=>{flipped=!flipped;persist();render();};
  function setup(){ $('mode').value=config.mode;$('color').value=config.color;$('level').value=config.level;$('bot-settings').hidden=config.mode==='local';$('setup-note').textContent=state.ply&&!state.result?'Текущая партия будет заменена новой.':'Белые начинают. Ходы под шах запрещены.';$('setup-dialog').showModal();}
  $('new-game').onclick=setup;$('settings').onclick=setup;$('play-again').onclick=setup;
  $('mode').onchange=()=>{$('bot-settings').hidden=$('mode').value==='local';};
  $('setup-form').onsubmit=e=>{e.preventDefault();stopBot();config={mode:$('mode').value,color:$('color').value,level:$('level').value};state=E.initial();history=[];records=[];selected=null;flipped=config.mode==='bot'&&config.color==='b';$('setup-dialog').close();persist();render();scheduleBot();};
  $('rules-button').onclick=$('more-rules').onclick=()=>$('rules-dialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  render();scheduleBot();
})();
