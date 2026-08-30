export const WORKOUT_CATEGORY_MAPPING: Record<string, string> = {
  'exp-strength': 'Strength',
  'exp-flow': 'Mind & Body',
  'exp-rhythm': 'Cardio',
  'exp-reset': 'Conditioning',
  'exp-combat': 'Boxing',
  'exp-aerial': 'Aerial Yoga',
};

export const getCategoryFromTitle = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('aerial') || t.includes('hammock')) return 'Aerial Yoga';
  if (t.includes('strength') || t.includes('forge')) return 'Strength';
  if (t.includes('flow') || t.includes('motion') || t.includes('yoga')) return 'Mind & Body';
  if (t.includes('rhythm') || t.includes('burn') || t.includes('dance')) return 'Cardio';
  if (t.includes('reset') || t.includes('studio') || t.includes('stretch')) return 'Conditioning';
  if (t.includes('combat') || t.includes('boxing') || t.includes('kick')) return 'Boxing';
  return '';
};
