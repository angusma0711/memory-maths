import {SYMBOLS, makeBoard, makeQuestions, checkAnswer} from './game.js';
const $ = id => document.getElementById(id);
let size = 3, operation = 'add', board = [], questions = [], selected = [], phase = 'setup', current = 0, timer, deadline, solved = 0, retries = 0;
function setChoices(attribute, value) {
  document.querySelectorAll(`[${attribute}]`).forEach(button => {
    const active = button.getAttribute(attribute) === String(value);
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
}
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => { size = Number(button.dataset.size); setChoices('data-size', size); }));
document.querySelectorAll('[data-operation]').forEach(button => button.addEventListener('click', () => { operation = button.dataset.operation; setChoices('data-operation', operation); }));
function renderBoard() {
  $('board').style.setProperty('--size', size);
  $('board').replaceChildren(...board.map((card, index) => {
    const button = document.createElement('button');
    const position = selected.indexOf(index);
    const visible = phase === 'memory' || phase === 'summary' || (phase === 'correct' && position >= 0);
    button.className = `number-card${position >= 0 ? ' selected' : ''}${phase === 'correct' && position >= 0 ? ' correct' : ''}`;
    button.disabled = phase !== 'answer';
    button.setAttribute('aria-label', `Card ${card.letter}${visible ? `, number ${card.value}` : ', number hidden'}${position >= 0 ? `, selection ${position + 1}` : ''}`);
    button.setAttribute('aria-pressed', position >= 0);
    const letter = document.createElement('span'); letter.className = 'card-letter'; letter.textContent = card.letter;
    const number = document.createElement('span'); number.className = `card-number${visible ? '' : ' hidden-number'}`; number.textContent = visible ? card.value : '·';
    button.append(letter, number);
    if (position >= 0) { const badge = document.createElement('span'); badge.className = 'selection-badge'; badge.textContent = position + 1; button.append(badge); }
    button.addEventListener('click', () => selectCard(index));
    return button;
  }));
}
function renderSelection() {
  $('selection').textContent = `${selected[0] === undefined ? '—' : board[selected[0]].letter}  →  ${selected[1] === undefined ? '—' : board[selected[1]].letter}`;
  $('check').disabled = selected.length !== 2 || phase !== 'answer';
  $('clear').disabled = selected.length === 0 || phase !== 'answer';
}
function selectCard(index) {
  if (phase !== 'answer') return;
  if (selected.includes(index)) selected = selected.filter(i => i !== index);
  else if (selected.length < 2) selected.push(index);
  else return;
  $('feedback').textContent = ''; $('feedback').className = 'feedback';
  renderBoard(); renderSelection();
}
function startRound() {
  clearInterval(timer); board = makeBoard(size); questions = makeQuestions(board, operation);
  current = 0; solved = 0; retries = 0; selected = []; phase = 'memory';
  $('setup').hidden = true; $('game').hidden = false; $('memory-panel').hidden = false; $('question-panel').hidden = true; $('summary-panel').hidden = true; $('finish').hidden = false;
  $('phase-label').textContent = 'MEMORY TIME'; $('phase-title').textContent = 'Make every number count.';
  $('board-label').textContent = `${size} × ${size} grid`; $('board-hint').textContent = 'Remember each letter and number.';
  deadline = Date.now() + 30000; tick(); timer = setInterval(tick, 100); renderBoard();
}
function tick() {
  const remaining = Math.max(0, deadline - Date.now());
  $('seconds').textContent = Math.ceil(remaining / 1000); $('progress-fill').style.width = `${remaining / 300}%`;
  if (remaining === 0) { clearInterval(timer); showQuestion(); }
}
// Re-check elapsed wall time when returning from a background tab.
document.addEventListener('visibilitychange', () => { if (phase === 'memory') tick(); });
function showQuestion() {
  phase = 'answer'; selected = [];
  $('memory-panel').hidden = true; $('question-panel').hidden = false;
  $('phase-label').textContent = 'RECALL & SOLVE'; $('phase-title').textContent = 'Two cards. One answer.';
  $('board-hint').textContent = 'Say the letters. Keep the numbers in mind.';
  $('question-count').textContent = `QUESTION ${current + 1} / ${questions.length}`;
  $('equation').textContent = `□ ${SYMBOLS[operation]} □ = ${questions[current].target}`;
  $('order-hint').textContent = ['subtract', 'divide'].includes(operation) ? 'Order matters: first card, then second card.' : 'You can choose the two cards in either order.';
  $('feedback').textContent = ''; $('feedback').className = 'feedback';
  $('next').hidden = true; document.querySelector('.answer-actions').hidden = false;
  renderBoard(); renderSelection();
}
$('check').addEventListener('click', () => {
  if (phase !== 'answer' || selected.length !== 2) return;
  if (checkAnswer(board, selected, questions[current])) {
    phase = 'correct'; solved++;
    $('feedback').textContent = `Correct! ${board[selected[0]].value} ${SYMBOLS[operation]} ${board[selected[1]].value} = ${questions[current].target}`;
    $('feedback').className = 'feedback success'; $('next').hidden = false;
    $('next').textContent = current === questions.length - 1 ? 'Reveal the board →' : 'Next question →';
    document.querySelector('.answer-actions').hidden = true; renderBoard(); renderSelection(); $('next').focus();
  } else {
    retries++; $('feedback').textContent = 'Not quite. Recall the numbers and try another pair.';
    $('feedback').className = 'feedback error';
  }
});
$('clear').addEventListener('click', () => { selected = []; $('feedback').textContent = ''; renderBoard(); renderSelection(); });
$('next').addEventListener('click', () => { if (phase !== 'correct') return; if (++current < questions.length) showQuestion(); else endRound(); });
function endRound() {
  clearInterval(timer); phase = 'summary'; selected = [];
  $('phase-label').textContent = 'THE BIG REVEAL'; $('phase-title').textContent = 'Take another look.';
  $('board-hint').textContent = 'All numbers revealed.';
  $('memory-panel').hidden = true; $('question-panel').hidden = true; $('summary-panel').hidden = false; $('finish').hidden = true;
  $('summary-text').textContent = `${solved} of 5 questions solved${retries ? `, with ${retries} ${retries === 1 ? 'retry' : 'retries'}` : ''}. Talk through the pairs, then try a fresh set of cards.`;
  renderBoard();
}
$('finish').addEventListener('click', () => $('end-dialog').showModal());
$('cancel-end').addEventListener('click', () => $('end-dialog').close());
$('confirm-end').addEventListener('click', () => { $('end-dialog').close(); endRound(); });
$('start').addEventListener('click', startRound); $('again').addEventListener('click', startRound);
$('settings').addEventListener('click', () => { phase = 'setup'; $('game').hidden = true; $('setup').hidden = false; });
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('fullscreen').textContent = 'Use your browser’s full-screen option'; }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen ↙' : 'Full screen ↗'; });
