(function(root){
  'use strict';
  const SIZE=4, CENTER=[5,6,9,10], OTHER=c=>c==='w'?'b':'w', RANGE={B:2,R:2,K:1,N:1};
  const DIRS={B:[[-1,-1],[-1,1],[1,-1],[1,1]],R:[[-1,0],[1,0],[0,-1],[0,1]],K:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],N:[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]};
  const inside=(r,c)=>r>=0&&r<4&&c>=0&&c<4;
  const coord=i=>'abcd'[i%4]+(4-Math.floor(i/4));
  const at=s=>(4-Number(s[1]))*4+'abcd'.indexOf(s[0]);
  const key=s=>s.board.map(x=>x||'..').join('')+s.turn+(s.pending?s.pending.color+s.pending.square:'-');
  function initial(){const s={board:['bB','bN','bK','bR',null,null,null,null,null,null,null,null,'wR','wK','wN','wB'],turn:'w',pending:null,result:null,ply:0,quiet:0,counts:{}};s.counts[key(s)]=1;return s;}
  function attacked(board,sq,by){
    if(sq<0)return true;
    for(let i=0;i<16;i++){
      const p=board[i];if(!p||p[0]!==by)continue;
      const r=i>>2,c=i%4,t=p[1];
      for(const [dr,dc]of DIRS[t]){
        for(let step=1,nr=r+dr,nc=c+dc;step<=RANGE[t]&&inside(nr,nc);step++,nr+=dr,nc+=dc){
          const j=nr*4+nc;if(j===sq)return true;
          if(board[j])break;
        }
      }
    }
    return false;
  }
  const inCheck=(board,color)=>attacked(board,board.indexOf(color+'K'),OTHER(color));
  function legalMoves(s,color=s.turn){
    const moves=[];
    for(let i=0;i<16;i++){
      const p=s.board[i];if(!p||p[0]!==color)continue;
      for(const [dr,dc]of DIRS[p[1]]){
        for(let step=1,r=(i>>2)+dr,c=i%4+dc;step<=RANGE[p[1]]&&inside(r,c);step++,r+=dr,c+=dc){
          const j=r*4+c,target=s.board[j];
          if(target&&(target[0]===color||target[1]==='K'))break;
          const b=s.board.slice();b[j]=p;b[i]=null;
          if(!inCheck(b,color))moves.push({from:i,to:j});
          if(target)break;
        }
      }
    }
    return moves;
  }
  function advance(s,m,validate=true){
    if(s.result)throw new Error('Партия завершена');
    if(validate&&!legalMoves(s).some(x=>x.from===m.from&&x.to===m.to))throw new Error('Недопустимый ход');
    const board=s.board.slice(),color=s.turn,piece=board[m.from],captured=board[m.to];
    board[m.to]=piece;board[m.from]=null;
    // A fresh occupation means the king moves onto a throne, including a
    // different throne. Staying in place while another piece moves is not new.
    const occupiedThrone=piece[1]==='K'&&CENTER.includes(m.to);
    const quiet=captured||occupiedThrone?0:(s.quiet||0)+1;
    const n={board,turn:OTHER(color),pending:null,result:null,ply:s.ply+1,quiet,counts:{...s.counts},lastMove:{...m,piece,captured}};
    // Bare kings take priority, including a capture on the response to a throne claim.
    if(board.filter(Boolean).every(p=>p[1]==='K'))n.result={winner:null,reason:'kings'};
    else if(s.pending&&s.pending.color===n.turn&&board[s.pending.square]===n.turn+'K'&&CENTER.includes(s.pending.square)&&!inCheck(board,n.turn))n.result={winner:n.turn,reason:'throne'};
    if(!n.result){
      const king=board.indexOf(color+'K');
      if(CENTER.includes(king)&&!inCheck(board,color))n.pending={color,square:king};
      if(!legalMoves(n).length)n.result=inCheck(board,n.turn)?{winner:color,reason:'mate'}:{winner:null,reason:'stalemate'};
    }
    const k=key(n);n.counts[k]=(n.counts[k]||0)+1;
    if(!n.result&&n.counts[k]>=3)n.result={winner:null,reason:'repetition'};
    if(!n.result&&n.quiet>=24)n.result={winner:null,reason:'inactivity'};
    return n;
  }
  function evaluate(s){
    if(s.result)return s.result.winner?(s.result.winner===s.turn?100000:-100000):0;
    let score=0;
    const val={B:315,N:305,R:480,K:0};
    for(let i=0;i<16;i++){
      const p=s.board[i];if(!p)continue;
      let v=val[p[1]];
      if(CENTER.includes(i))v+=p[1]==='K'?130:20;
      if(p[1]==='K'&&inCheck(s.board,p[0]))v-=40;
      score+=p[0]==='w'?v:-v;
    }
    if(s.pending)score+=s.pending.color==='w'?580:-580;
    return s.turn==='w'?score:-score;
  }
  function chooseMove(s,options={}){
    const all=legalMoves(s);if(s.result||!all.length)return null;
    const deadline=Date.now()+(options.ms||350),maxDepth=options.depth||5;
    let nodes=0,best=all[0],completedDepth=0;
    const order=(moves,state)=>moves.sort((a,b)=>priority(b,state)-priority(a,state));
    const priority=(m,state)=>(state.board[m.to]?({R:500,B:320,N:300,K:0}[state.board[m.to][1]]):0)+(state.board[m.from][1]==='K'&&CENTER.includes(m.to)?600:0);
    function search(state,depth,alpha,beta){
      if((++nodes&127)===0&&Date.now()>deadline)throw new Error('timeout');
      if(state.result)return evaluate(state)+(state.result.winner?(state.result.winner===state.turn?depth:-depth):0);
      if(depth<=0)return evaluate(state);
      const moves=order(legalMoves(state),state);let value=-Infinity;
      if(!moves.length)return inCheck(state.board,state.turn)?-100000:0;
      for(const m of moves){const v=-search(advance(state,m,false),depth-1,-beta,-alpha);value=Math.max(value,v);alpha=Math.max(alpha,v);if(alpha>=beta)break;}
      return value;
    }
    for(let depth=1;depth<=maxDepth;depth++){
      let iterationBest=best,bestScore=-Infinity;
      try{
        const moves=order(all.slice(),s);moves.sort((a,b)=>(b.from===best.from&&b.to===best.to?1:0)-(a.from===best.from&&a.to===best.to?1:0));
        for(const m of moves){const v=-search(advance(s,m,false),depth-1,-Infinity,-bestScore);if(v>bestScore){bestScore=v;iterationBest=m;}}
        best=iterationBest;completedDepth=depth;
        if(Math.abs(bestScore)>90000||Date.now()>deadline)break;
      }catch(e){if(e.message!=='timeout')throw e;break;}
    }
    return {...best,depth:completedDepth,nodes};
  }
  const api={initial,attacked,inCheck,legalMoves,advance,chooseMove,coord,at,key,CENTER,OTHER};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FourThrones=api;
})(typeof self!=='undefined'?self:this);
