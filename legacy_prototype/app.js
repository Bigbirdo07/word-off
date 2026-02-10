const DEFAULT_SPRINT_SECONDS = 60;
const RANKED_SECONDS = 60;
const DAILY_WORDS_COUNT = 3;
const HINT_INTERVAL_MS = 7000;
const MAX_ATTEMPTS = 3;
const MAX_HISTORY = 12;
const QUEUE_DELAY_MS = 2000;

const elements = {
  timeLeft: document.getElementById("time-left"),
  score: document.getElementById("score"),
  wordCount: document.getElementById("word-count"),
  definition: document.getElementById("definition"),
  hint: document.getElementById("hint"),
  attempts: document.getElementById("attempts"),
  status: document.getElementById("status"),
  latestResult: document.getElementById("latest-result"),
  historyList: document.getElementById("history-list"),
  playerName: document.getElementById("player-name"),
  rankTier: document.getElementById("rank-tier"),
  rankPoints: document.getElementById("rank-points"),
  rankDivision: document.getElementById("rank-division"),
  rankMeterBar: document.getElementById("rank-meter-bar"),
  randomName: document.getElementById("random-name"),
  setPassword: document.getElementById("set-password"),
  rankedPanel: document.getElementById("ranked-panel"),
  rankedTier: document.getElementById("ranked-tier"),
  rankedOpponent: document.getElementById("ranked-opponent"),
  rankedQueueStatus: document.getElementById("ranked-queue-status"),
  rankedQueue: document.getElementById("ranked-queue"),
  rankedCancel: document.getElementById("ranked-cancel"),
  lobbyCode: document.getElementById("lobby-code"),
  lobbyJoin: document.getElementById("lobby-join"),
  lobbyCreate: document.getElementById("lobby-create"),
  dailyPanel: document.getElementById("daily-panel"),
  dailyDate: document.getElementById("daily-date"),
  dailyProgress: document.getElementById("daily-progress"),
  dailyStart: document.getElementById("daily-start"),
  dailyHint: document.getElementById("daily-hint"),
  claimModal: document.getElementById("claim-modal"),
  claimForm: document.getElementById("claim-form"),
  claimName: document.getElementById("claim-name"),
  claimPassword: document.getElementById("claim-password"),
  claimCancel: document.getElementById("claim-cancel"),
  form: document.getElementById("guess-form"),
  input: document.getElementById("guess-input"),
  submit: document.getElementById("submit-button"),
  start: document.getElementById("start-button"),
  reset: document.getElementById("reset-button"),
};

const game = {
  words: [],
  current: null,
  attemptsLeft: MAX_ATTEMPTS,
  score: 0,
  total: 0,
  revealed: new Set(),
  roundEnd: null,
  timerId: null,
  hintId: null,
  queueId: null,
  mode: "sprint",
  roundSeconds: DEFAULT_SPRINT_SECONDS,
  dailyWords: [],
  dailyHintStep: 0,
  history: [],
};

const RANKS = [
  { name: "Lead I", points: 0 },
  { name: "Lead II", points: 100 },
  { name: "Lead III", points: 200 },
  { name: "Wood", points: 300 },
  { name: "Pencil I", points: 400 },
  { name: "Pencil II", points: 500 },
  { name: "Pencil III", points: 600 },
  { name: "Mechanical Pencil I", points: 700 },
  { name: "Mechanical Pencil II", points: 800 },
  { name: "Mechanical Pencil III", points: 900 },
  { name: "Pen I", points: 1000 },
  { name: "Pen II", points: 1100 },
  { name: "Pen III", points: 1200 },
  { name: "Fountain Pen I", points: 1300 },
  { name: "Fountain Pen II", points: 1400 },
  { name: "Fountain Pen III", points: 1500 },
  { name: "Quill Pen I", points: 1600 },
  { name: "Quill Pen II", points: 1700 },
  { name: "Quill Pen III", points: 1800 },
];

const NAME_PARTS = [
  "Iron",
  "Silver",
  "Copper",
  "Shadow",
  "Ember",
  "Sable",
  "Lumen",
  "Wisp",
  "Quill",
  "Atlas",
  "Hollow",
  "Echo",
  "Nova",
  "Fable",
  "Rift",
  "Harbor",
  "Gild",
  "Rune",
];

