// Saves the player's progress in the browser. It stays on this browser only:
// playing on another PC starts from the beginning.
export interface SaveData {
  bankroll: number;
  raceNumber: number;
}

export const START_BANKROLL = 50;
const KEY = "horsey.save.v1";

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<SaveData>;
      if (typeof data.bankroll === "number" && typeof data.raceNumber === "number" && data.bankroll > 0) {
        return { bankroll: Math.floor(data.bankroll), raceNumber: Math.max(1, Math.floor(data.raceNumber)) };
      }
    }
  } catch {
    // no storage available, or damaged data: just start fresh
  }
  return { bankroll: START_BANKROLL, raceNumber: 1 };
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // saving is a bonus; the game works without it
  }
}