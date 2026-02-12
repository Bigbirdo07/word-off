"use client";

import React from "react";
import { Player } from "../hooks/useAuth";

type Mode = "sprint" | "ranked" | "daily" | "endless";

interface SidebarProps {
    mode: Mode;
    setMode: (mode: Mode) => void;
    view: "home" | "daily" | "leaderboard" | "profile";
    setView: (view: "home" | "daily" | "leaderboard" | "profile") => void;
    player: Player | null;
    onOpenAuth: () => void;
    onLogout?: () => void;
}

export function Sidebar({ mode, setMode, view, setView, player, onOpenAuth, onLogout }: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-card">
                <p className="label">Game Modes</p>
                <button
                    className={`mode-button ${mode === "sprint" && view === "home" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => { setMode("sprint"); setView("home"); }}
                >
                    <span className="mode-title">Definition Sprint</span>
                    <span className="mode-subtitle">60s rapid-fire</span>
                </button>
                <button
                    className={`mode-button ${mode === "ranked" && view === "home" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => { setMode("ranked"); setView("home"); }}
                >
                    <span className="mode-title">Ranked Duels</span>
                    <span className="mode-subtitle">Head-to-head online</span>
                </button>
                <button
                    className={`mode-button ${mode === "daily" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => { setMode("daily"); setView("daily"); }}
                >
                    <span className="mode-title">Daily Challenge</span>
                    <span className="mode-subtitle">Same 3 words for everyone</span>
                </button>
                <button
                    className={`mode-button ${mode === "endless" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => { setMode("endless"); setView("home"); }}
                >
                    <span className="mode-title">Endless Mode</span>
                    <span className="mode-subtitle">No timer, 15 words practice</span>
                </button>
                <button
                    className={`mode-button ${view === "leaderboard" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setView("leaderboard")}
                >
                    <span className="mode-title">Leaderboard</span>
                    <span className="mode-subtitle">Top 200 Players</span>
                </button>
            </div>

            <div className="sidebar-card">
                <p className="label">Player Profile</p>
                <p className="profile-name">
                    <span id="player-name">{player ? player.username : "Guest"}</span>
                </p>
                <p className="profile-tier">
                    <span id="rank-tier">{player ? player.rank_tier : "No Rank"}</span>
                </p>
                <div className="rank-meter">
                    <div
                        className="rank-meter-bar"
                        id="rank-meter-bar"
                        style={{ width: `${player ? Math.max(2, player.rank_points % 100) : 0}%` }}
                    ></div>
                </div>
                <div className="rank-meta">
                    <span id="rank-points">{player ? player.rank_points : 0}</span>
                    <span> / </span>
                    <span id="rank-division">100</span>
                    <span> RP</span>
                </div>

                {!player ? (
                    <div className="profile-actions">
                        <button
                            id="claim-name"
                            className="primary"
                            type="button"
                            onClick={onOpenAuth}
                        >
                            Login / Claim Name
                        </button>
                    </div>
                ) : (
                    <div className="profile-actions">
                        <p className="sidebar-note">Logged in as {player.username}</p>
                        {onLogout && (
                            <button
                                className="ghost"
                                type="button"
                                onClick={onLogout}
                                style={{ marginTop: "8px", fontSize: "13px" }}
                            >
                                Logout
                            </button>
                        )}
                    </div>
                )}

                <p className="sidebar-note">
                    Ranked duels are online.
                </p>
            </div>
        </aside>
    );
}
