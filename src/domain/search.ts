export function trigramSimilarity(left: string, right: string): number {
  const leftGrams = trigrams(left);
  const rightGrams = trigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;
  let intersection = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) intersection += 1;
  return (2 * intersection) / (leftGrams.size + rightGrams.size);
}

function trigrams(value: string): Set<string> {
  const normalized = `  ${value.trim().toLowerCase().replace(/\s+/g, " ")} `;
  const values = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1)
    values.add(normalized.slice(index, index + 3));
  return values;
}
