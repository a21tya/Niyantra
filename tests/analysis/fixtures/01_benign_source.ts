/**
 * Test Fixture 01: Benign Source Code (False Positive Control)
 * Contains math operations, string formatting, and clean logic without vulnerabilities.
 */

export interface MatrixItem {
  id: string;
  weight: number;
}

export function computeWeightedAverage(items: MatrixItem[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return total / items.length;
}

export function formatUserDisplayName(firstName: string, lastName: string): string {
  const cleanFirst = firstName.trim();
  const cleanLast = lastName.trim();
  return `${cleanLast}, ${cleanFirst}`;
}

export function safeDataTransformer(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return "{}";
  }
}
