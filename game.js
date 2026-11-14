export const SYMBOLS = {add: '+', subtract: '−', multiply: '×', divide: '÷'};
export function calculate(a, b, operation) {
  if (operation === 'add') return a + b;
  if (operation === 'subtract') return a - b;
  if (operation === 'multiply') return a * b;
  if (operation === 'divide') return b === 0 ? NaN : a / b;
  throw new Error('Unknown operation');
}
export function makeBoard(size, min = 1, max = 9, random = Math.random) {
  if (![3, 4, 5].includes(size)) throw new Error('Invalid grid size');
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 99 || min >= max) throw new Error('Use an increasing integer range within 0–99');
  // Seed a positive difference and an integer division pair, even for narrow ranges.
  const numbers = [min, max];
  if (min === 0) {
    numbers.push(1); // Keep a nonzero divisor, including two 1 cards for the 0–1 range.
  } else if (min * 2 <= max) {
    if (min * 2 !== max) numbers.push(min * 2);
  } else numbers.push(min); // Two different cards with the same value can divide to 1.
  const candidates = Array.from({length: max - min + 1}, (_, i) => min + i).filter(value => !numbers.includes(value));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  numbers.push(...candidates.slice(0, size * size - numbers.length));
  while (numbers.length < size * size) numbers.push(min + Math.floor(random() * (max - min + 1)));
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.map((value, i) => ({letter: String.fromCharCode(65 + i), value}));
}
export function shuffleBoard(board, random = Math.random) {
  const values = board.map(card => card.value);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  // Guarantee a visibly changed arrangement when at least two values differ.
  if (values.every((value, index) => value === board[index].value)) {
    const different = values.findIndex(value => value !== values[0]);
    if (different > 0) [values[0], values[different]] = [values[different], values[0]];
  }
  return board.map((card, index) => ({...card, value: values[index]}));
}
export function makeQuestions(board, operation, count = 5, random = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error('Question count must be 1–30');
  const operations = [...new Set(Array.isArray(operation) ? operation : operation === 'mixed' ? Object.keys(SYMBOLS) : [operation])];
  if (!operations.length || operations.some(op => !Object.hasOwn(SYMBOLS, op))) throw new Error('Select at least one valid operation');
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
      if (a === b || (op === 'divide' && board[b].value === 0)) continue;
      const result = calculate(board[a].value, board[b].value, op);
      if (Number.isInteger(result) && (op === 'subtract' ? result > 0 : result >= 0)) results.add(result);
    }
    if (!results.size) throw new Error('No valid questions');
    return [op, shuffle([...results])];
  }));
  // Cycle through selected operations; exhaust each answer pool before repeating it.
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
  return Number.isFinite(a) && Number.isFinite(b) && !(question.operation === 'divide' && b === 0) && calculate(a, b, question.operation) === question.target;
}
