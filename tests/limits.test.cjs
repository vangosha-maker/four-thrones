const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
function position(pieces,quiet=0,turn='w',pending=null){
 const s={board:Array(16).fill(null),turn,pending,result:null,ply:quiet,quiet,counts:{}};
 for(const [sq,p]of Object.entries(pieces))s.board[E.at(sq)]=p;
 s.counts[E.key(s)]=1;return s;
}
const m=(from,to)=>({from:E.at(from),to:E.at(to)});
const has=(s,from,to)=>E.legalMoves(s).some(x=>x.from===E.at(from)&&x.to===E.at(to));

for(const [piece,near,far,target,king,opponent]of [
 ['R','a2','a3','a4','d1','d4'],['B','b2','c3','d4','d1','a4']
])test(`${piece} moves, captures, and attacks at most two squares`,()=>{
 const s=position({a1:'w'+piece,[target]:'bN',[king]:'wK',[opponent]:'bK'});
 assert.equal(has(s,'a1',near),true);assert.equal(has(s,'a1',far),true);
 assert.equal(E.attacked(s.board,E.at(far),'w'),true);
 assert.equal(has(s,'a1',target),false);assert.equal(E.attacked(s.board,E.at(target),'w'),false);
 assert.throws(()=>E.advance(s,m('a1',target)),/Недопустимый/);
 const capture=position({a1:'w'+piece,[far]:'bN',[king]:'wK',[opponent]:'bK'});
 assert.equal(E.advance(capture,m('a1',far)).lastMove.captured,'bN');
});

test('Short-range sliding pieces still stop at the first blocker',()=>{
 for(const [piece,block,beyond]of [['R','a2','a3'],['B','b2','c3']]){
  for(const color of ['w','b']){
   const s=position({a1:'w'+piece,[block]:color+'N',d1:'wK',d4:'bK'});
   assert.equal(has(s,'a1',block),color==='b');assert.equal(has(s,'a1',beyond),false);
   assert.equal(E.attacked(s.board,E.at(beyond),'w'),false);
  }
 }
});

test('Distant rooks and bishops no longer give three-square checks',()=>{
 for(const [piece,king]of [['R','a1'],['B','d1']]){
  const s=position({a4:'b'+piece,[king]:'wK',d4:'bK'});
  assert.equal(E.inCheck(s.board,'w'),false);
 }
 const r=position({a4:'bR',a2:'wK',d4:'bK'});
 const b=position({a4:'bB',c2:'wK',d4:'bK'});
 assert.equal(E.inCheck(r.board,'w'),true);assert.equal(E.inCheck(b.board,'w'),true);
});

test('The former first-move mate is illegal under the clarified rules',()=>{
 const s=position({a4:'bR',b4:'bN',c4:'bK',d4:'bB',a1:'wB',b1:'wK',c1:'wN',d1:'wR'});
 assert.equal(has(s,'d1','d4'),false);assert.equal(E.attacked(s.board,E.at('d4'),'w'),false);
 assert.throws(()=>E.advance(s,m('d1','d4')),/Недопустимый/);
});

test('The inactivity draw occurs on the 24th quiet ply, not the 23rd',()=>{
 const s=position({a1:'wK',d4:'bK',a2:'wR',d3:'bR'},22);
 const n=E.advance(s,m('a2','b2'));
 assert.equal(n.quiet,23);assert.equal(n.result,null);assert.equal(s.quiet,22);
 const end=E.advance(n,m('d3','c3'));
 assert.equal(end.quiet,24);assert.deepEqual(end.result,{winner:null,reason:'inactivity'});
 assert.throws(()=>E.advance(end,m('b2','a2')),/завершена/);
});

test('A capture resets the quiet clock even on its last permitted ply',()=>{
 const s=position({a1:'wK',d4:'bK',a2:'wR',d3:'bR',b2:'bN'},23);
 const n=E.advance(s,m('a2','b2'));
 assert.equal(n.quiet,0);assert.equal(n.result,null);
});

test('Entering a throne or moving to another throne resets the clock',()=>{
 for(const from of ['a1','b2']){
  const to=from==='a1'?'b2':'c2';
  const s=position({[from]:'wK',d4:'bK',d1:'wR'},23);
  const n=E.advance(s,m(from,to));
  assert.equal(n.quiet,0);assert.equal(n.result,null);
  assert.deepEqual(n.pending,{color:'w',square:E.at(to)});
 }
});

test('Moving another piece while the king stays on a throne does not reset the clock',()=>{
 const s=position({b2:'wK',a3:'wR',d4:'bK',b4:'bR'},10);
 const n=E.advance(s,m('a3','b3'));
 assert.equal(n.quiet,11);assert.equal(n.result,null);
 assert.deepEqual(n.pending,{color:'w',square:E.at('b2')});
});

test('A completed throne claim or mate takes priority over the quiet-clock draw',()=>{
 const s=position({b2:'wK',a1:'wR',d4:'bK',a3:'bN'},23,'b',{color:'w',square:E.at('b2')});
 const throne=E.advance(s,m('d4','d3'));
 assert.equal(throne.quiet,24);assert.deepEqual(throne.result,{winner:'w',reason:'throne'});
 const t=position({a4:'bR',b4:'bN',c4:'bK',a2:'bB',b2:'wB',a1:'wK',c1:'wN',d3:'wR'},23);
 const mate=E.advance(t,m('d3','d4'));
 assert.equal(mate.quiet,24);assert.deepEqual(mate.result,{winner:'w',reason:'mate'});
});
