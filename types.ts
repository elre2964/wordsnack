
// FIX: Import React to resolve 'Cannot find namespace 'React'' error.
import React from 'react';

export interface FlashcardData {
  translation: string;
  explanation: string;
}

export interface Word {
  id: string;
  word: string;
  partOfSpeech: string;
  definitions: string[];
  flashcard: FlashcardData;
  examples: string[];
  collision_group_id?: string;
  setName: string;
}

export interface TargetDefinition {
  wordId: string;
  definition: string;
}

export type GameState = 'PRACTICING' | 'FEEDBACK';

export type Match = {
  wordId: string;
  definition: string;
};

export type FeedbackType = 'correct' | 'incorrect' | 'none';

export interface LoadedVocabSet {
  id: string;
  name: string;
  words: Word[];
}

export interface VocabSetInfo {
  id: string;
  name: string;
  path: string;
}

export interface UserStats {
  wordsLearned: number;
  currentStreak: number;
  totalCorrect: number;
  totalAttempts: number;
  lastPlayed: string; // ISO Date string
}

export interface MemoryCardType {
  id: string;
  content: string;
  type: 'word' | 'definition';
  wordId: string;
  isFlipped: boolean;
  isMatched: boolean;
}
