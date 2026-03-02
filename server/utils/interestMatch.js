function normalizeArray(values = []) {
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
}

export function jaccardSimilarity(arr1 = [], arr2 = []) {
  const setA = new Set(normalizeArray(arr1));
  const setB = new Set(normalizeArray(arr2));

  if (!setA.size && !setB.size) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
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

function exactMatch(a, b) {
  if (!a || !b) return 0;
  return Number(String(a).trim().toLowerCase() === String(b).trim().toLowerCase());
}

function preferenceMatch(valueA, valueB) {
  if (!valueA || !valueB) return 0;
  return Number(String(valueA).toLowerCase() === String(valueB).toLowerCase());
}

function ageRangeCompatibility(age = 0, range = {}) {
  if (!age || !range) return 0;
  const min = Number(range.minAge ?? 18);
  const max = Number(range.maxAge ?? 99);
  return Number(age >= min && age <= max);
}

export function calculateCompatibilityV2(userA = {}, userB = {}, context = {}) {
  const interestScore = jaccardSimilarity(userA.interests?.movies, userB.interests?.movies);
  const musicScore = jaccardSimilarity(userA.interests?.music, userB.interests?.music);
  const educationScore = exactMatch(userA.education, userB.education);
  const workScore = exactMatch(userA.workDomain, userB.workDomain);
  const bioSimilarity = jaccardSimilarity(tokenizeBio(userA.bio), tokenizeBio(userB.bio));
  const smokingScore = preferenceMatch(userA.smokingPreference, userB.smokingPreference);
  const chattyScore = preferenceMatch(userA.conversationStyle, userB.conversationStyle);
  const purposeScore = preferenceMatch(userA.travelPurpose, userB.travelPurpose);
  const genderPreferenceA = userA.genderPreference === 'any' ? 1 : Number(userA.genderPreference === userB.gender);
  const genderPreferenceB = userB.genderPreference === 'any' ? 1 : Number(userB.genderPreference === userA.gender);
  const genderScore = (genderPreferenceA + genderPreferenceB) / 2;
  const ageScore = (ageRangeCompatibility(userA.age, userB.ageRange) + ageRangeCompatibility(userB.age, userA.ageRange)) / 2;

  const routeScore = Number(context.routeOverlapScore || 0);

  const compatibility =
    interestScore * 0.14 +
    musicScore * 0.14 +
    educationScore * 0.08 +
    workScore * 0.1 +
    bioSimilarity * 0.08 +
    smokingScore * 0.08 +
    chattyScore * 0.08 +
    purposeScore * 0.08 +
    genderScore * 0.06 +
    ageScore * 0.06 +
    routeScore * 0.1;

  const score = Math.round(Math.max(0, Math.min(1, compatibility)) * 100);

  const reasons = [];
  if (musicScore >= 0.5) reasons.push('Same music taste');
  if (routeScore >= 0.4) reasons.push('Strong route overlap');
  if (workScore) reasons.push('Similar job type');
  if (smokingScore) reasons.push('Lifestyle preference match');
  if (chattyScore) reasons.push('Conversation style match');

  return {
    score,
    reasons: reasons.slice(0, 3),
    breakdown: {
      interestScore,
      musicScore,
      educationScore,
      workScore,
      bioSimilarity,
      smokingScore,
      chattyScore,
      purposeScore,
      genderScore,
      ageScore,
      routeScore,
    },
  };
}

export function calculateCompatibility(userA = {}, userB = {}, context = {}) {
  return calculateCompatibilityV2(userA, userB, context).score;
}
