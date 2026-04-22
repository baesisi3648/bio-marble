// ===== GAME CORE =====
// State, turn management, movement, landing handlers, quiz flow, keys.

const START_COINS = 30;
const RESERVE_FEE = 5;          // paid into pool when pool is empty
const START_PASS_BONUS = 2;
const START_LAND_BONUS = 3;
const QUIZ_TIME_SEC = 10;
const JAIL_ESCAPE_COST = 3;

// TILES, PLAYER_COLORS, PLAYER_AVATARS are global consts from render.js — do not redeclare.

const GOLDEN_KEYS = [
  { text:'생물 구조에 성공했습니다! 상금 +1 코인',  effect:'coins',       value:1 },
  { text:'생물 구조에 성공했습니다! 상금 +2 코인',  effect:'coins',       value:2 },
  { text:'생물 구조에 성공했습니다! 상금 +3 코인',  effect:'coins',       value:3 },
  { text:'생물 구조에 성공했습니다! 상금 +5 코인',  effect:'coins',       value:5 },
  { text:'생물 구조에 실패했습니다... 벌금 -1 코인', effect:'coins',       value:-1 },
  { text:'생물 구조에 실패했습니다... 벌금 -2 코인', effect:'coins',       value:-2 },
  { text:'원하는 곳으로 이동할 수 있습니다!',        effect:'teleport',   value:0 },
  { text:'상대 팀의 동물원 하나를 가로챌 수 있습니다!', effect:'steal',     value:0 },
  { text:'상대 팀과 우리 팀의 동물원을 교체합니다!',   effect:'swap',      value:0 },
  { text:'상대 팀 동물원 하나를 폐쇄합니다!',          effect:'close',     value:0 },
  { text:'원하는 곳에 동물원을 무상 설립!',            effect:'free_zoo',  value:0 },
  { text:'다음 턴에 주사위를 두 번 던집니다!',         effect:'double_turn', value:0 },
];

let state = {
  players: [], current: 0, phase: 'roll',
  diceResult: 0, doubleTurnNext: [],
  zoos: {}, jailTurns: {},
  reservePool: 0,
  currentQuiz: null, quizContext: null,
  quizTimerHandle: null,
};
window.gameState = state;

// ===== SETUP =====
function updatePlayerInputs() {
  const n = +document.getElementById('player-count').value;
  const div = document.getElementById('player-inputs');
  div.innerHTML = '';
  for (let i = 0; i < n; i++) {
    div.innerHTML +=
      `<div class="player-name-row">
         <div class="color-dot" style="background:${PLAYER_COLORS[i]}">${PLAYER_AVATARS[i]}</div>
         <input id="pname-${i}" placeholder="${i+1}모둠" value="${i+1}모둠">
       </div>`;
  }
}

async function startGame() {
  const n = +document.getElementById('player-count').value;
  state = {
    players: [], current: 0, phase: 'roll',
    diceResult: 0, doubleTurnNext: [],
    zoos: {}, jailTurns: {},
    reservePool: 0,
    currentQuiz: null, quizContext: null,
    quizTimerHandle: null,
  };
  window.gameState = state;

  for (let i = 0; i < n; i++) {
    state.players.push({
      name: document.getElementById(`pname-${i}`).value || `${i+1}모둠`,
      color: PLAYER_COLORS[i],
      coins: START_COINS,
      position: 0,
      bankrupt: false,
    });
  }

  // Initialize new quiz cycle for this game
  QuizPool.newGame();

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';

  Render.renderBoard(state);
  wireGameControls();

  // First user gesture reached game start click => BGM starts
  AudioMgr.startBgm();

  checkJailOnTurn();
}

function wireGameControls() {
  const btn = document.getElementById('btn-roll');
  if (btn) btn.onclick = rollDice;
}

// ===== DICE =====
async function rollDice() {
  if (state.phase !== 'roll') return;
  state.phase = 'rolling';
  document.getElementById('btn-roll').disabled = true;

  AudioMgr.playSfx('dice');

  const r1 = Math.floor(Math.random() * 6) + 1;
  const r2 = Math.floor(Math.random() * 6) + 1;
  const total = r1 + r2;
  state.diceResult = total;

  await Render.animateDiceRoll(r1, r2);
  setTimeout(() => movePlayer(total), 350);
}

