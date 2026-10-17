import { randomGenome } from "../genome/Genome";
import { PhysicsRace } from "./PhysicsRace";
import { Racer } from "./Racer";

export const HORSE_COUNT = 5;
export const TRACK_LENGTH = 12; // meters
export const TIME_LIMIT = 60; // seconds after the gait starts

const NAMES = [
  "Thunder Hoof",
  "Lucky Biscuit",
  "Dust Devil",
  "Sir Gallop",
  "Moonshine",
  "Hot Sauce",
  "Pixel Pony",
  "Old Rusty",
];

// A new race: five horses, each with its own random genome.
export function createRace(): PhysicsRace {
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  const racers: Racer[] = [];
  for (let i = 0; i < HORSE_COUNT; i++) {
    racers.push(new Racer(names[i] ?? `Horse ${i + 1}`, randomGenome(), TRACK_LENGTH));
  }
  return new PhysicsRace(racers, TRACK_LENGTH, TIME_LIMIT);
}