const NAME_SUFFIXES = [
  "Wisp",
  "Cipher",
  "Fox",
  "Ink",
  "Scribe",
  "Vale",
  "Ash",
  "Bloom",
  "Dusk",
  "Rune",
  "Quill",
  "Gale",
];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateName() {
  return `${randomFrom(NAME_PARTS)}${randomFrom(NAME_SUFFIXES)}`;
}

function generateLobbyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function loadPlayer() {
  const savedName = localStorage.getItem("wordoff-name");
  const savedPoints = Number(localStorage.getItem("wordoff-rank-points"));
  return {
    name: savedName || generateName(),
    points: Number.isFinite(savedPoints) ? savedPoints : 140,
  };
}

function savePlayer(player) {
  localStorage.setItem("wordoff-name", player.name);
  localStorage.setItem("wordoff-rank-points", String(player.points));
}

const player = loadPlayer();

let pendingMode = null;

function isClaimed() {
  return localStorage.getItem("wordoff-claimed") === "true";
}

function openClaimModal() {
  elements.claimName.value = player.name;
  elements.claimPassword.value = "";
  elements.claimModal.classList.remove("hidden");
  elements.claimName.focus();
}

function closeClaimModal() {
  elements.claimModal.classList.add("hidden");
}

function updateRankUI() {
  const current = [...RANKS].reverse().find((rank) => player.points >= rank.points) || RANKS[0];
  const currentIndex = RANKS.indexOf(current);
  const next = RANKS[currentIndex + 1];
  const divisionBase = current.points;
  const divisionCap = next ? next.points : current.points + 100;
  const divisionProgress = Math.min(100, Math.max(0, player.points - divisionBase));
  const meterPercent = Math.round((divisionProgress / (divisionCap - divisionBase)) * 100);

  elements.playerName.textContent = player.name;
  elements.rankTier.textContent = current.name;
  elements.rankPoints.textContent = String(player.points);
  elements.rankDivision.textContent = String(divisionCap - divisionBase);
  elements.rankMeterBar.style.width = `${meterPercent}%`;
  elements.rankedTier.textContent = current.name;

  if (isClaimed()) {
    elements.randomName.disabled = true;
  } else {
    elements.randomName.disabled = false;
  }
}

function formatDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dailySeed(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000000007;
  }
  return hash;
}

function getDailyWords() {
  const today = new Date();
  const key = formatDateKey(today);
  const seed = dailySeed(key);
  const total = dictionary.length;
  const startIndex = total > 0 ? seed % total : 0;
  const words = [];
  for (let i = 0; i < DAILY_WORDS_COUNT; i += 1) {
    words.push(dictionary[(startIndex + i) % total]);
  }
  elements.dailyDate.textContent = key;
  return words;
}

function updateDailyProgress() {
  if (!elements.dailyProgress) return;
  const completed = Math.min(game.total, DAILY_WORDS_COUNT);
  elements.dailyProgress.textContent = `${completed} / ${DAILY_WORDS_COUNT}`;
}

const fallbackWords = [
  {
    word: "atlas",
    definition: "A collection of maps or charts, often bound as a book.",
  },
  {
    word: "echo",
    definition: "A sound that is heard again after reflecting off a surface.",
  },
  {
    word: "ember",
    definition: "A small glowing fragment of burning wood or coal.",
  },
  {
    word: "fable",
    definition: "A short story that teaches a moral lesson, often with animals.",
  },
  {
    word: "glimmer",
    definition: "A faint or wavering light; a small sign of something.",
  },
  {
    word: "harbor",
    definition: "A sheltered body of water where ships can anchor safely.",
  },
  {
    word: "orbit",
    definition: "The curved path of an object around a star or planet.",
  },
  {
    word: "quartz",
    definition: "A hard mineral composed of silica, often used in jewelry.",
  },
  {
    word: "rift",
    definition: "A split or break in something; a large crack in rock.",
  },
  {
    word: "vault",
    definition: "An arched structure or a secure, enclosed room.",
  },
];

