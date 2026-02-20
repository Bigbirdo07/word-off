"use client";

import { useState, useEffect } from "react";
import io from "socket.io-client";
import { Player } from "./useAuth";

export type MatchStatus = "idle" | "searching" | "found" | "playing" | "lobby_waiting";

export function useMatchmaking(player: Player | null) {
    const [status, setStatus] = useState<MatchStatus>("idle");
    const [matchData, setMatchData] = useState<any>(null);
    const [socket, setSocket] = useState<any>(null);
    const [lobbyCode, setLobbyCode] = useState<string | null>(null);
    const [lobbyError, setLobbyError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize socket connection
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        newSocket.on("connect", () => {
            console.log("Connected to matchmaking server");
        });

        newSocket.on("queue_update", (data: any) => {
            if (data.status === "searching") setStatus("searching");
            if (data.status === "idle") setStatus("idle");
        });

        newSocket.on("match_init", (data: any) => {
            console.log("Match found!", data);
            setMatchData((prev: any) => ({ ...prev, ...data }));
            setStatus("found");
            setTimeout(() => setStatus("playing"), 500);
        });

        newSocket.on("match_start", (data: any) => {
            console.log("Match Started!", data);
            setMatchData((prev: any) => prev ? { ...prev, ...data } : data);
            // If we're still idle (sprint mode) or in lobby, go straight to playing
            setStatus((prevStatus) => (prevStatus === "idle" || prevStatus === "lobby_waiting") ? "playing" : prevStatus);
        });

        // --- Lobby events ---
        newSocket.on("lobby_created", (data: any) => {
            console.log("Lobby created:", data.code);
            setLobbyCode(data.code);
            setLobbyError(null);
            setStatus("lobby_waiting");
        });

        newSocket.on("lobby_error", (data: any) => {
            console.log("Lobby error:", data.message);
            setLobbyError(data.message);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const joinQueue = () => {
        if (!player || !socket) return;
        socket.emit("join_queue", player);
        setStatus("searching");
    };

    const leaveQueue = () => {
        if (!socket) return;
        socket.emit("leave_queue");
        setStatus("idle");
    };

    const startSprint = () => {
        if (!socket) return;
        const p = player || { username: "Guest", id: "guest", rank_tier: "Unranked", rank_points: 0 };
        socket.emit("start_sprint", p);
    };

    const getDaily = () => {
        if (!socket) return;
        socket.emit("get_daily");
    };

    // --- Lobby functions ---
    const createLobby = () => {
        if (!player || !socket) return;
        setLobbyError(null);
        socket.emit("create_lobby", player);
    };

    const joinLobby = (code: string) => {
        if (!player || !socket) return;
        setLobbyError(null);
        socket.emit("join_lobby", { code: code.toUpperCase(), player });
    };

    const cancelLobby = () => {
        if (!socket) return;
        socket.emit("cancel_lobby");
        setLobbyCode(null);
        setStatus("idle");
    };

    return {
        status,
        matchData,
        joinQueue,
        leaveQueue,
        startSprint,
        getDaily,
        createLobby,
        joinLobby,
        cancelLobby,
        lobbyCode,
        lobbyError,
        socket
    };
}
