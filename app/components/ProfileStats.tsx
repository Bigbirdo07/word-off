"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "../hooks/useAuth";

interface ProfileStatsProps {
    player: Player | null; // Allow null
    onBack: () => void;
}

export function ProfileStats({ player, onBack }: ProfileStatsProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            if (!player) return;
            const { data, error } = await supabase
                .from("match_history")
                .select("*")
                .eq("player_id", player.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (data) setHistory(data);
            setLoading(false);
        }

        if (player) fetchHistory();
    }, [player]);

    if (!player) {
        return (
            <section className="main-panel match-layout">
                <header className="hero">
                    <div className="brand">
                        <div className="logo">WO</div>
                        <div>
                            <p className="eyebrow">Player Profile</p>
                            <h1>Guest</h1>
                        </div>
                    </div>
                    <div className="meta">
                        <button className="secondary" onClick={onBack}>Back</button>
                    </div>
                </header>
                <div className="card">
                    <p>Please log in to view your profile statistics.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">Player Profile</p>
                        <h1>{player.username}</h1>
                    </div>
                </div>
                <div className="meta">
                    <button className="secondary" onClick={onBack}>
                        Back
                    </button>
                </div>
            </header>

            <section className="card">
                <div className="definition">
                    <p className="label">Current Status</p>
                    <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
                        <div>
                            <h3 style={{ fontSize: "2rem", margin: 0 }}>{player.rank_tier}</h3>
                            <p style={{ opacity: 0.6 }}>Rank Tier</p>
                        </div>
                        <div>
                            <h3 style={{ fontSize: "2rem", margin: 0 }}>{player.rank_points}</h3>
                            <p style={{ opacity: 0.6 }}>Rank Points</p>
                        </div>
                        <div>
                            <h3 style={{ fontSize: "2rem", margin: 0 }}>{player.login_streak || 1} 🔥</h3>
                            <p style={{ opacity: 0.6 }}>Day Streak</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card">
                <h3 style={{ marginBottom: "16px" }}>Recent Matches</h3>
                {loading ? <p>Loading history...</p> : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {history.map((match) => (
                            <li key={match.id} style={{
                                borderBottom: "1px solid var(--surface-2)",
                                padding: "12px 0",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <div>
                                    <span style={{
                                        fontWeight: "bold",
                                        color: match.result === "win" ? "var(--accent-primary)" : "inherit"
                                    }}>
                                        {match.result.toUpperCase()}
                                    </span>
                                    <span style={{ marginLeft: "10px", opacity: 0.8 }}>
                                        vs {match.opponent_name}
                                    </span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <span style={{ fontWeight: "bold" }}>{match.score} pts</span>
                                    <span style={{
                                        marginLeft: "10px",
                                        color: match.rp_change > 0 ? "var(--accent-primary)" : "var(--accent-deep)"
                                    }}>
                                        {match.rp_change > 0 ? "+" : ""}{match.rp_change} RP
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </section>
    );
}
