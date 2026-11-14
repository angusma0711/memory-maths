export const SYMBOLS = {add: '+', subtract: '−', multiply: '×', divide: '÷'};
export function calculate(a, b, operation) {
  if (operation === 'add') return a + b;
  if (operation === 'subtract') return a - b;
  if (operation === 'multiply') return a * b;
  if (operation === 'divide') return a / b;
  throw new Error('Unknown operation');
}
export function makeBoard(size, random = Math.random) {
  if (![3, 4, 5].includes(size)) throw new Error('Invalid grid size');
  // Guarantee a useful spread and an integer division pair in every board.
  const numbers = Array.from({length: size * size}, (_, i) => i < 9 ? i + 1 : 1 + Math.floor(random() * 9));
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.map((value, i) => ({letter: String.fromCharCode(65 + i), value}));
}
export function makeQuestions(board, operation, count = 5, random = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error('Question count must be 1–30');
  const operations = operation === 'mixed' ? Object.keys(SYMBOLS) : [operation];
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  const pools = new Map(operations.map(op => {
    const results = new Set();
    for (let a = 0; a < board.length; a++) for (let b = 0; b < board.length; b++) {
      if (a === b) continue;
      const result = calculate(board[a].value, board[b].value, op);
      if (Number.isInteger(result) && result > 0) results.add(result);
    }
    if (!results.size) throw new Error('No valid questions');
    return [op, shuffle([...results])];
  }));
  // Cycle through all four operations; exhaust each answer pool before repeating it.
  const order = shuffle([...operations]);
  const used = new Map(operations.map(op => [op, 0]));
  return Array.from({length: count}, (_, i) => {
    const op = order[i % order.length];
    const pool = pools.get(op);
    const index = used.get(op);
    used.set(op, index + 1);
    return {operation: op, target: pool[index % pool.length]};
  });
}
export function checkAnswer(board, selected, question) {
  if (selected.length !== 2 || selected[0] === selected[1]) return false;
  const [a, b] = selected.map(index => board[index]?.value);
  return Number.isFinite(a) && Number.isFinite(b) && calculate(a, b, question.operation) === question.target;
}
