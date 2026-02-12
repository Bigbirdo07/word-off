/**
 * Rank tier definitions and utility functions.
 * Ported from legacy_prototype/app.js
 */

export const RANKS = [
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

export interface RankInfo {
    tier: string;
    currentRP: number;
    tierFloor: number;
    tierCeiling: number;
    progressPercent: number;
}

/**
 * Given a rank points value, returns the rank tier info
 * including tier name, progress within the tier, and thresholds.
 */
export function getRankFromRP(rp: number): RankInfo {
    const currentRank = [...RANKS].reverse().find((rank) => rp >= rank.points) || RANKS[0];
    const currentIndex = RANKS.indexOf(currentRank);
    const nextRank = RANKS[currentIndex + 1];

    const tierFloor = currentRank.points;
    const tierCeiling = nextRank ? nextRank.points : currentRank.points + 100;
    const progressInTier = Math.min(100, Math.max(0, rp - tierFloor));
    const progressPercent = Math.round((progressInTier / (tierCeiling - tierFloor)) * 100);

    return {
        tier: currentRank.name,
        currentRP: rp,
        tierFloor,
        tierCeiling,
        progressPercent: Math.max(2, progressPercent), // min 2% for visibility
    };
}
