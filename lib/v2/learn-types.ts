export type LearnItem = { threadId: string; question: string; askedAt: string; suggestedAnswer: string; answered: boolean };
export type LearnResponse = { items: LearnItem[]; total: number };