// ===== MOVEMENT =====
function movePlayer(steps) {
  state.phase = 'moving';
  const p = state.players[state.current];
  let moved = 0;
  console.log('[bio] movePlayer start', { player: p.name, steps, from: p.position });
  const iv = setInterval(() => {
    try {
      moved++;
      p.position = (p.position + 1) % 28;
      if (p.position === 0 && moved < steps) {
        p.coins += START_PASS_BONUS;
        AudioMgr.playSfx('coin');
        Render.renderPlayers(state);
      }
      Render.renderTokens(state);
      Render.hopToken(state.current);
      Render.highlightTile(p.position);
      Render.updateTurnInfo(state);
      if (moved >= steps) {
        clearInterval(iv);
        console.log('[bio] movePlayer done, landing at', p.position, TILES[p.position]?.name);
        setTimeout(() => {
          try { handleLanding(); }
          catch (e) { console.error('[bio] handleLanding error:', e); }
        }, 350);
      }
    } catch (e) {
      console.error('[bio] movePlayer step error:', e);
      clearInterval(iv);
    }
  }, 220);
}

// ===== LANDING =====
function handleLanding() {
  const p = state.players[state.current];
  const tile = TILES[p.position];
  console.log('[bio] handleLanding', { player: p.name, pos: p.position, tile });
  if (!tile) {
    console.error('[bio] No tile at position', p.position);
    showNextTurn();
    return;
  }
  Render.highlightTile(p.position);

  switch (tile.type) {
    case 'start':
      p.coins += START_LAND_BONUS;
      AudioMgr.playSfx('coin');
      Render.renderPlayers(state);
      Render.updateTurnInfo(state);
      showNextTurn();
      break;
    case 'key': drawGoldenKey(); break;
    case 'animal': handleAnimal(tile); break;
    case 'jail': handleJail(); break;
    case 'reserve':
      handleReserve();
      break;
    case 'travel': handleTravel(); break;
    default:
      console.warn('[bio] Unknown tile type:', tile.type);
      showNextTurn();
  }
}

function handleAnimal(tile) {
  const zoo = state.zoos[tile.id];
  if (zoo && zoo.owner === state.current) handleOwnZoo(tile, zoo);
  else if (zoo) handleOpponentZoo(tile, zoo);
  else askStartQuiz(tile, 'build');
}