const dictionary = Array.isArray(window.WORDS) && window.WORDS.length
  ? window.WORDS
  : fallbackWords;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function isLetter(char) {
  return /[a-z]/i.test(char);
}

function buildHint(word, revealed) {
  return [...word].map((char, index) => {
    if (!isLetter(char)) {
      return char;
    }
    return revealed.has(index) ? char.toUpperCase() : "_";
  });
}

function renderAttempts() {
  elements.attempts.innerHTML = "";
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const dot = document.createElement("span");
    dot.className = "attempt-dot";
    if (i >= game.attemptsLeft) {
      dot.classList.add("is-used");
    }
    elements.attempts.appendChild(dot);
  }
}

function updateScoreboard() {
  elements.score.textContent = String(game.score);
  elements.wordCount.textContent = String(game.total);
  if (game.mode === "daily") {
    updateDailyProgress();
  }
}

function setStatus(message) {
  elements.status.textContent = message;
}

function updateHintDisplay() {
  if (!game.current) {
    elements.hint.textContent = "_ _ _ _ _";
    return;
  }
  const hint = buildHint(game.current.word, game.revealed);
  elements.hint.textContent = hint.join(" ");
}

function updateDefinition() {
  elements.definition.textContent = game.current
    ? game.current.definition
    : "Press start to begin.";
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  if (game.history.length === 0) {
    elements.latestResult.textContent = "No words yet.";
    return;
  }

  const latest = game.history[0];
  const reasonSuffix = latest.reason ? ` (${latest.reason})` : "";
  const latestLabel = latest.result === "correct" ? "Correct" : "Missed";
  elements.latestResult.textContent = `${latestLabel}: "${latest.word}".${reasonSuffix}`;

  game.history.slice(0, MAX_HISTORY).forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const copy = document.createElement("div");
    const word = document.createElement("div");
    word.className = "history-word";
    word.textContent = entry.word;

    const definition = document.createElement("div");
    definition.className = "history-definition";
    definition.textContent = entry.definition;

    copy.appendChild(word);
    copy.appendChild(definition);

    const badge = document.createElement("span");
    badge.className = `result-badge ${
      entry.result === "correct" ? "result-correct" : "result-missed"
    }`;
    badge.textContent = entry.result === "correct" ? "Correct" : "Missed";

    item.appendChild(copy);
    item.appendChild(badge);
    elements.historyList.appendChild(item);
  });
}

function addHistoryEntry(result, wordEntry, reason) {
  if (!wordEntry) return;
  game.history.unshift({
    result,
    word: wordEntry.word,
    definition: wordEntry.definition,
    reason,
  });
  if (game.history.length > MAX_HISTORY) {
    game.history = game.history.slice(0, MAX_HISTORY);
  }
  renderHistory();
}

function updateTimer() {
  if (!game.roundEnd) return;
  const remaining = Math.max(0, game.roundEnd - Date.now());
  elements.timeLeft.textContent = Math.ceil(remaining / 1000).toString();
  if (remaining <= 0) {
    endRound();
  }
}

function revealNextLetter() {
  if (!game.current) return;
  const word = game.current.word;
  for (let i = 0; i < word.length; i += 1) {
    if (isLetter(word[i]) && !game.revealed.has(i)) {
      game.revealed.add(i);
      updateHintDisplay();
      return;
    }
  }
}

function revealAllLetters() {
  if (!game.current) return;
  const word = game.current.word;
  for (let i = 0; i < word.length; i += 1) {
    if (isLetter(word[i])) {
      game.revealed.add(i);
    }
  }
  updateHintDisplay();
}

function startHintTimer() {
  clearInterval(game.hintId);
  game.hintId = setInterval(revealNextLetter, HINT_INTERVAL_MS);
}

function stopHintTimer() {
  clearInterval(game.hintId);
  game.hintId = null;
}

function startWord() {
  if (game.words.length === 0) {
    if (game.mode === "daily") {
      endDaily();
      return;
    }
    game.words = shuffle(dictionary);
  }
  game.current = game.words.pop();
  game.attemptsLeft = MAX_ATTEMPTS;
  game.revealed = new Set();
  game.dailyHintStep = 0;
  updateDefinition();
  renderAttempts();
  if (game.mode === "daily") {
    updateHintDisplay();
    updateDailyHintButton();
    setStatus("Daily hints: tap for first letter, then two random letters.");
  } else {
    updateHintDisplay();
    setStatus("New word loaded. Hints reveal every 7 seconds.");
    startHintTimer();
  }
  elements.input.value = "";
  elements.input.focus();
}

