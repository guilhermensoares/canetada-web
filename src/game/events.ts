import type { GameEventDef } from "./types";

export const EVENTS: GameEventDef[] = [
  {
    id: "flood",
    titleKey: "evt_flood_title",
    descriptionKey: "evt_flood_desc",
    kind: "danger",
    weight: 1,
    choices: [
      {
        labelKey: "evt_flood_c1",
        cost: 80_000,
        effects: { happiness: 4, approval: 6 },
        resultKey: "evt_flood_c1r",
      },
      {
        labelKey: "evt_flood_c2",
        effects: { happiness: -10, approval: -12 },
        resultKey: "evt_flood_c2r",
      },
    ],
  },
  {
    id: "strike",
    titleKey: "evt_strike_title",
    descriptionKey: "evt_strike_desc",
    kind: "warning",
    weight: 1,
    choices: [
      {
        labelKey: "evt_strike_c1",
        cost: 120_000,
        effects: { happiness: 5, approval: 4 },
        resultKey: "evt_strike_c1r",
      },
      {
        labelKey: "evt_strike_c2",
        effects: { happiness: -8, approval: -6 },
        resultKey: "evt_strike_c2r",
      },
    ],
  },
  {
    id: "factory",
    titleKey: "evt_factory_title",
    descriptionKey: "evt_factory_desc",
    kind: "info",
    weight: 1,
    choices: [
      {
        labelKey: "evt_factory_c1",
        effects: { businesses: 40, unemployment: -1.5, approval: 3 },
        resultKey: "evt_factory_c1r",
      },
      {
        labelKey: "evt_factory_c2",
        effects: { approval: -3 },
        resultKey: "evt_factory_c2r",
      },
    ],
  },
  {
    id: "blackout",
    titleKey: "evt_blackout_title",
    descriptionKey: "evt_blackout_desc",
    kind: "danger",
    weight: 0.8,
    choices: [
      {
        labelKey: "evt_blackout_c1",
        cost: 60_000,
        effects: { happiness: 3, businesses: 5 },
        resultKey: "evt_blackout_c1r",
      },
      {
        labelKey: "evt_blackout_c2",
        effects: { happiness: -7, businesses: -20, approval: -5 },
        resultKey: "evt_blackout_c2r",
      },
    ],
  },
  {
    id: "epidemic",
    titleKey: "evt_epidemic_title",
    descriptionKey: "evt_epidemic_desc",
    kind: "danger",
    weight: 0.9,
    choices: [
      {
        labelKey: "evt_epidemic_c1",
        cost: 90_000,
        effects: { happiness: 4, approval: 5 },
        resultKey: "evt_epidemic_c1r",
      },
      {
        labelKey: "evt_epidemic_c2",
        effects: { happiness: -12, approval: -10, population: -200 },
        resultKey: "evt_epidemic_c2r",
      },
    ],
  },
  {
    id: "festival",
    titleKey: "evt_festival_title",
    descriptionKey: "evt_festival_desc",
    kind: "info",
    weight: 1.1,
    choices: [
      {
        labelKey: "evt_festival_c1",
        cost: 40_000,
        effects: { happiness: 6, approval: 3, businesses: 8 },
        resultKey: "evt_festival_c1r",
      },
      {
        labelKey: "evt_festival_c2",
        effects: { happiness: -1 },
        resultKey: "evt_festival_c2r",
      },
    ],
  },
  {
    id: "corruption",
    titleKey: "evt_corruption_title",
    descriptionKey: "evt_corruption_desc",
    kind: "warning",
    weight: 0.7,
    choices: [
      {
        labelKey: "evt_corruption_c1",
        effects: { approval: 5, happiness: 2 },
        resultKey: "evt_corruption_c1r",
      },
      {
        labelKey: "evt_corruption_c2",
        effects: { approval: -15, happiness: -6 },
        resultKey: "evt_corruption_c2r",
      },
    ],
  },
  {
    id: "migration",
    titleKey: "evt_migration_title",
    descriptionKey: "evt_migration_desc",
    kind: "info",
    weight: 1,
    choices: [
      {
        labelKey: "evt_migration_c1",
        cost: 70_000,
        effects: { population: 800, happiness: 2, approval: 3 },
        resultKey: "evt_migration_c1r",
      },
      {
        labelKey: "evt_migration_c2",
        effects: { approval: -6, happiness: -3 },
        resultKey: "evt_migration_c2r",
      },
    ],
  },
];

export function pickEvent(rng: () => number): GameEventDef {
  const total = EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return EVENTS[0];
}
