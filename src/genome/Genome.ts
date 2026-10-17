import { DEFAULT_DNA } from "../physics/PhysicsHorse";
import type { HorseDna } from "../physics/PhysicsHorse";

// A genome is a list of numbers between 0 and 1. Each position is one gene.
// decodeGenome() stretches every gene into the real range of the body value it controls.
export type Genome = number[];

interface GeneSpec {
  key: keyof HorseDna; // which body value this gene controls
  min: number; // gene = 0 gives this
  max: number; // gene = 1 gives this
}

// The order here is the order of the genes in the list.
const GENES: GeneSpec[] = [
  { key: "torsoLength", min: 1.5, max: 2.6 },
  { key: "torsoHeight", min: 0.6, max: 1.0 },
  { key: "legLength", min: 0.9, max: 1.7 },
  { key: "legThickness", min: 0.1, max: 0.2 },
  { key: "stance", min: 0.1, max: 0.35 },
  { key: "muscle", min: 0.8, max: 3.0 },
  { key: "hipSwing", min: 0.1, max: 0.3 },
  { key: "kneeBend", min: 0.3, max: 1.1 },
  { key: "stiffness", min: 6, max: 16 },
  { key: "hue", min: 0, max: 360 }, // cosmetic: body color
];

export const GENE_COUNT = GENES.length;

export function randomGenome(rng: () => number = Math.random): Genome {
  return GENES.map(() => rng());
}

export function decodeGenome(genome: Genome): HorseDna {
  const dna: HorseDna = { ...DEFAULT_DNA };
  GENES.forEach((spec, i) => {
    const gene = Math.min(1, Math.max(0, genome[i] ?? 0.5));
    dna[spec.key] = spec.min + gene * (spec.max - spec.min);
  });
  return dna;
}