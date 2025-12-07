
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

export type GameState = 'PRACTICING' | 'FEEDBACK' | 'GAME_OVER';

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

export interface MemoryCardType {
  id: string;
  content: string;
  type: 'word' | 'definition';
  wordId: string;
  isFlipped: boolean;
  isMatched: boolean;
}
