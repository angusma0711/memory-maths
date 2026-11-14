import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBoard, makeQuestions, checkAnswer, calculate} from '../game.js';
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
test('configured counts produce solvable single-operation and balanced mixed rounds', () => {
  for (const size of [3,4,5]) {
    const board = makeBoard(size);
    for (const count of [1,3,4,7,30]) for (const operation of ['add','subtract','multiply','divide','mixed']) {
      const questions = makeQuestions(board, operation, count);
      assert.equal(questions.length, count);
      for (const question of questions) {
        assert.ok(board.some((_,a) => board.some((_,b) => checkAnswer(board,[a,b],question))));
        if (operation !== 'mixed') assert.equal(question.operation, operation);
      }
      if (operation === 'mixed') {
        const totals = ['add','subtract','multiply','divide'].map(op => questions.filter(q => q.operation === op).length);
        assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
        if (count >= 4) assert.ok(totals.every(total => total > 0));
      }
    }
  }
});
test('invalid question counts are rejected', () => {
  for (const count of [0,31,1.5,NaN]) assert.throws(() => makeQuestions(makeBoard(3),'mixed',count));
});
test('any subset of one to four operations is balanced and excludes unselected kinds', () => {
  const all = ['add','subtract','multiply','divide'];
  for (let mask = 1; mask < 16; mask++) {
    const selected = all.filter((_, i) => mask & (1 << i));
    for (const count of [1,5,12,30]) {
      const board = makeBoard(3);
      const questions = makeQuestions(board, selected, count);
      assert.equal(questions.length, count);
      assert.ok(questions.every(q => selected.includes(q.operation)));
      const totals = selected.map(op => questions.filter(q => q.operation === op).length);
      assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
      if (count >= selected.length) assert.ok(totals.every(n => n > 0));
      for (const q of questions) assert.ok(board.some((_,a) => board.some((_,b) => checkAnswer(board,[a,b],q))));
    }
  }
  assert.throws(() => makeQuestions(makeBoard(3), []));
  assert.throws(() => makeQuestions(makeBoard(3), ['invalid']));
});
test('custom ranges stay bounded and support every operation, including narrow high ranges', () => {
  for (const size of [3,4,5]) for (const [min,max] of [[1,2],[1,20],[10,20],[50,99],[98,99],[1,99]]) {
    for (let run = 0; run < 20; run++) {
      const board = makeBoard(size,min,max);
      assert.equal(board.length,size*size);
      assert.ok(board.every(card => Number.isInteger(card.value) && card.value >= min && card.value <= max));
      const questions = makeQuestions(board,'mixed',12);
      for (const question of questions) {
        assert.ok(Number.isInteger(question.target) && question.target > 0);
        assert.ok(board.some((_,a) => board.some((_,b) => checkAnswer(board,[a,b],question))));
      }
    }
  }
});
test('invalid number ranges are rejected', () => {
  for (const [min,max] of [[-1,9],[1,100],[9,1],[5,5],[1.5,9],[1,9.5],[NaN,9]]) assert.throws(() => makeBoard(3,min,max));
});
test('zero-inclusive ranges remain solvable even with extreme random sequences', () => {
  for (const size of [3,4,5]) for (const max of [1,2,9,99]) for (const random of [Math.random, () => 0, () => 0.999]) {
    const board = makeBoard(size,0,max,random);
    assert.equal(board.length,size*size);
    assert.ok(board.some(c => c.value === 0));
    assert.ok(board.every(c => Number.isInteger(c.value) && c.value >= 0 && c.value <= max));
    for (const q of makeQuestions(board,'mixed',30)) {
      assert.ok(Number.isFinite(q.target) && Number.isInteger(q.target));
      assert.ok(q.operation === 'subtract' ? q.target > 0 : q.target >= 0);
      assert.ok(board.some((_,a) => board.some((_,b) => checkAnswer(board,[a,b],q))));
    }
  }
});
test('zero can participate in equations but can never be a divisor', () => {
  const board = [0,0,1,2].map(value => ({value}));
  assert.ok(Number.isNaN(calculate(1,0,'divide')));
  assert.ok(Number.isNaN(calculate(0,0,'divide')));
  assert.ok(checkAnswer(board,[0,2],{operation:'divide',target:0}));
  assert.equal(checkAnswer(board,[2,0],{operation:'divide',target:Infinity}),false);
  assert.equal(checkAnswer(board,[0,1],{operation:'divide',target:0}),false);
  for (const operation of ['add','multiply','divide']) {
    const questions = makeQuestions(board,operation,10);
    assert.ok(questions.some(q => q.target === 0));
  }
});