function handleGuess(value) {
  if (!game.current) return;
  const guess = normalize(value);
  if (!guess) return;

  const answer = normalize(game.current.word);
  if (guess === answer) {
    game.score += 1;
    game.total += 1;
    addHistoryEntry("correct", game.current);
    setStatus(`Correct! The word was \"${game.current.word}\".`);
    updateScoreboard();
    startWord();
    return;
  }

  game.attemptsLeft -= 1;
  renderAttempts();

  if (game.attemptsLeft <= 0) {
    game.total += 1;
    updateScoreboard();
    addHistoryEntry("missed", game.current, "out of tries");
    setStatus(`Out of tries. The word was \"${game.current.word}\".`);
    startWord();
    return;
  }

  setStatus(`Not quite. ${game.attemptsLeft} attempts left.`);
}

function startRound(options) {
  const seconds = options?.seconds ?? DEFAULT_SPRINT_SECONDS;
  const mode = options?.mode ?? "sprint";
  game.words = shuffle(dictionary);
  game.score = 0;
  game.total = 0;
  game.history = [];
  game.mode = mode;
  game.roundSeconds = seconds;
  game.roundEnd = Date.now() + seconds * 1000;

  updateScoreboard();
  elements.timeLeft.textContent = String(seconds);

  elements.input.disabled = false;
  elements.submit.disabled = false;
  elements.reset.disabled = false;
  elements.start.disabled = mode !== "sprint";

  clearInterval(game.timerId);
  game.timerId = setInterval(updateTimer, 200);

  startWord();
  renderHistory();
}

function startDailyRound() {
  game.words = getDailyWords().slice().reverse();
  game.dailyWords = [...game.words];
  game.score = 0;
  game.total = 0;
  game.history = [];
  game.mode = "daily";
  game.roundSeconds = null;
  game.roundEnd = null;
  game.dailyHintStep = 0;

  updateScoreboard();
  updateDailyProgress();
  elements.timeLeft.textContent = "—";
  elements.input.disabled = false;
  elements.submit.disabled = false;
  elements.reset.disabled = false;
  elements.start.disabled = true;

  clearInterval(game.timerId);
  stopHintTimer();

  startWord();
  renderHistory();
  setStatus("Daily challenge started. Tap hint for letters.");
}

function endRound() {
  if (!game.roundEnd) return;
  clearInterval(game.timerId);
  stopHintTimer();
  game.roundEnd = null;

  elements.input.disabled = true;
  elements.submit.disabled = true;
  elements.start.disabled = game.mode !== "sprint";

  if (game.current) {
    revealAllLetters();
    addHistoryEntry("missed", game.current, "time");
    setStatus(
      `Time! The word was \"${game.current.word}\". You solved ${game.score} word${
        game.score === 1 ? "" : "s"
      }.`
    );
  } else {
    setStatus(`Time! You solved ${game.score} word${game.score === 1 ? "" : "s"}.`);
  }
}

function endDaily() {
  stopHintTimer();
  game.roundEnd = null;
  elements.input.disabled = true;
  elements.submit.disabled = true;
  elements.start.disabled = true;
  updateDailyProgress();
  setStatus(
    `Daily complete! You solved ${game.score} of ${DAILY_WORDS_COUNT} words.`
  );
}

function resetRound() {
  clearInterval(game.timerId);
  stopHintTimer();
  game.roundEnd = null;
  game.score = 0;
  game.total = 0;
  game.current = null;
  game.words = [];
  game.revealed = new Set();
  game.history = [];
  game.dailyWords = [];
  game.dailyHintStep = 0;

  elements.input.disabled = true;
  elements.submit.disabled = true;
  elements.start.disabled = game.mode !== "sprint";
  elements.reset.disabled = true;
  elements.timeLeft.textContent = String(game.roundSeconds || DEFAULT_SPRINT_SECONDS);
  updateScoreboard();
  updateDefinition();
  updateHintDisplay();
  renderAttempts();
  setStatus("Hints reveal a new letter every 7 seconds.");
  renderHistory();
  updateDailyProgress();
}

