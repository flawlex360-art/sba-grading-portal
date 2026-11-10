export const PROMOTION_THRESHOLD = 50; // percentage

export const CLASS_PROGRESSION = {
  "KG 1": "KG 2",
  "KG 2": "Basic 1",
  "Basic 1": "Basic 2",
  "Basic 2": "Basic 3",
  "Basic 3": "Basic 4",
  "Basic 4": "Basic 5",
  "Basic 5": "Basic 6",
  "Basic 6": "Basic 7",
  "Basic 7": "Basic 8",
  "Basic 8": "Basic 9",
  "Basic 9": "Completed / BECE",
  // Common Aliases in DropLists
  "BS. 1": "BS. 2",
  "BS. 2": "BS. 3",
  "BS. 3": "BS. 4",
  "BS. 4": "BS. 5",
  "BS. 5": "BS. 6",
  "BS. 6": "BS. 7",
  "BS. 7": "BS. 8",
  "BS. 8": "BS. 9",
  "BS. 9": "Completed / BECE",
  // Double-Stream Aliases (A & B)
  "BS. 1A": "BS. 2A",
  "BS. 1B": "BS. 2B",
  "BS. 2A": "BS. 3A",
  "BS. 2B": "BS. 3B",
  "BS. 3A": "BS. 4A",
  "BS. 3B": "BS. 4B",
  "BS. 4A": "BS. 5A",
  "BS. 4B": "BS. 5B",
  "BS. 5A": "BS. 6A",
  "BS. 5B": "BS. 6B",
  "BS. 6A": "BS. 7A",
  "BS. 6B": "BS. 7B",
  "BS. 7A": "BS. 8A",
  "BS. 7B": "BS. 8B",
  "BS. 8A": "BS. 9A",
  "BS. 8B": "BS. 9B",
  "BS. 9A": "Completed / BECE",
  "BS. 9B": "Completed / BECE",
  "JHS 1": "JHS 2",
  "JHS 2": "JHS 3",
  "JHS 3": "Completed / BECE"
};

/**
 * Helper to determine if a class name belongs to Junior High School (BS. 7, 8, 9 including streams like BS. 7A, BS. 7B).
 */
export function isJhsClass(className = '') {
  return /^(BS\.?\s*[789]|Basic\s*[789]|JHS\s*[123])/i.test(String(className).trim());
}

/**
 * Resolves the next promoted class name, preserving stream suffixes (e.g., BS. 7A -> BS. 8A).
 */
export function resolveNextClass(classLevel = '') {
  const clean = String(classLevel).trim();
  if (CLASS_PROGRESSION[clean]) return CLASS_PROGRESSION[clean];
  const streamMatch = clean.match(/^(BS\.?\s*|Basic\s*)([1-9])\s*([A-Z])?$/i);
  if (streamMatch) {
    const prefix = streamMatch[1];
    const num = parseInt(streamMatch[2], 10);
    const stream = streamMatch[3] ? streamMatch[3].toUpperCase() : '';
    if (num >= 9) return "Completed / BECE";
    return `${prefix}${num + 1}${stream}`;
  }
  return 'the next class';
}
