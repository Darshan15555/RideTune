export function calculateCompatibility(userAInterests = {}, userBInterests = {}) {
  const flatten = (interests) => [
    ...(interests.music || []),
    ...(interests.movies || []),
    ...(interests.anime || []),
    ...(interests.field || []),
  ];

  const a = flatten(userAInterests);
  const b = flatten(userBInterests);

  const aSet = new Set(a);
  const bSet = new Set(b);
  const common = [...aSet].filter((entry) => bSet.has(entry)).length;
  const total = new Set([...a, ...b]).size;

  const similarity = total ? common / total : 0;
  return Math.round(similarity * 100);
}
