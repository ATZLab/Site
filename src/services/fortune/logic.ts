/**
 * Fortune service — pure logic, framework-free.
 * Safe to import from both server and client components.
 */

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export const categories: Category[] = [
  { id: 'study', label: '학업', icon: '📚' },
  { id: 'work', label: '직장', icon: '💼' },
  { id: 'money', label: '돈', icon: '💰' },
  { id: 'love', label: '연애', icon: '💕' },
  { id: 'health', label: '건강', icon: '💪' },
];

export type Tier = 'low' | 'mid' | 'high' | 'super';

export interface FortuneScore {
  categoryId: string;
  /** Integer 0–100. */
  value: number;
}

/** Bucket a 0–100 score into a tier for color/glow. */
export function tierOf(score: number): Tier {
  if (score >= 90) return 'super';
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

/** Tailwind class for the gauge fill. Kept inline so it can be themed via CSS vars. */
export function tierClass(tier: Tier): string {
  switch (tier) {
    case 'low':
      return 'bg-zinc-300';
    case 'mid':
      return 'bg-zinc-500';
    case 'high':
      return 'bg-[color:var(--color-accent)]';
    case 'super':
      return 'bg-[#c93c2e]'; // deeper coral
  }
}

/** Subtle box-shadow for 90+ to make it pop. */
export function tierGlow(tier: Tier): string | undefined {
  if (tier === 'super') return '0 0 14px -2px rgba(255, 90, 78, 0.55)';
  if (tier === 'high') return '0 0 8px -2px rgba(255, 90, 78, 0.35)';
  return undefined;
}

/**
 * Per-category, per-tier comment. Kept light and casual — no "destiny" tone.
 * Tier buckets match `tierOf`. Falls back to the generic `mid` set if a
 * category is missing an entry for a tier.
 */
type CommentSet = Record<Tier, string>;
type CommentMap = Record<string, CommentSet>;

const FALLBACK: CommentSet = {
  low: '그냥 조용히 보내는 날이에요',
  mid: '평범한 하루, 적당히 신경 쓰면 OK',
  high: '꽤 좋은 흐름이에요',
  super: '오늘 좀 자신감 있게 가도 돼요 ✨',
};

const COMMENTS: CommentMap = {
  study: {
    low: '오늘은 좀 쉬어가도 OK',
    mid: '그냥 평범한 공부 모드',
    high: '집중력이 살짝 나올지도? 💡',
    super: '공부왕 모드 ON ✨',
  },
  work: {
    low: '살짝 여유 있는 하루 ☕',
    mid: '그냥 평범한 업무',
    high: '좀 인정받을 일 있을지도 💪',
    super: '오늘 좀 빛나는데요? 🌟',
  },
  money: {
    low: '오늘은 통장 좀 닫아두기 🔒',
    mid: '별일 없는, 평범한 지갑',
    high: '작은 용돈이 들어올 수도? 💵',
    super: '지갑 열어둬도 좋을 것 같아요 💰',
  },
  love: {
    low: '오늘은 혼자가 편한 날',
    mid: '평범한 하루, 연애도 평범',
    high: '스쳐가는 눈에 신경 써보세요 👀',
    super: '설렘주의보 발령 💘',
  },
  health: {
    low: '오늘은 좀 쉬어가요',
    mid: '컨디션 적당히 괜찮아요',
    high: '기분 좋은 컨디션 ✨',
    super: '몸이 가볍고 기분 좋을 것 같은 날 🌿',
  },
};

export function commentFor(categoryId: string, score: number): string {
  const tier = tierOf(score);
  return COMMENTS[categoryId]?.[tier] ?? FALLBACK[tier];
}

/** Roll fresh scores for all categories. Server- and client-safe. */
export function rollFortune(rng: () => number = Math.random): FortuneScore[] {
  return categories.map((c) => ({
    categoryId: c.id,
    value: Math.floor(rng() * 101), // 0..100 inclusive
  }));
}

export function categoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}
