import {makeBoard, makeQuestions, shuffleBoard, SYMBOLS, checkAnswer} from './game.js';
import {firebaseConfig, emulatorConfig} from './firebase-config.js';

const $ = id => document.getElementById(id);
const LETTERS = 'ABCDEFGHI';
const MEMORY_MS = 15000;
const ANSWER_MS = 30000;
const TOTAL = 3;
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const config = local ? emulatorConfig : firebaseConfig;
const codePattern = /^[A-F0-9]{16}$/;
const invite = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';

let db, api, uid, roomCode, room, selected = [], roundKey, connected = false, busy = false, offset = 0;
let unsubscribe;
const status = message => { $('status').textContent = message; };
const roomRef = (suffix = '') => api.ref(db, `pvpRooms/${roomCode}${suffix}`);
const now = () => Date.now() + offset;
const playerLabel = playerId => playerId === uid ? '你'
  : playerId === room.host ? '房主' : `玩家 ${playerId.slice(-6)}`;

async function initialize() {
  if (!config) {
    status('這個版本尚未連接 Firebase，請使用單人模式。');
    return;
  }
  const cdn = 'https://www.gstatic.com/firebasejs/12.4.0';
  const [appApi, authApi, databaseApi] = await Promise.all([
    import(`${cdn}/firebase-app.js`), import(`${cdn}/firebase-auth.js`), import(`${cdn}/firebase-database.js`),
  ]);
  api = databaseApi;
  const app = appApi.initializeApp(config);
  const auth = authApi.getAuth(app);
  db = api.getDatabase(app);
  if (local) {
    authApi.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    api.connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  await authApi.setPersistence(auth, authApi.browserSessionPersistence);
  await auth.authStateReady();
  uid = (auth.currentUser ?? (await authApi.signInAnonymously(auth)).user).uid;
  $('code').value = codePattern.test(invite) ? invite : '';
  api.onValue(api.ref(db, '.info/serverTimeOffset'), snapshot => { offset = snapshot.val() ?? 0; });
  api.onValue(api.ref(db, '.info/connected'), snapshot => {
    connected = snapshot.val() === true;
    status(connected ? '' : '連線中斷或尚未建立。');
    render();
  });
  setInterval(renderClock, 150);
}

function renderClock() {
  if (!room) return;
  const key = Object.keys(room.rounds ?? {}).sort().at(-1);
  if (!key) return;
  const round = room.rounds[key];
  const remaining = room.claims?.[key] ? 0 : round.started + MEMORY_MS + ANSWER_MS - now();
  const phase = remaining <= 0 ? 'result' : remaining > ANSWER_MS ? 'memory' : 'answer';
  if (`${key}:${phase}` !== roundKey) return render();
  $('timer').textContent = phase === 'result' ? '' : `剩餘 ${Math.ceil((remaining - (phase === 'memory' ? ANSWER_MS : 0)) / 1000)} 秒`;
}

function render() {
  $('create').disabled = $('join').disabled = !connected || busy;
  if (!room) return;
  $('lobby').hidden = true;
  $('match').hidden = false;
  $('room-code').textContent = roomCode;
  const host = room.host === uid;
  const players = [room.host, ...Object.keys(room.players ?? {})];
  const hasOpponents = players.length > 1;
  const winners = Object.values(room.claims ?? {});
  const scoreByPlayer = new Map(players.map(player => [player, 0]));
  for (const claim of winners) scoreByPlayer.set(claim.uid, (scoreByPlayer.get(claim.uid) ?? 0) + 1);
  const leaderboard = [...scoreByPlayer].sort((a, b) => b[1] - a[1]);
  const [leader, bestScore] = leaderboard[0];
  const tied = leaderboard[1]?.[1] === bestScore;
  $('player-count').textContent = `${players.length} 人已加入`;
  $('score').textContent = `你的得分 ${scoreByPlayer.get(uid) ?? 0}`;
  $('leaderboard').replaceChildren(...leaderboard.filter(([player, score]) => score || player === uid).map(([player, score]) => {
    const entry = document.createElement('li');
    entry.textContent = `${playerLabel(player)} · ${score} 分`;
    return entry;
  }));
  const key = Object.keys(room.rounds ?? {}).sort().at(-1);
  const round = room.rounds?.[key];
  const claim = room.claims?.[key];
  $('qr-invite').hidden = !host || Boolean(round);
  if (!$('qr-invite').hidden && $('room-qr').dataset.code !== roomCode) renderInviteQR();
  const elapsed = now() - (round?.started ?? 0);
  const phase = !round ? 'lobby' : claim || elapsed >= MEMORY_MS + ANSWER_MS ? 'result' : elapsed < MEMORY_MS ? 'memory' : 'answer';
  const context = `${key}:${phase}`;
  if (roundKey !== context) selected = [];
  roundKey = context;
  const answer = phase === 'answer';
  const finished = phase === 'result' && Number(key) === TOTAL;
  $('phase').textContent = !round
    ? hasOpponents ? '玩家已就緒，可繼續掃碼加入' : '等候其他玩家加入'
    : phase === 'memory' ? `第 ${key} 題 · 記住數字`
    : answer ? `第 ${key} 題 · 搶答`
    : finished ? `對戰結束 · ${tied ? '平手' : leader === uid ? '你勝出' : `${playerLabel(leader)}勝出`}`
    : `本題結束 · ${claim ? `${playerLabel(claim.uid)}得 1 分` : '時間到'}`;
  $('advance').hidden = !host || !hasOpponents || (phase !== 'lobby' && (phase !== 'result' || finished));
  $('advance').disabled = !connected || busy;
  $('advance').textContent = round ? '洗牌並開始下一題' : '開始對戰';
  $('prompt').hidden = !answer;
  $('prompt').textContent = answer ? `□ ${SYMBOLS[round.operation]} □ = ${round.target}` : '';
  $('cards').hidden = !round;
  $('selection').textContent = answer && selected.length ? `已選 ${selected.join(' → ')}` : '';
  $('submit').hidden = !answer;
  $('submit').disabled = !connected || busy || selected.length !== 2;
  $('cards').replaceChildren(...(round ? Array.from(LETTERS, letter => {
    const card = document.createElement('button');
    card.className = 'number-card';
    card.disabled = !answer || !connected || busy;
    card.setAttribute('aria-pressed', selected.includes(letter));
    card.classList.toggle('selected', selected.includes(letter));
    const label = document.createElement('span');
    label.className = 'card-letter';
    label.textContent = letter;
    const number = document.createElement('span');
    number.className = 'card-number';
    number.textContent = answer ? '·' : round.board[letter];
    card.append(label, number);
    card.addEventListener('click', () => {
      if (selected.includes(letter)) selected = selected.filter(item => item !== letter);
      else if (selected.length < 2) selected.push(letter);
      render();
    });
    return card;
  }) : []));
  renderClock();
}

async function perform(action, failure) {
  if (!connected || busy) return;
  busy = true;
  status('');
  render();
  try { await action(); }
  catch (error) { console.error(error); status(failure); }
  finally { busy = false; render(); }
}

function watchRoom() {
  unsubscribe?.();
  const url = new URL(location.href);
  url.searchParams.set('room', roomCode);
  history.replaceState(null, '', url);
  unsubscribe = api.onValue(roomRef(), snapshot => {
    room = snapshot.val();
    render();
  }, () => status('房間已失效，請重新建立或加入。'));
}

$('create').onclick = () => perform(async () => {
  roomCode = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  await api.set(roomRef(), {host: uid, created: api.serverTimestamp()});
  watchRoom();
}, '無法建立房間，請再試。');

$('join-form').onsubmit = event => {
  event.preventDefault();
  const code = $('code').value.trim().toUpperCase();
  if (!codePattern.test(code)) return;
  perform(async () => {
    roomCode = code;
    // A previous participant can resume from the same browser tab.
    const existing = await api.get(roomRef()).catch(() => null);
    if (!existing?.exists()) await api.set(roomRef(`/players/${uid}`), api.serverTimestamp());
    watchRoom();
  }, '無法加入。請檢查房間代碼或對戰是否已開始。');
};

function renderInviteQR() {
  const container = $('room-qr');
  const url = new URL('pvp.html', location.href);
  url.searchParams.set('room', roomCode);
  try {
    const qr = globalThis.qrcode(0, 'M');
    qr.addData(url.href);
    qr.make();
    const svg = qr.createSvgTag({cellSize: 5, margin: 20, scalable: true});
    container.innerHTML = svg;
    container.dataset.code = roomCode;
    $('qr-caption').textContent = local
      ? '本機預覽僅限這部電腦。可在另一個瀏覽器視窗輸入房間代碼。'
      : '用手機掃描 QR Code，再按「加入」。對戰開始前可繼續加入。';
  } catch (error) {
    console.error(error);
    $('qr-caption').textContent = '暫時無法顯示 QR Code，請輸入房間代碼加入。';
  }
}

$('advance').onclick = () => perform(async () => {
  const key = Object.keys(room.rounds ?? {}).sort().at(-1);
  const last = room.rounds?.[key];
  const board = last
    ? shuffleBoard(Array.from(LETTERS, letter => ({letter, value: last.board[letter]})))
    : makeBoard(3);
  const question = makeQuestions(board, ['add', 'subtract', 'multiply', 'divide'], 1)[0];
  await api.set(roomRef(`/rounds/${Number(key ?? 0) + 1}`), {
    ...question, started: api.serverTimestamp(), board: Object.fromEntries(board.map(card => [card.letter, card.value])),
  });
}, '無法開始該題，請稍後再試。');

$('submit').onclick = () => perform(async () => {
  const key = Object.keys(room.rounds).sort().at(-1);
  const round = room.rounds[key];
  const board = Array.from(LETTERS, letter => ({letter, value: round.board[letter]}));
  if (!checkAnswer(board, selected.map(letter => LETTERS.indexOf(letter)), round)) {
    status('這個組合不正確，可以再試。');
    return;
  }
  const [a, b] = selected;
  const result = await api.runTransaction(roomRef(`/claims/${key}`), existing => {
    return existing === null ? {uid, a, b} : undefined;
  }, {applyLocally: false});
  if (!result.committed) status('已有玩家搶先答對。');
}, '已有人搶先答對，或本題時間已到。');

initialize().catch(error => {
  console.error(error);
  status('無法連接 Firebase。請確認 Firebase 服務或本機模擬器已啟動。');
});