renderAttempts();
updateScoreboard();
renderHistory();
updateRankUI();

if (!Array.isArray(window.WORDS)) {
  setStatus("Loaded fallback word list. Swap in your dictionary for full play.");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleGuess(elements.input.value);
});

elements.start.addEventListener("click", () => {
  startRound({ seconds: DEFAULT_SPRINT_SECONDS, mode: "sprint" });
});

elements.reset.addEventListener("click", resetRound);

elements.randomName.addEventListener("click", () => {
  if (isClaimed()) {
    window.alert("This name is locked. Create a new account to change it.");
    return;
  }
  player.name = generateName();
  savePlayer(player);
  updateRankUI();
});

elements.setPassword.addEventListener("click", () => {
  const password = window.prompt("Create a password to lock this name:");
  if (!password) return;
  localStorage.setItem("wordoff-password", password);
  localStorage.setItem("wordoff-claimed", "true");
  window.alert("Saved locally. Online accounts will come later.");
  updateRankUI();
});

  elements.rankedQueue.addEventListener("click", () => {
  elements.rankedQueue.disabled = true;
  elements.rankedCancel.disabled = false;
  elements.rankedQueueStatus.textContent = "Finding match...";
  elements.rankedOpponent.textContent = "Searching...";
  setStatus("Ranked queue started. Finding a match...");

  clearTimeout(game.queueId);
  game.queueId = setTimeout(() => {
    elements.rankedQueueStatus.textContent = "Match found";
    const opponentName = generateName();
    elements.rankedOpponent.textContent = opponentName;
    elements.rankedCancel.disabled = true;
    setStatus("Match found. Loading duel...");
    const params = new URLSearchParams({
      opponent: opponentName,
      you: player.name,
    });
    window.location.href = `match.html?${params.toString()}`;
  }, QUEUE_DELAY_MS);
});

elements.rankedCancel.addEventListener("click", () => {
  clearTimeout(game.queueId);
  game.queueId = null;
  elements.rankedQueue.disabled = false;
  elements.rankedCancel.disabled = true;
  elements.rankedQueueStatus.textContent = "Idle";
  elements.rankedOpponent.textContent = "Waiting...";
  setStatus("Queue canceled.");
});

elements.lobbyCreate.addEventListener("click", () => {
  const code = generateLobbyCode();
  elements.lobbyCode.value = code;
  setStatus(`Lobby created. Share code ${code}.`);
  const params = new URLSearchParams({
    lobby: code,
    mode: "private",
    opponent: "Friend",
    you: player.name,
  });
  window.location.href = `match.html?${params.toString()}`;
});

elements.lobbyJoin.addEventListener("click", () => {
  const code = elements.lobbyCode.value.trim().toUpperCase();
  if (!code || code.length < 4) {
    window.alert("Enter a valid lobby code.");
    return;
  }
  setStatus(`Joining lobby ${code}...`);
  const params = new URLSearchParams({
    lobby: code,
    mode: "private",
    opponent: "Friend",
    you: player.name,
  });
  window.location.href = `match.html?${params.toString()}`;
});

elements.dailyStart.addEventListener("click", () => {
  startDailyRound();
});

function updateDailyHintButton() {
  if (!elements.dailyHint) return;
  const isDaily = game.mode === "daily";
  elements.dailyHint.classList.toggle("hidden", !isDaily);
  if (!isDaily) return;
  if (game.dailyHintStep === 0) {
    elements.dailyHint.disabled = false;
    elements.dailyHint.textContent = "Hint 1/3";
  } else if (game.dailyHintStep === 1) {
    elements.dailyHint.disabled = false;
    elements.dailyHint.textContent = "Hint 2/3";
  } else if (game.dailyHintStep === 2) {
    elements.dailyHint.disabled = false;
    elements.dailyHint.textContent = "Hint 3/3";
  } else {
    elements.dailyHint.disabled = true;
    elements.dailyHint.textContent = "Hints Used";
  }
}

