/**
 * Rank tier definitions and utility functions.
 * 
 * Progression: III (lowest) → II → I (highest) within each tier.
 * Each division = 100 RP. After completing I, you move to the next tier.
 * 
 * Tier order: Lead → Pencil → Mechanical Pencil → Pen → Fountain Pen → Quill Pen
 */

export const RANKS = [
    // Lead tier (0-299 RP)
    { name: "Lead III", points: 0 },
    { name: "Lead II", points: 100 },
    { name: "Lead I", points: 200 },
    // Pencil tier (300-599 RP)
    { name: "Pencil III", points: 300 },
    { name: "Pencil II", points: 400 },
    { name: "Pencil I", points: 500 },
    // Mechanical Pencil tier (600-899 RP)
    { name: "Mechanical Pencil III", points: 600 },
    { name: "Mechanical Pencil II", points: 700 },
    { name: "Mechanical Pencil I", points: 800 },
    // Pen tier (900-1199 RP)
    { name: "Pen III", points: 900 },
    { name: "Pen II", points: 1000 },
    { name: "Pen I", points: 1100 },
    // Fountain Pen tier (1200-1499 RP)
    { name: "Fountain Pen III", points: 1200 },
    { name: "Fountain Pen II", points: 1300 },
    { name: "Fountain Pen I", points: 1400 },
    // Quill Pen tier (1500+ RP) — max tier
    { name: "Quill Pen III", points: 1500 },
    { name: "Quill Pen II", points: 1600 },
    { name: "Quill Pen I", points: 1700 },
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
 * 
 * Example: 150 RP → Lead II (50% progress toward Lead I at 200)
 */
export function getRankFromRP(rp: number): RankInfo {
    const currentRank = [...RANKS].reverse().find((rank) => rp >= rank.points) || RANKS[0];
    const currentIndex = RANKS.indexOf(currentRank);
    const nextRank = RANKS[currentIndex + 1];

    const tierFloor = currentRank.points;
    const tierCeiling = nextRank ? nextRank.points : currentRank.points + 100;
    const progressInTier = Math.min(tierCeiling - tierFloor, Math.max(0, rp - tierFloor));
    const progressPercent = Math.round((progressInTier / (tierCeiling - tierFloor)) * 100);

    return {
        tier: currentRank.name,
        currentRP: rp,
        tierFloor,
        tierCeiling,
        progressPercent: Math.max(2, progressPercent), // min 2% for visibility
    };
}
