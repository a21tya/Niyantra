export interface InjectionSignal {
  patternName: string;
  matchedText: string;
  weight: number;
}

const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp; weight: number }> = [
  {
    name: "IGNORE_PREVIOUS_INSTRUCTIONS",
    regex: /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|rules|prompts|guidelines)/i,
    weight: 0.95,
  },
  {
    name: "DEVELOPER_MODE_JAILBREAK",
    regex: /(?:developer\s+mode|dan\s+mode|jailbreak|unrestricted\s+mode|bypass\s+(?:rules|filters|safety))/i,
    weight: 0.9,
  },
  {
    name: "SYSTEM_ROLE_HIJACK",
    regex: /(?:you\s+are\s+now|roleplay\s+as|act\s+as\s+a)\s+(?:unrestricted|evil|compromised|root|superuser)/i,
    weight: 0.85,
  },
  {
    name: "SYSTEM_DELIMITER_INJECTION",
    regex: /(?:\[\s*SYSTEM\s*\]|<\|im_start\|>system|<system>|---BEGIN\s+SYSTEM\s+PROMPT---)/i,
    weight: 0.9,
  },
  {
    name: "SENSITIVE_DATA_EXFILTRATION_COMMAND",
    regex: /(?:dump|leak|exfiltrate|send|email|post)\s+(?:all\s+)?(?:passwords|secrets|salaries|payroll|tokens|credentials)/i,
    weight: 0.8,
  },
];

export function detectPromptInjection(input: string): {
  isSuspicious: boolean;
  score: number;
  signals: InjectionSignal[];
} {
  if (!input || typeof input !== "string") {
    return { isSuspicious: false, score: 0, signals: [] };
  }

  const signals: InjectionSignal[] = [];
  let maxWeight = 0;

  for (const pattern of INJECTION_PATTERNS) {
    const match = pattern.regex.exec(input);
    if (match) {
      signals.push({
        patternName: pattern.name,
        matchedText: match[0],
        weight: pattern.weight,
      });
      if (pattern.weight > maxWeight) {
        maxWeight = pattern.weight;
      }
    }
  }

  return {
    isSuspicious: signals.length > 0,
    score: maxWeight,
    signals,
  };
}
