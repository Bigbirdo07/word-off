"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LeaderboardProps {
    onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaders() {
            const { data, error } = await supabase
                .from("players")
                .select("username, rank_tier, rank_points")
                .order("rank_points", { ascending: false })
                .limit(200);

            if (data) {
                setLeaders(data);
            }
            setLoading(false);
        }

        fetchLeaders();
    }, []);

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">Global Rankings</p>
                        <h1>Leaderboard</h1>
                    </div>
                </div>
                <div className="meta">
                    <button className="secondary" onClick={onBack}>
                        Back
                    </button>
                </div>
            </header>

            <div className="card" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {loading ? (
                    <p>Loading ranking data...</p>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                <th style={{ textAlign: "left", padding: "8px" }}>Rank</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>Player</th>
                                <th style={{ textAlign: "left", padding: "8px" }}>Tier</th>
                                <th style={{ textAlign: "right", padding: "8px" }}>RP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaders.map((p, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--surface-2)" }}>
                                    <td style={{ padding: "8px" }}>{i + 1}</td>
                                    <td style={{ padding: "8px", fontWeight: "bold" }}>{p.username}</td>
                                    <td style={{ padding: "8px" }}>{p.rank_tier}</td>
                                    <td style={{ padding: "8px", textAlign: "right" }}>{p.rank_points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
