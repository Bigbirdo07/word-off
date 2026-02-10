const MATCH_SECONDS = 60;
const HINT_INTERVAL_MS = 7000;
const MAX_ATTEMPTS = 3;

const elements = {
  timeLeft: document.getElementById("time-left"),
  score: document.getElementById("score"),
  opponentName: document.getElementById("opponent-name"),
  opponentScore: document.getElementById("opponent-score"),
  lobbyPill: document.getElementById("lobby-pill"),
  lobbyCodeLabel: document.getElementById("lobby-code-label"),
  definition: document.getElementById("definition"),
  hint: document.getElementById("hint"),
  attempts: document.getElementById("attempts"),
  status: document.getElementById("status"),
  form: document.getElementById("guess-form"),
  input: document.getElementById("guess-input"),
  submit: document.getElementById("submit-button"),
  leave: document.getElementById("leave-button"),
};

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
];

const dictionary = Array.isArray(window.WORDS) && window.WORDS.length
  ? window.WORDS
  : fallbackWords;

const game = {
  words: [],
  current: null,
  attemptsLeft: MAX_ATTEMPTS,
  score: 0,
  opponentScore: 0,
  revealed: new Set(),
  roundEnd: null,
  timerId: null,
  hintId: null,
  opponentId: null,
};

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
    : "Match over.";
}

function updateTimer() {
  if (!game.roundEnd) return;
  const remaining = Math.max(0, game.roundEnd - Date.now());
  elements.timeLeft.textContent = Math.ceil(remaining / 1000).toString();
  if (remaining <= 0) {
    endMatch();
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
    game.words = shuffle(dictionary);
  }
  game.current = game.words.pop();
  game.attemptsLeft = MAX_ATTEMPTS;
  game.revealed = new Set();
  updateDefinition();
  updateHintDisplay();
  renderAttempts();
  startHintTimer();
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
    elements.score.textContent = String(game.score);
    startWord();
    return;
  }

  game.attemptsLeft -= 1;
  renderAttempts();

  if (game.attemptsLeft <= 0) {
    startWord();
  }
}

function startMatch() {
  game.words = shuffle(dictionary);
  game.score = 0;
  game.opponentScore = 0;
  game.roundEnd = Date.now() + MATCH_SECONDS * 1000;
  elements.score.textContent = "0";
  elements.opponentScore.textContent = "0";
  elements.timeLeft.textContent = String(MATCH_SECONDS);

  clearInterval(game.timerId);
  game.timerId = setInterval(updateTimer, 200);
  startOpponentSim();

  startWord();
}

function endMatch() {
  clearInterval(game.timerId);
  stopHintTimer();
  stopOpponentSim();
  game.roundEnd = null;

  elements.input.disabled = true;
  elements.submit.disabled = true;
  elements.status.textContent = `Time! You scored ${game.score}. Opponent scored ${game.opponentScore}.`;
}

function initOpponent() {
  const params = new URLSearchParams(window.location.search);
  const opponent = params.get("opponent") || "Opponent";
  const lobby = params.get("lobby");
  elements.opponentName.textContent = opponent;
  if (lobby) {
    elements.lobbyPill.classList.remove("hidden");
    elements.lobbyCodeLabel.textContent = lobby;
  }
}

function startOpponentSim() {
  clearInterval(game.opponentId);
  game.opponentId = setInterval(() => {
    if (!game.roundEnd) return;
    const roll = Math.random();
    if (roll < 0.35) {
      game.opponentScore += 1;
      elements.opponentScore.textContent = String(game.opponentScore);
    }
  }, 1200);
}

function stopOpponentSim() {
  clearInterval(game.opponentId);
  game.opponentId = null;
}

renderAttempts();
initOpponent();
startMatch();

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleGuess(elements.input.value);
});

elements.leave.addEventListener("click", () => {
  window.location.href = "index.html";
});

window.addEventListener("beforeunload", () => {
  clearInterval(game.timerId);
  stopHintTimer();
  stopOpponentSim();
});