// ===== 생물보호구역 (누적 시스템) =====
// Pool empty  → player pays RESERVE_FEE (5) into pool
// Pool filled → player claims pool total, pool resets to 0
function handleReserve() {
  const p = state.players[state.current];
  if (state.reservePool > 0) {
    const claim = state.reservePool;
    p.coins += claim;
    state.reservePool = 0;
    AudioMgr.playSfx('coin');
    Render.renderPlayers(state);
    Render.updateTurnInfo(state);
    Render.renderReservePool(state);
    showModal('🏕️', '생물 보호 구역',
      `<p style="text-align:center">누적된 보호 기금을</p>
       <p style="text-align:center;font-size:1.8em;color:#ffd700;font-weight:bold">+${claim} 코인 획득!</p>
       <p style="text-align:center;color:#888;font-size:0.9em">누적 기금이 초기화됩니다.</p>`,
      [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
  } else {
    const fee = Math.min(RESERVE_FEE, p.coins);
    p.coins -= fee;
    state.reservePool += fee;
    AudioMgr.playSfx('coin');
    if (p.coins <= 0) checkBankrupt(state.current);
    Render.renderPlayers(state);
    Render.updateTurnInfo(state);
    Render.renderReservePool(state);
    showModal('🏕️', '생물 보호 구역',
      `<p style="text-align:center">생물 보호 기금 납부</p>
       <p style="text-align:center;font-size:1.6em;color:#ef5350;font-weight:bold">-${fee} 코인</p>
       <p style="text-align:center;color:#888;font-size:0.9em">누적 기금: ${state.reservePool}코인<br>다음 도착자가 전액 수령합니다.</p>`,
      [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
  }
}

// ===== QUIZ FLOW =====
// Stage 1: [시작] button in center action box
function askStartQuiz(tile, purpose) {
  const quiz = QuizPool.draw();
  console.log('[bio] askStartQuiz', { tile: tile.name, purpose, quizId: quiz?.id });
  if (!quiz) {
    // No questions available
    showModal('⚠️', '문제가 없습니다',
      '<p style="text-align:center">관리자 페이지에서 문제를 먼저 등록해주세요.</p>',
      [{ text:'다음 턴', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
    return;
  }
  state.currentQuiz = quiz;
  state.quizContext = { tile, purpose };
  state.phase = 'quiz-ready';

  showAction([{
    text: `▶️ ${tile.name} 문제 시작`,
    class: 'action-btn btn-start-quiz',
    action: beginQuizCountdown,
  }]);
}

// Stage 2: 3-2-1 countdown
function beginQuizCountdown() {
  state.phase = 'quiz-countdown';
  Render.showCountdown(() => launchQuiz());
}

// Stage 3: full-screen quiz with 10s timer
function launchQuiz() {
  state.phase = 'quiz-active';
  const quiz = state.currentQuiz;
  const { tile } = state.quizContext;
  const p = state.players[state.current];

  const overlay = document.getElementById('quiz-overlay');
  overlay.innerHTML = `
    <div class="quiz-header">
      <div class="quiz-player">
        <div class="p-avatar" style="border-color:${p.color}">${PLAYER_AVATARS[state.current]}</div>
        <div class="quiz-player-name" style="color:${p.color}">${p.name}</div>
      </div>
      <div class="quiz-tile-name">${tile.emoji} ${tile.name}</div>
    </div>
    <div class="quiz-question-box">${escapeHtml(quiz.q).replace(/\n/g,'<br>')}</div>
    <div class="quiz-timer-big" id="quiz-timer">${QUIZ_TIME_SEC}</div>
    <div id="quiz-action-area"></div>
  `;
  overlay.classList.add('show');

  AudioMgr.startQuizAmbience();

  let timeLeft = QUIZ_TIME_SEC;
  const timerEl = document.getElementById('quiz-timer');
  let tickStarted = false;
  state.quizTimerHandle = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 3 && !tickStarted) {
      tickStarted = true;
      timerEl.classList.add('urgent');
      AudioMgr.startTimerTick();
    }
    if (timeLeft <= 0) {
      clearInterval(state.quizTimerHandle);
      state.quizTimerHandle = null;
      AudioMgr.stopTimerTick();
      AudioMgr.stopQuizAmbience();
      showRevealButton();
    }
  }, 1000);
}

// Stage 4: "정답 공개" button (manual)
function showRevealButton() {
  state.phase = 'quiz-reveal';
  const area = document.getElementById('quiz-action-area');
  if (!area) return;
  area.innerHTML = `
    <div class="quiz-buttons-big">
      <button class="btn-reveal" id="btn-reveal">🔓 정답 공개</button>
    </div>`;
  document.getElementById('btn-reveal').onclick = revealAnswer;
}

// Stage 5: show answer + success/fail buttons
function revealAnswer() {
  state.phase = 'quiz-judge';
  const quiz = state.currentQuiz;
  const area = document.getElementById('quiz-action-area');
  area.innerHTML = `
    <div class="quiz-answer-box">
      <span class="quiz-answer-label">✨ 정답</span>
      ${escapeHtml(quiz.a).replace(/\n/g,'<br>')}
    </div>
    <div class="quiz-buttons-big">
      <button class="btn-correct-big" id="btn-correct">⭕ 성공!</button>
      <button class="btn-wrong-big" id="btn-wrong">❌ 실패...</button>
    </div>`;
  document.getElementById('btn-correct').onclick = () => finishQuiz(true);
  document.getElementById('btn-wrong').onclick   = () => finishQuiz(false);
}

function finishQuiz(ok) {
  const overlay = document.getElementById('quiz-overlay');
  overlay.classList.remove('show');
  overlay.innerHTML = '';

  AudioMgr.playSfx(ok ? 'correct' : 'wrong');

  const { tile, purpose } = state.quizContext;
  state.currentQuiz = null;
  state.quizContext = null;

  if (purpose === 'build') buildAfterQuiz(tile, ok);
  else if (purpose === 'toll') tollAfterQuiz(tile, ok);
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ===== BUILD / TOLL =====
function buildAfterQuiz(tile, ok) {
  const p = state.players[state.current];
  const cost = ok ? 2 : (2 + tile.tax);
  if (p.coins >= cost) {
    showAction([
      { text: `🏛️ 동물원 건설 (${cost}코인)`, class: 'action-btn btn-build', action() {
          p.coins -= cost;
          state.zoos[tile.id] = { owner: state.current, level: 1 };
          AudioMgr.playSfx('zooBuild');
          Render.renderZoos(state);
          Render.renderPlayers(state);
          Render.updateTurnInfo(state);
          showNextTurn();
        }
      },
      { text:'건너뛰기', class:'action-btn btn-skip', action(){ showNextTurn(); } },
    ]);
  } else {
    showModal('💸','코인 부족','<p style="text-align:center">동물원을 건설할 코인이 부족합니다.</p>',
      [{ text:'다음 턴', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
  }
}

function handleOpponentZoo(tile, zoo) {
  askStartQuiz(tile, 'toll');
}

function tollAfterQuiz(tile, ok) {
  const p = state.players[state.current];
  const zoo = state.zoos[tile.id];
  if (!zoo) { showNextTurn(); return; }
  const owner = state.players[zoo.owner];
  const mult = zoo.level >= 2 ? 2 : 1;
  const toll = ok ? (tile.tax + 2) * mult : (tile.tax + 2 + 2) * mult;

  const acts = [{
    text: `💰 관람비 ${toll}코인 지불`,
    class: 'action-btn btn-pay',
    action() {
      const paid = Math.min(toll, p.coins);
      p.coins -= paid;
      owner.coins += paid;
      AudioMgr.playSfx('coin');
      if (p.coins <= 0) { p.coins = 0; checkBankrupt(state.current); }
      Render.renderPlayers(state);
      Render.updateTurnInfo(state);
      showNextTurn();
    }
  }];

  if (ok && zoo.level < 3) {
    const tc = toll * 2;
    if (p.coins >= tc) acts.push({
      text: `🔄 인수 (${tc}코인)`,
      class: 'action-btn btn-takeover',
      action() {
        p.coins -= tc; owner.coins += tc;
        zoo.owner = state.current;
        zoo.level = Math.min(zoo.level + 1, 3);
        AudioMgr.playSfx('zooBuild');
        Render.renderZoos(state);
        Render.renderPlayers(state);
        Render.updateTurnInfo(state);
        showNextTurn();
      }
    });
  }
  showAction(acts);
}

function handleOwnZoo(tile, zoo) {
  const p = state.players[state.current];
  if (zoo.level >= 3) {
    showModal('🛡️','무적 동물원',
      '<p style="text-align:center">이미 최고 등급입니다.</p>',
      [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
    return;
  }
  const cost = 2 + tile.tax;
  if (p.coins >= cost) {
    showAction([
      {
        text: `⬆️ 업그레이드 Lv.${zoo.level + 1} (${cost}코인)${zoo.level + 1 === 3 ? ' 🛡️무적!' : ''}`,
        class: 'action-btn btn-upgrade',
        action() {
          p.coins -= cost;
          zoo.level++;
          AudioMgr.playSfx('zooBuild');
          Render.renderZoos(state);
          Render.renderPlayers(state);
          Render.updateTurnInfo(state);
          showNextTurn();
        }
      },
      { text:'건너뛰기', class:'action-btn btn-skip', action(){ showNextTurn(); } },
    ]);
  } else {
    showNextTurn();
  }
}

// ===== JAIL =====
function handleJail() {
  const p = state.players[state.current];
  state.jailTurns[state.current] = 2;
  AudioMgr.playSfx('jail');
  const btns = [{
    text:'감옥에서 대기', class:'btn-fail',
    action(){ closeModal(); showNextTurn(); }
  }];
  if (p.coins >= JAIL_ESCAPE_COST) btns.unshift({
    text:`💰 ${JAIL_ESCAPE_COST}코인으로 탈출`, class:'btn-success',
    action(){
      p.coins -= JAIL_ESCAPE_COST;
      delete state.jailTurns[state.current];
      closeModal();
      Render.renderPlayers(state);
      Render.updateTurnInfo(state);
      showNextTurn();
    }
  });
  showModal('⛓️','감옥!',
    `<p style="text-align:center">2턴 정지 또는 ${JAIL_ESCAPE_COST}코인으로 즉시 탈출</p>`, btns);
}

function checkJailOnTurn() {
  const p = state.players[state.current];
  if (p.bankrupt) { nextTurn(); return; }

  if (state.jailTurns[state.current] !== undefined) {
    if (state.jailTurns[state.current] <= 0) {
      delete state.jailTurns[state.current];
      state.phase = 'roll';
      Render.updateTurnInfo(state);
    } else {
      state.jailTurns[state.current]--;
      if (p.coins >= JAIL_ESCAPE_COST) {
        showModal('⛓️','감옥',
          `<p style="text-align:center">${state.jailTurns[state.current]}턴 남음</p>`,
          [
            { text:`💰 ${JAIL_ESCAPE_COST}코인 탈출`, class:'btn-success', action(){
                p.coins -= JAIL_ESCAPE_COST;
                delete state.jailTurns[state.current];
                closeModal();
                Render.renderPlayers(state);
                Render.updateTurnInfo(state);
                state.phase = 'roll';
                Render.updateTurnInfo(state);
            }},
            { text:'대기', class:'btn-fail', action(){ closeModal(); showNextTurn(); } },
          ]);
      } else {
        showNextTurn();
      }
    }
  } else {
    state.phase = 'roll';
    Render.updateTurnInfo(state);
  }
}

// ===== TRAVEL =====
function handleTravel() {
  showTeleport();
}

function showTeleport() {
  const opts = TILES.filter(t => t.type === 'animal').map(t =>
    `<button class="pick-btn" onclick="teleportTo(${t.id})">${t.emoji} ${t.name}</button>`
  ).join('');
  showModal('✈️','세계 동물 여행',
    `<p style="text-align:center">이동할 칸을 선택하세요</p>
     <div class="pick-list">${opts}</div>`,
    [], false);
}

function teleportTo(id) {
  closeModal();
  state.players[state.current].position = id;
  Render.renderTokens(state);
  Render.highlightTile(id);
  setTimeout(() => handleLanding(), 400);
}
window.teleportTo = teleportTo;

// ===== GOLDEN KEY =====
function drawGoldenKey() {
  const p = state.players[state.current];
  const card = GOLDEN_KEYS[Math.floor(Math.random() * GOLDEN_KEYS.length)];
  AudioMgr.playSfx('goldenKey');
  const ch = `<div class="key-card">🔑 ${card.text}</div>`;

  switch (card.effect) {
    case 'coins':
      p.coins = Math.max(0, p.coins + card.value);
      AudioMgr.playSfx('coin');
      if (p.coins <= 0) checkBankrupt(state.current);
      Render.renderPlayers(state);
      Render.updateTurnInfo(state);
      showModal('🔑','생물 구조 열쇠', ch,
        [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
      break;
    case 'teleport':
      showModal('🔑','생물 구조 열쇠', ch,
        [{ text:'이동할 곳 선택', class:'btn-success', action(){ closeModal(); showTeleport(); } }]);
      break;
    case 'double_turn':
      state.doubleTurnNext.push(state.current);
      showModal('🔑','생물 구조 열쇠', ch,
        [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
      break;
    case 'steal':    showZooPick('steal', ch); break;
    case 'close':    showZooPick('close', ch); break;
    case 'swap':     showZooPick('swap', ch); break;
    case 'free_zoo': showFreeZooPick(ch); break;
  }
}

function showZooPick(action, ch) {
  const zoos = Object.entries(state.zoos)
    .filter(([, z]) => z.owner !== state.current && z.level < 3)
    .map(([tid, z]) => {
      const t = TILES[+tid], o = state.players[z.owner];
      return `<button class="pick-btn" style="background:${o.color}" onclick="zooAction('${action}',${tid})">${t.emoji} ${t.name} (${o.name})</button>`;
    });
  if (!zoos.length) {
    showModal('🔑','생물 구조 열쇠',
      `${ch}<p style="text-align:center">대상 동물원이 없습니다.</p>`,
      [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
    return;
  }
  const lb = action === 'steal' ? '가로챌' : action === 'close' ? '폐쇄할' : '교체할';
  showModal('🔑','생물 구조 열쇠',
    `${ch}<p style="text-align:center">${lb} 동물원 선택:</p><div class="pick-list">${zoos.join('')}</div>`,
    [], false);
}

function zooAction(action, tid) {
  closeModal();
  const p = state.players[state.current];
  const t = TILES[tid], z = state.zoos[tid];
  if (!z) { showNextTurn(); return; }
  if (action === 'steal') {
    z.owner = state.current;
    AudioMgr.playSfx('zooBuild');
  } else if (action === 'close') {
    delete state.zoos[tid];
  } else if (action === 'swap') {
    showSwapPick(tid); return;
  }
  Render.renderZoos(state);
  Render.renderPlayers(state);
  showNextTurn();
}
window.zooAction = zooAction;

function showSwapPick(targetId) {
  const my = Object.entries(state.zoos)
    .filter(([, z]) => z.owner === state.current)
    .map(([tid]) =>
      `<button class="pick-btn" style="background:#2196f3" onclick="doSwap(${targetId},${tid})">${TILES[+tid].emoji} ${TILES[+tid].name}</button>`
    );
  if (!my.length) { showNextTurn(); return; }
  showModal('🔄','교체할 내 동물원',
    `<div class="pick-list">${my.join('')}</div>`, [], false);
}

function doSwap(a, b) {
  closeModal();
  const za = state.zoos[a], zb = state.zoos[b];
  const tmp = za.owner; za.owner = zb.owner; zb.owner = tmp;
  AudioMgr.playSfx('zooBuild');
  Render.renderZoos(state);
  Render.renderPlayers(state);
  showNextTurn();
}
window.doSwap = doSwap;

function showFreeZooPick(ch) {
  const empty = TILES.filter(t => t.type === 'animal' && !state.zoos[t.id])
    .map(t => `<button class="pick-btn" style="background:#4caf50" onclick="freeBuild(${t.id})">${t.emoji} ${t.name}</button>`);
  if (!empty.length) {
    showModal('🔑','생물 구조 열쇠',
      `${ch}<p style="text-align:center">빈 칸이 없습니다.</p>`,
      [{ text:'확인', class:'btn-close-modal', action(){ closeModal(); showNextTurn(); } }]);
    return;
  }
  showModal('🔑','무상 건설',
    `${ch}<p style="text-align:center">건설할 칸을 선택하세요</p><div class="pick-list">${empty.join('')}</div>`,
    [], false);
}

function freeBuild(id) {
  closeModal();
  state.zoos[id] = { owner: state.current, level: 1 };
  AudioMgr.playSfx('zooBuild');
  Render.renderZoos(state);
  Render.renderPlayers(state);
  showNextTurn();
}
window.freeBuild = freeBuild;

// ===== BANKRUPT =====
function checkBankrupt(idx) {
  const p = state.players[idx];
  if (p.coins <= 0) {
    p.bankrupt = true; p.coins = 0;
    Object.keys(state.zoos).forEach(t => {
      if (state.zoos[t].owner === idx) delete state.zoos[t];
    });
    Render.renderZoos(state);
    Render.renderPlayers(state);
    const alive = state.players.filter(p => !p.bankrupt);
    if (alive.length <= 1) {
      state.phase = 'ended';
      const winner = alive[0];
      showModal('🏆','게임 종료!',
        `<div style="text-align:center;font-size:1.6em;margin:20px 0;color:${winner?.color || '#fff'}">
          ${PLAYER_AVATARS[state.players.indexOf(winner)] || ''} ${winner?.name || '???'} 우승! 🎉
         </div>`,
        [{ text:'새 게임', class:'btn-success', action(){ closeModal(); location.reload(); } }]);
    }
  }
}

// ===== TURNS =====
function showNextTurn() {
  state.phase = 'action';
  showAction([{ text:'➡️ 다음 턴', class:'action-btn btn-next', action(){ nextTurn(); } }]);
}

function showAction(acts) {
  const box = document.getElementById('action-box');
  if (!box) {
    console.error('[bio] action-box not found in DOM');
    return;
  }
  console.log('[bio] showAction', acts.map(a => a.text));
  box.innerHTML = '';
  acts.forEach(a => {
    const b = document.createElement('button');
    b.className = a.class;
    b.textContent = a.text;
    b.onclick = () => {
      box.innerHTML = '';
      try { a.action(); }
      catch (e) { console.error('[bio] action error:', e); }
    };
    box.appendChild(b);
  });
}

function nextTurn() {
  const ab = document.getElementById('action-box');
  if (ab) ab.innerHTML = '';
  Render.highlightTile(-1);

  const di = state.doubleTurnNext.indexOf(state.current);
  if (di !== -1) {
    state.doubleTurnNext.splice(di, 1);
    state.phase = 'roll';
    Render.updateTurnInfo(state);
    return;
  }
  let next = (state.current + 1) % state.players.length, s = 0;
  while (state.players[next].bankrupt && s < state.players.length) {
    next = (next + 1) % state.players.length; s++;
  }
  state.current = next;
  state.phase = 'roll';
  Render.renderPlayers(state);
  Render.updateTurnInfo(state);
  checkJailOnTurn();
}

// ===== MODAL =====
function showModal(emoji, title, content, buttons = []) {
  const m = document.getElementById('modal');
  const o = document.getElementById('modal-overlay');
  m.innerHTML =
    `<div class="modal-emoji">${emoji}</div>
     <h2>${title}</h2>
     ${content}
     <div class="modal-buttons" id="modal-buttons"></div>`;
  const btnBox = document.getElementById('modal-buttons');
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = b.class;
    btn.textContent = b.text;
    btn.onclick = b.action;
    btnBox.appendChild(btn);
  });
  o.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// Expose to window for inline handlers & bootstrap
window.updatePlayerInputs = updatePlayerInputs;
window.startGame = startGame;
