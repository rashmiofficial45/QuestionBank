export const rankedFormats = {
  ordering: "Put items in order",
  pair_matching: "Match pairs",
} as const;

export function isRanked(interaction: string): interaction is keyof typeof rankedFormats {
  return Object.hasOwn(rankedFormats, interaction);
}
