import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBoard, makeQuestions, checkAnswer} from '../game.js';
test('every grid has stable unique letters, bounded numbers and solvable questions', () => {
  for (const size of [3,4,5]) for (let run=0; run<80; run++) {
    const board = makeBoard(size);
    assert.equal(board.length,size*size);
    assert.equal(new Set(board.map(c=>c.letter)).size,size*size);
    assert.ok(board.every((c,i)=>c.value>=1&&c.value<=9&&c.letter===String.fromCharCode(65+i)));
    for(const op of ['add','subtract','multiply','divide']) {
      const questions=makeQuestions(board,op);
      assert.equal(questions.length,5);
      assert.equal(new Set(questions.map(q=>q.target)).size,5);
      for(const q of questions) {
        assert.ok(Number.isInteger(q.target)&&q.target>0);
        assert.ok(board.some((_,a)=>board.some((_,b)=>checkAnswer(board,[a,b],q))));
      }
    }
  }
});
test('alternative pairs and reversed commutative answers are accepted',()=>{
  const board=[8,4,7,5].map(value=>({value}));
  for(const pair of [[0,1],[1,0],[2,3],[3,2]]) assert.ok(checkAnswer(board,pair,{operation:'add',target:12}));
  assert.ok(checkAnswer(board,[1,0],{operation:'multiply',target:32}));
});
test('subtraction and division respect order; repeated cards are rejected',()=>{
  const board=[8,2,4].map(value=>({value}));
  for(const [operation,target] of [['subtract',6],['divide',4]]) {
    assert.ok(checkAnswer(board,[0,1],{operation,target}));
    assert.equal(checkAnswer(board,[1,0],{operation,target}),false);
  }
  assert.equal(checkAnswer(board,[0,0],{operation:'add',target:16}),false);
  assert.equal(checkAnswer(board,[0],{operation:'add',target:8}),false);
});
