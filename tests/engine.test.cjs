const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
function position(pieces,turn='w',pending=null){const board=Array(16).fill(null);for(const [sq,p]of Object.entries(pieces))board[E.at(sq)]=p;const s={board,turn,pending,result:null,ply:0,quiet:0,counts:{}};s.counts[E.key(s)]=1;return s;}
const m=(from,to)=>({from:E.at(from),to:E.at(to)});
const has=(s,from,to)=>E.legalMoves(s).some(x=>x.from===E.at(from)&&x.to===E.at(to));
test('Symmetric setup, eight pieces, safe kings; original position stays immutable',()=>{const s=E.initial(),snapshot=JSON.stringify(s);assert.equal(s.board.filter(Boolean).length,8);assert.equal(E.inCheck(s.board,'w'),false);assert.equal(E.inCheck(s.board,'b'),false);const n=E.advance(s,E.legalMoves(s)[0]);assert.equal(n.turn,'b');assert.equal(n.ply,1);assert.equal(JSON.stringify(s),snapshot);assert.equal(s.board[E.at('b1')],'wK');assert.equal(s.board[E.at('c4')],'bK');});
test('Entering a throne begins a claim, not an immediate win',()=>{const s=position({a1:'wK',c1:'wR',d4:'bK',a3:'bN'});const n=E.advance(s,m('a1','b2'));assert.equal(n.result,null);assert.deepEqual(n.pending,{color:'w',square:E.at('b2')});});
test('A safe opposing reply completes the throne claim',()=>{const s=position({b2:'wK',a1:'wR',d4:'bK',a3:'bN'},'b',{color:'w',square:E.at('b2')});assert.deepEqual(E.advance(s,m('d4','d3')).result,{winner:'w',reason:'throne'});});
test('Check interrupts a claim; a safe king move starts a fresh claim',()=>{const s=position({b2:'wK',a1:'wR',d4:'bK',a4:'bR'},'b',{color:'w',square:E.at('b2')});const checked=E.advance(s,m('a4','b4'));assert.equal(checked.result,null);assert.equal(checked.pending,null);assert.equal(E.inCheck(checked.board,'w'),true);const n=E.advance(checked,m('b2','c2'));assert.equal(n.result,null);assert.deepEqual(n.pending,{color:'w',square:E.at('c2')});});
test('Blocking a check while staying on a throne restarts the waiting period',()=>{const s=position({b2:'wK',a3:'wR',d4:'bK',b4:'bR'},'w');assert.equal(E.inCheck(s.board,'w'),true);const n=E.advance(s,m('a3','b3'));assert.equal(n.result,null);assert.deepEqual(n.pending,{color:'w',square:E.at('b2')});});
test('Bare kings draw overrides a surviving throne claim',()=>{const s=position({b2:'wK',d3:'wR',d4:'bK'},'b',{color:'w',square:E.at('b2')});assert.deepEqual(E.advance(s,m('d4','d3')).result,{winner:null,reason:'kings'});});
test('Capturing the last non-king piece immediately draws',()=>{const s=position({b2:'wK',c2:'bB',d4:'bK'});assert.deepEqual(E.advance(s,m('b2','c2')).result,{winner:null,reason:'kings'});});
test('King cannot enter attack, stand next to a king, or capture a king',()=>{const s=position({a1:'wK',c3:'bK',d1:'wR',a3:'bR'});assert.equal(has(s,'a1','a2'),false);assert.equal(has(s,'a1','b2'),false);const t=position({a1:'wK',d4:'bK',d1:'wR'});assert.equal(has(t,'d1','d4'),false);assert.throws(()=>E.advance(s,m('a1','b2')),/Недопустимый/);});
test('Pinned piece cannot expose its own king',()=>{const s=position({a1:'wK',a2:'wR',a3:'bR',d4:'bK'});assert.equal(has(s,'a2','b2'),false);assert.equal(has(s,'a2','a3'),true);});
test('Knight jumps; sliding pieces stop at blockers',()=>{const s=position({a1:'wB',b1:'wK',c1:'wN',d1:'wR',a4:'bR',b4:'bN',c4:'bK',d4:'bB'});assert.equal(has(s,'c1','b3'),true);assert.equal(has(s,'d1','a1'),false);assert.equal(has(s,'a1','d4'),false);assert.equal(has(s,'a1','c3'),true);});
test('Early throne entry is legal and a checking reply interrupts the claim',()=>{
 const s=E.initial();assert.equal(has(s,'b1','b2'),true);
 assert.ok(E.legalMoves(s,'b').some(x=>x.from===E.at('c4')&&x.to===E.at('c3')));
 const claim=E.advance(s,m('b1','b2'));assert.equal(claim.result,null);assert.deepEqual(claim.pending,{color:'w',square:E.at('b2')});
 const reply=E.advance(claim,m('b4','d3'));assert.equal(reply.result,null);assert.equal(reply.pending,null);assert.equal(E.inCheck(reply.board,'w'),true);
});
test('Requested opening has outer-rank armies, middle-file kings, adjacent rooks, and no instant win',()=>{
 const s=E.initial();assert.deepEqual(s.board.slice(0,4),['bB','bN','bK','bR']);assert.deepEqual(s.board.slice(12),['wR','wK','wN','wB']);
 assert.ok(s.board.slice(4,12).every(p=>p===null));
 for(let i=0;i<4;i++)assert.equal(s.board[i][1],s.board[15-i][1]);
 for(const color of ['w','b'])assert.equal(Math.abs(s.board.indexOf(color+'K')-s.board.indexOf(color+'R')),1);
 for(const move of E.legalMoves(s))assert.equal(E.advance(s,move).result,null);
});
test('Mate ends play and rejects further moves',()=>{const s=position({a4:'bR',b4:'bN',c4:'bK',d4:'bB',b2:'wB',a1:'wK',c1:'wN',d2:'wR'});const n=E.advance(s,m('d2','d4'));assert.equal(E.inCheck(n.board,'b'),true);assert.equal(E.legalMoves(n).length,0);assert.deepEqual(n.result,{winner:'w',reason:'mate'});assert.throws(()=>E.advance(n,m('c4','c3')),/завершена/);});
test('No legal moves without check is stalemate',()=>{const s=position({b4:'bN',d4:'bB',a3:'bR',d3:'bK',d1:'wK'},'b');const n=E.advance(s,m('b4','a2'));assert.equal(E.inCheck(n.board,'w'),false);assert.equal(E.legalMoves(n).length,0);assert.deepEqual(n.result,{winner:null,reason:'stalemate'});});
test('Third occurrence produces repetition draw',()=>{const s=E.initial(),move=E.legalMoves(s)[0],future=E.advance(s,move);s.counts[E.key(future)]=2;assert.deepEqual(E.advance(s,move).result,{winner:null,reason:'repetition'});});
test('Bot finds a checking defense instead of conceding the throne',()=>{const s=position({b2:'wK',a1:'wR',d4:'bK',a4:'bR'},'b',{color:'w',square:E.at('b2')});const move=E.chooseMove(s,{depth:3,ms:1000});const n=E.advance(s,move);assert.notEqual(n.result?.reason,'throne');assert.equal(E.inCheck(n.board,'w'),true);});
test('Legal playouts preserve kings and own-king safety',()=>{let seed=8271,total=0,ended=0;for(let g=0;g<35;g++){let s=E.initial();for(let ply=0;ply<110&&!s.result;ply++){const moves=E.legalMoves(s);assert.ok(moves.length);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const side=s.turn;s=E.advance(s,moves[seed%moves.length]);assert.equal(s.board.filter(p=>p==='wK').length,1);assert.equal(s.board.filter(p=>p==='bK').length,1);assert.equal(E.inCheck(s.board,side),false);total++;}if(s.result)ended++;}assert.ok(total>150);assert.ok(ended>0);});