function applyDailyHintStep() {
  if (!game.current || game.mode !== "daily") return;
  const word = game.current.word;
  const letterIndices = [];
  for (let i = 0; i < word.length; i += 1) {
    if (isLetter(word[i])) {
      letterIndices.push(i);
    }
  }
  if (letterIndices.length === 0) return;

  if (game.dailyHintStep === 0) {
    game.revealed.add(letterIndices[0]);
    game.dailyHintStep = 1;
  } else if (game.dailyHintStep === 1) {
    const remaining = letterIndices.slice(1).filter((index) => !game.revealed.has(index));
    if (remaining.length > 0) {
      const randomIndex = remaining[Math.floor(Math.random() * remaining.length)];
      game.revealed.add(randomIndex);
    }
    game.dailyHintStep = 2;
  } else if (game.dailyHintStep === 2) {
    const remaining = letterIndices.slice(1).filter((index) => !game.revealed.has(index));
    if (remaining.length > 0) {
      const randomIndex = remaining[Math.floor(Math.random() * remaining.length)];
      game.revealed.add(randomIndex);
    }
    game.dailyHintStep = 3;
  }
  updateHintDisplay();
  updateDailyHintButton();
}

elements.dailyHint.addEventListener("click", () => {
  applyDailyHintStep();
});

elements.claimForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = normalize(elements.claimName.value).replace(/[^a-z0-9]/g, "");
  const password = elements.claimPassword.value.trim();
  if (!name || name.length < 3) {
    window.alert("Pick a username with at least 3 letters.");
    return;
  }
  if (password.length < 4) {
    window.alert("Password should be at least 4 characters.");
    return;
  }

  player.name = name;
  savePlayer(player);
  localStorage.setItem("wordoff-password", password);
  localStorage.setItem("wordoff-claimed", "true");
  updateRankUI();
  closeClaimModal();

  if (pendingMode === "ranked") {
    pendingMode = null;
    switchMode("ranked");
  }
});

elements.claimCancel.addEventListener("click", () => {
  closeClaimModal();
  pendingMode = null;
});

function switchMode(mode) {
  game.mode = mode;
  const modeButtons = document.querySelectorAll(".mode-button[data-mode]");
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  if (mode === "ranked") {
    elements.rankedPanel.classList.remove("hidden");
    elements.dailyPanel.classList.add("hidden");
    updateDailyHintButton();
    elements.start.disabled = true;
    elements.rankedQueue.disabled = false;
    elements.rankedCancel.disabled = true;
    elements.rankedQueueStatus.textContent = "Idle";
    elements.rankedOpponent.textContent = "Waiting...";
    setStatus("Ranked duels start a 60 second rapid-fire match.");
    game.roundSeconds = RANKED_SECONDS;
    elements.timeLeft.textContent = String(RANKED_SECONDS);
  } else if (mode === "daily") {
    clearTimeout(game.queueId);
    game.queueId = null;
    elements.rankedPanel.classList.add("hidden");
    elements.dailyPanel.classList.remove("hidden");
    elements.start.disabled = true;
    elements.rankedQueue.disabled = false;
    elements.rankedCancel.disabled = true;
    elements.rankedQueueStatus.textContent = "Idle";
    elements.rankedOpponent.textContent = "Waiting...";
    elements.timeLeft.textContent = "—";
    updateDailyProgress();
    getDailyWords();
    updateDailyHintButton();
    setStatus("Daily challenge: 3 shared words, no timer.");
  } else {
    clearTimeout(game.queueId);
    game.queueId = null;
    elements.rankedPanel.classList.add("hidden");
    elements.dailyPanel.classList.add("hidden");
    updateDailyHintButton();
    elements.start.disabled = false;
    setStatus("Hints reveal a new letter every 7 seconds.");
    game.roundSeconds = DEFAULT_SPRINT_SECONDS;
    elements.timeLeft.textContent = String(DEFAULT_SPRINT_SECONDS);
  }
}

document.querySelectorAll(".mode-button[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === "ranked" && !isClaimed()) {
      pendingMode = "ranked";
      openClaimModal();
      return;
    }
    switchMode(mode);
  });
});

window.addEventListener("beforeunload", () => {
  clearInterval(game.timerId);
  stopHintTimer();
});
