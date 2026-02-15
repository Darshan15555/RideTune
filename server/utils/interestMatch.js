function normalizeArray(values = []) {
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
}

export function jaccardSimilarity(arr1 = [], arr2 = []) {
  const setA = new Set(normalizeArray(arr1));
  const setB = new Set(normalizeArray(arr2));

  if (!setA.size && !setB.size) {
    return 0;
  }

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function tokenizeBio(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function calculateCompatibility(userA = {}, userB = {}) {
  const interestScore = jaccardSimilarity(userA.interests?.movies, userB.interests?.movies);
  const musicScore = jaccardSimilarity(userA.interests?.music, userB.interests?.music);

  const educationScore =
    userA.education && userB.education
      ? Number(String(userA.education).trim().toLowerCase() === String(userB.education).trim().toLowerCase())
      : 0;

  const workScore =
    userA.workDomain && userB.workDomain
      ? Number(String(userA.workDomain).trim().toLowerCase() === String(userB.workDomain).trim().toLowerCase())
      : 0;

  const bioSimilarity = jaccardSimilarity(tokenizeBio(userA.bio), tokenizeBio(userB.bio));

  const frequencyA = Number(userA.travelFrequency || 0);
  const frequencyB = Number(userB.travelFrequency || 0);
  const maxFrequency = Math.max(frequencyA, frequencyB, 1);
  const travelSimilarity = 1 - Math.abs(frequencyA - frequencyB) / maxFrequency;

  const compatibility =
    interestScore * 0.3 +
    musicScore * 0.25 +
    educationScore * 0.15 +
    workScore * 0.15 +
    bioSimilarity * 0.15;

  const adjusted = Math.max(0, Math.min(1, compatibility * (0.85 + travelSimilarity * 0.15)));

  return Math.round(adjusted * 100);
}
