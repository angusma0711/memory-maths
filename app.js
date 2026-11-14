import {SYMBOLS, makeBoard, shuffleBoard, makeQuestions, checkAnswer} from './game.js';
const $ = id => document.getElementById(id);
let size = 3, operations = ['add'], board = [], questions = [], selected = [], phase = 'setup', current = 0, timer, deadline, memorySeconds = 30, solved = 0, retries = 0;
function setChoices(attribute, value) {
  document.querySelectorAll(`[${attribute}]`).forEach(button => {
    const active = button.getAttribute(attribute) === String(value);
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
}
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => { size = Number(button.dataset.size); setChoices('data-size', size); }));
document.querySelectorAll('[data-operation]').forEach(button => button.addEventListener('click', () => {
  const operation = button.dataset.operation;
  if (operations.includes(operation)) {
    if (operations.length === 1) {
      $('operation-help').textContent = '至少需要選擇一種運算。';
      return;
    }
    operations = operations.filter(value => value !== operation);
  } else operations.push(operation);
  document.querySelectorAll('[data-operation]').forEach(choice => {
    const active = operations.includes(choice.dataset.operation);
    choice.classList.toggle('active', active);
    choice.setAttribute('aria-pressed', active);
  });
  $('operation-help').textContent = `已選 ${operations.length} 種運算；再次點選可取消，至少保留一種。`;
}));
function renderBoard() {
  $('board').style.setProperty('--size', size);
  $('board').dataset.digits = board.some(card => card.value >= 10) ? '2' : '1';
  $('board').replaceChildren(...board.map((card, index) => {
    const button = document.createElement('button');
    const position = selected.indexOf(index);
    const visible = phase === 'memory' || phase === 'summary' || (phase === 'correct' && position >= 0);
    button.className = `number-card${position >= 0 ? ' selected' : ''}${phase === 'correct' && position >= 0 ? ' correct' : ''}`;
    button.disabled = phase !== 'answer';
    button.setAttribute('aria-label', `卡片 ${card.letter}${visible ? `，數字 ${card.value}` : '，數字已隱藏'}${position >= 0 ? `，第 ${position + 1} 張選擇` : ''}`);
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
  if (!['number-min', 'number-max', 'memory-time', 'round-questions'].every(id => $(id).reportValidity())) return;
  const min = Number($('number-min').value), max = Number($('number-max').value);
  if (min >= max) {
    $('range-error').textContent = '最小值必須小於最大值，請調整數字範圍。';
    $('number-max').focus();
    return;
  }
  $('range-error').textContent = '';
  $('round-info').textContent = `數字範圍 ${min}–${max} · 每題選兩張不同的卡`;
  memorySeconds = Number($('memory-time').value);
  clearInterval(timer); board = makeBoard(size, min, max); questions = makeQuestions(board, operations, Number($('round-questions').value));
  current = 0; solved = 0; retries = 0;
  $('setup').hidden = true; $('game').hidden = false;
  $('board-label').textContent = `${size} × ${size} 網格`;
  startMemory();
}
function startMemory(reshuffle = false) {
  clearInterval(timer);
  if (reshuffle) board = shuffleBoard(board);
  selected = []; phase = 'memory';
  $('memory-panel').hidden = false; $('question-panel').hidden = true; $('summary-panel').hidden = true; $('finish').hidden = false;
  $('phase-label').textContent = `第 ${current + 1} / ${questions.length} 題 · 記憶階段`;
  $('phase-title').textContent = reshuffle ? '重新記住數字與位置' : '記住數字與位置';
  $('board-hint').textContent = reshuffle ? '卡片已重新洗牌，請重新記憶。' : '記住每張卡的字母和數字。';
  $('equation').textContent = ''; $('feedback').textContent = ''; $('feedback').className = 'feedback'; $('next').hidden = true;
  renderSelection();
  deadline = Date.now() + memorySeconds * 1000; tick(); timer = setInterval(tick, 100); renderBoard();
}
function tick() {
  const remaining = Math.max(0, deadline - Date.now());
  $('seconds').textContent = Math.ceil(remaining / 1000); $('progress-fill').style.width = `${remaining / (memorySeconds * 1000) * 100}%`;
  if (remaining === 0) { clearInterval(timer); showQuestion(); }
}
// Re-check elapsed wall time when returning from a background tab.
document.addEventListener('visibilitychange', () => { if (phase === 'memory') tick(); });
function showQuestion() {
  phase = 'answer'; selected = [];
  $('memory-panel').hidden = true; $('question-panel').hidden = false;
  $('phase-label').textContent = '回憶與運算'; $('phase-title').textContent = '找出符合算式的兩張卡';
  $('board-hint').textContent = '學生口述字母，教師依次選卡。';
  $('question-count').textContent = `第 ${current + 1} / ${questions.length} 題`;
  $('equation').textContent = `□ ${SYMBOLS[questions[current].operation]} □ = ${questions[current].target}`;
  $('order-hint').textContent = ['subtract', 'divide'].includes(questions[current].operation) ? '請注意次序：第一張卡的數字，再運算第二張卡的數字。' : '兩張卡的選取次序不限。';
  $('feedback').textContent = ''; $('feedback').className = 'feedback';
  $('next').hidden = true; document.querySelector('.answer-actions').hidden = false;
  renderBoard(); renderSelection();
}
$('check').addEventListener('click', () => {
  if (phase !== 'answer' || selected.length !== 2) return;
  if (checkAnswer(board, selected, questions[current])) {
    phase = 'correct'; solved++;
    $('feedback').textContent = `答對了！${board[selected[0]].value} ${SYMBOLS[questions[current].operation]} ${board[selected[1]].value} = ${questions[current].target}`;
    $('feedback').className = 'feedback success'; $('next').hidden = false;
    $('next').textContent = current === questions.length - 1 ? '揭示全部數字 →' : '洗牌並記憶下一題 →';
    document.querySelector('.answer-actions').hidden = true; renderBoard(); renderSelection(); $('next').focus();
  } else {
    retries++; $('feedback').textContent = '未答對，請回想數字，再選一次。';
    $('feedback').className = 'feedback error';
  }
});
$('clear').addEventListener('click', () => { selected = []; $('feedback').textContent = ''; renderBoard(); renderSelection(); });
$('next').addEventListener('click', () => { if (phase !== 'correct') return; if (++current < questions.length) startMemory(true); else endRound(); });
function endRound() {
  clearInterval(timer); phase = 'summary'; selected = [];
  $('phase-label').textContent = '揭示全部數字'; $('phase-title').textContent = '一起核對牌面';
  $('board-hint').textContent = '所有數字已顯示。';
  $('memory-panel').hidden = true; $('question-panel').hidden = true; $('summary-panel').hidden = false; $('finish').hidden = true;
  $('summary-text').textContent = `完成 ${solved} / ${questions.length} 題${retries ? `，重試 ${retries} 次` : ''}。一起回顧數字配對，或開始新回合。`;
  renderBoard();
}
$('finish').addEventListener('click', () => $('end-dialog').showModal());
$('cancel-end').addEventListener('click', () => $('end-dialog').close());
$('confirm-end').addEventListener('click', () => { $('end-dialog').close(); endRound(); });
['number-min', 'number-max'].forEach(id => $(id).addEventListener('input', () => { $('range-error').textContent = ''; }));
$('start').addEventListener('click', startRound); $('again').addEventListener('click', startRound);
$('settings').addEventListener('click', () => { phase = 'setup'; $('game').hidden = true; $('setup').hidden = false; });
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('fullscreen').textContent = '請使用瀏覽器的全螢幕功能'; }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '離開全螢幕 ↙' : '全螢幕 ↗'; });
