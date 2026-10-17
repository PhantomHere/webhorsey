import { Horse } from "./Horse";

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

const COLORS = ["#c0392b", "#2980b9", "#f1c40f", "#8e44ad", "#e67e22", "#16a085"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createHorses(count: number): Horse[] {
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  const horses: Horse[] = [];

  for (let i = 0; i < count; i++) {
    horses.push(
      new Horse(names[i] ?? `Horse ${i + 1}`, COLORS[i % COLORS.length] ?? "#cccccc", {
        topSpeed: rand(14.5, 16.5),
        acceleration: rand(3, 5),
        stamina: rand(26, 40),
        sprintStart: rand(0.6, 0.85),
      }),
    );
  }
  return horses;
}