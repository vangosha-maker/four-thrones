const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');

// Exact bounded AND/OR search, without heuristic evaluation or transposition
// merging: repetition history is preserved separately in every branch.
function canForceWin(state,remaining,target){
  if(state.result)return state.result.winner===target;
  if(remaining===0)return false;
  const moves=E.legalMoves(state);
  const continuation=move=>canForceWin(E.advance(state,move,false),remaining-1,target);
  return state.turn===target?moves.some(continuation):moves.every(continuation);
}
for(const side of ['w','b'])test(`${side} cannot force a win within the first ten plies`,()=>{
  assert.equal(canForceWin(E.initial(),10,side),false);
});
