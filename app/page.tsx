"use client";

import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { AuthModal } from "./components/AuthModal";
import { MatchView } from "./components/MatchView";
import { DailyView } from "./components/DailyView";
import { Leaderboard } from "./components/Leaderboard";
import { ProfileStats } from "./components/ProfileStats";
import { SprintView } from "./components/SprintView";
import { EndlessView } from "./components/EndlessView";
import { useAuth } from "./hooks/useAuth";
import { useMatchmaking } from "./hooks/useMatchmaking";
import { WORDS } from "./data/words";

type Mode = "sprint" | "ranked" | "daily" | "endless";

export default function Home() {
  const [mode, setMode] = useState<Mode>("sprint");
  const [view, setView] = useState<"home" | "daily" | "leaderboard" | "profile">("home");
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const { player, login, register, refreshPlayer } = useAuth();

  // Matchmaking Hook
  const { status: matchStatus, matchData: socketMatchData, joinQueue, socket } = useMatchmaking(player);

  // Local Match State
  const [localMatchData, setLocalMatchData] = useState<any>(null);
  const [isLocalPlaying, setIsLocalPlaying] = useState(false);
  const [isEndlessPlaying, setIsEndlessPlaying] = useState(false);

  const startLocalSprint = () => {
    // Pick 20 random words
    const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);

    setLocalMatchData({
      roomId: "local",
      words: selected,
      opponent: null // Single player
    });
    setIsLocalPlaying(true);
  };

  const handleRankedClick = () => {
    if (!player) {
      setAuthModalOpen(true);
    } else {
      joinQueue();
    }
  };

  if (isLocalPlaying) {
    return (
      <SprintView
        onExit={() => {
          setIsLocalPlaying(false);
          window.location.reload();
        }}
        player={player}
      />
    );
  }

  if (isEndlessPlaying) {
    return (
      <EndlessView
        onExit={() => {
          setIsEndlessPlaying(false);
          window.location.reload();
        }}
        player={player}
        onUpdatePlayer={refreshPlayer}
      />
    );
  }

  // If in a match (Socket only), render MatchView
  if (matchStatus === "playing" || matchStatus === "found") {
    return (
      <MatchView
        socket={socket}
        matchData={socketMatchData}
        onExit={() => window.location.reload()} // Simple exit for now
        player={player}
      />
    );
  }

  if (view === "daily") {
    return (
      <DailyView
        socket={socket}
        onExit={() => setView("home")}
        player={player}
        onUpdatePlayer={refreshPlayer}
      />
    );
  }

  if (view === "leaderboard") {
    return (
      <Leaderboard
        onBack={() => setView("home")}
      />
    );
  }

  if (view === "profile") {
    return (
      <ProfileStats
        player={player}
        onBack={() => setView("home")}
      />
    );
  }

  return (
    <main className="app layout">
      <Sidebar
        mode={mode}
        setMode={setMode}
        view={view}
        setView={setView}
        player={player}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <section className="main-panel">
        <header className="hero">
          <div className="brand">
            <div className="logo">WO</div>
            <div>
              <p className="eyebrow">Definition Sprint</p>
              <h1>WordOff</h1>
            </div>
          </div>
        </header>

        {mode !== "ranked" && mode !== "daily" && (
          <>
            <section className="card">
              <div className="definition">
                <p className="label">Definition</p>
                <p id="definition" className="definition-text">
                  Press start to begin.
                </p>
              </div>
              <div className="hint">
                <p className="label">Hint</p>
                <p id="hint" className="hint-text">
                  _ _ _ _ _
                </p>
              </div>
            </section>

            <section className="controls">
              <div className="attempts">
                <p className="label">Attempts</p>
                <div className="attempts-row">
                  <div
                    id="attempts"
                    className="attempt-dots"
                    aria-live="polite"
                  ></div>
                  <button
                    id="daily-hint"
                    className="hint-button hidden"
                    type="button"
                  >
                    Hint 1/3
                  </button>
                </div>
              </div>

              <form id="guess-form" className="guess-form" autoComplete="off">
                <input
                  id="guess-input"
                  type="text"
                  placeholder="Type your guess..."
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Guess the word"
                  disabled
                />
                <button id="submit-button" type="submit" disabled>
                  Submit
                </button>
              </form>
            </section>
          </>
        )}

        {mode === "ranked" && (
          <section id="ranked-panel" className="ranked-panel">
            <div className="ranked-card">
              <div>
                <p className="label">Ranked Duels</p>
                <p className="ranked-title">Matchmaking</p>
                <p className="ranked-subtitle">
                  Enter queue to start a 60s rapid-fire duel.
                </p>
              </div>
              <div className="ranked-meta">
                <div className="ranked-meta-item">
                  <span className="label">Your Rank</span>
                  <span id="ranked-tier" className="ranked-value">
                    {player ? player.rank_tier : "Unranked"}
                  </span>
                </div>
                <div className="ranked-meta-item">
                  <span className="label">Opponent</span>
                  <span id="ranked-opponent" className="ranked-value">
                    {matchStatus === "searching" ? "Searching..." : "Waiting..."}
                  </span>
                </div>
                <div className="ranked-meta-item">
                  <span className="label">Queue</span>
                  <span id="ranked-queue-status" className="ranked-value">
                    {matchStatus === "searching" ? "Active" : "Idle"}
                  </span>
                </div>
              </div>
              <div className="ranked-actions">
                <button
                  id="ranked-queue"
                  className="primary"
                  type="button"
                  onClick={handleRankedClick}
                  disabled={matchStatus === "searching"}
                >
                  {matchStatus === "searching" ? "Finding Opponent..." : "Enter Match Queue"}
                </button>
                <button
                  id="ranked-cancel"
                  className="ghost"
                  type="button"
                  disabled
                >
                  Cancel Queue
                </button>
              </div>
            </div>

            <div className="ranked-card">
              <div>
                <p className="label">Private Lobby</p>
                <p className="ranked-title">Play with friends</p>
                <p className="ranked-subtitle">
                  Create or join with a lobby code.
                </p>
              </div>
              <div className="lobby-row">
                <input
                  id="lobby-code"
                  className="lobby-input"
                  type="text"
                  placeholder="Enter code"
                  maxLength={6}
                />
                <button id="lobby-join" className="ghost" type="button">
                  Join
                </button>
              </div>
              <div className="ranked-actions">
                <button id="lobby-create" className="primary" type="button">
                  Create Lobby
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === "daily" && (
          <section id="daily-panel" className="ranked-panel">
            <div className="ranked-card">
              <div>
                <p className="label">Daily Challenge</p>
                <p className="ranked-title">3 shared words, no timer</p>
                <p className="ranked-subtitle">
                  Everyone gets the same words for the day.
                </p>
              </div>
              <div className="ranked-meta">
                <div className="ranked-meta-item">
                  <span className="label">Today</span>
                  <span id="daily-date" className="ranked-value">
                    ---
                  </span>
                </div>
                <div className="ranked-meta-item">
                  <span className="label">Progress</span>
                  <span id="daily-progress" className="ranked-value">
                    0 / 3
                  </span>
                </div>
              </div>
              <div className="ranked-actions">
                <button id="daily-start" className="primary" type="button" onClick={() => setView("daily")}>
                  Start Daily Challenge
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === "sprint" && (
          <section className="actions">
            <button id="start-button" className="primary" onClick={startLocalSprint}>
              Start 60s Round
            </button>
            <button id="reset-button" className="ghost" disabled>
              Reset
            </button>
          </section>
        )}

        {mode === "endless" && (
          <section className="actions">
            <button id="start-endless" className="primary" onClick={() => setIsEndlessPlaying(true)}>
              Start Endless Run
            </button>
          </section>
        )}

        <section className="status">
          <p id="status" className="status-text">
            Hints reveal a new letter every 7 seconds.
          </p>
        </section>

        <section className="tracker">
          <div className="tracker-header">
            <p className="label">Tracker</p>
            <p id="latest-result" className="latest-result">
              No words yet.
            </p>
          </div>
          <ul id="history-list" className="history-list" aria-live="polite"></ul>
        </section>

        <section className="feedback-section">
          <div className="feedback-card">
            <div className="feedback-icon">💬</div>
            <h2 className="feedback-title">We Want to Hear From You!</h2>
            <p className="feedback-message">
              Provide us feedback on what you want to see! Our hope is to give back to the
              community and provide a fun and interesting way to learn words and enforce learning.
              We want to host tournaments of various ranks. Thank you so much and don&apos;t be
              scared to reach out!
            </p>
            <a href="mailto:wordoffoffical@gmail.com" className="feedback-email-link">
              <span className="feedback-email-icon">✉️</span>
              wordoffoffical@gmail.com
            </a>
            <a
              href="https://ko-fi.com/wordoff"
              target="_blank"
              rel="noopener noreferrer"
              className="kofi-button"
            >
              ☕ Buy Us a Coffee
            </a>
            <div className="feedback-tags">
              <span className="feedback-tag">🏆 Tournaments Coming Soon</span>
              <span className="feedback-tag">📚 Learn New Words</span>
              <span className="feedback-tag">🤝 Community Driven</span>
            </div>
          </div>
        </section>

        {/* Ad placement — non-intrusive, below content */}
        <div className="ad-container">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot="XXXXXXXXXX"
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>

        <footer className="footer">
          <p>
            Made with ❤️ by the WordOff team.
          </p>
        </footer>
      </section>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => { }}
        login={login}
        register={register}
      />
    </main>
  );
}
