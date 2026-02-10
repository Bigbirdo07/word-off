"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Player {
    id: string;
    rank_tier: string;
    rank_points: number;
    username: string;
    words_solved: number;
    last_login?: string;
    login_streak?: number;
}

export function useAuth() {
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);

    // Check for existing session or local storage on mount
    useEffect(() => {
        const storedId = localStorage.getItem("wordoff-player-id");
        if (storedId) {
            fetchPlayer(storedId);
        } else {
            setLoading(false);
        }
    }, []);

    async function fetchPlayer(id: string) {
        try {
            const { data, error } = await supabase
                .from("players")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            if (data) {
                // Should we check streak on auto-login? Yes.
                const updatedPlayer = await checkStreak(data);
                setPlayer(updatedPlayer);
                localStorage.setItem("wordoff-player-id", data.id);
            }
        } catch (err) {
            console.error("Error fetching player:", err);
            localStorage.removeItem("wordoff-player-id");
        } finally {
            setLoading(false);
        }
    }

    async function checkStreak(player: Player) {
        const today = new Date().toISOString().split('T')[0];
        const lastLogin = player.last_login;

        if (lastLogin === today) return player; // Already logged in today

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = 1;
        if (lastLogin === yesterdayStr) {
            newStreak = (player.login_streak || 0) + 1;
        }

        const { data, error } = await supabase
            .from("players")
            .update({ last_login: today, login_streak: newStreak })
            .eq("id", player.id)
            .select()
            .single();

        if (data) return data;
        return player;
    }

    async function login(username: string, secretCode: string) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("players")
                .select("*")
                .eq("username", username)
                .eq("secret_code", secretCode)
                .single();

            if (error || !data) throw new Error("Invalid username or password");

            const updatedPlayer = await checkStreak(data);

            setPlayer(updatedPlayer);
            localStorage.setItem("wordoff-player-id", updatedPlayer.id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }

    async function register(username: string, secretCode: string) {
        setLoading(true);
        try {
            // Check if username exists
            const { data: existing } = await supabase
                .from("players")
                .select("id")
                .eq("username", username)
                .single();

            if (existing) throw new Error("Username already taken");

            const { data, error } = await supabase
                .from("players")
                .insert([{ username, secret_code: secretCode }])
                .select()
                .single();

            if (error) throw error;

            setPlayer(data);
            localStorage.setItem("wordoff-player-id", data.id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        setPlayer(null);
        localStorage.removeItem("wordoff-player-id");
    }

    return {
        player,
        loading,
        login,
        register,
        logout,
        refreshPlayer: () => player?.id && fetchPlayer(player.id),
    };
}
