"use client";

import { useState, useEffect } from "react";
import io from "socket.io-client";
import { Player } from "./useAuth";

export type MatchStatus = "idle" | "searching" | "found" | "playing";

export function useMatchmaking(player: Player | null) {
    const [status, setStatus] = useState<MatchStatus>("idle");
    const [matchData, setMatchData] = useState<any>(null);
    const [socket, setSocket] = useState<any>(null);

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
            // If we're still idle (sprint mode), go straight to playing
            setStatus((prevStatus) => prevStatus === "idle" ? "playing" : prevStatus);
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

    return {
        status,
        matchData,
        joinQueue,
        leaveQueue,
        startSprint,
        getDaily,
        socket
    };
}
