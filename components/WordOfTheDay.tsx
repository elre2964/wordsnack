import React from 'react';
import type { Word } from '../types';

interface WordOfTheDayProps {
  wordData: Word;
}

const WordOfTheDay: React.FC<WordOfTheDayProps> = ({ wordData }) => {
  if (!wordData) {
    return null; // Or a loading/placeholder state
  }

  // Pick a random definition and example if available
  const definition = wordData.definitions?.[0] || 'No definition available.';
  const example = wordData.examples?.[0] || 'No example sentence available.';

  return (
    <div className="w-full max-w-2xl bg-gradient-to-br from-purple-900/50 to-sky-900/50 backdrop-blur-sm p-6 rounded-2xl border border-purple-700/50 shadow-2xl shadow-purple-900/20 mb-8 animate-scaleUp">
      <h2 className="text-sm font-bold text-center text-purple-300 mb-3 tracking-widest uppercase font-lexend">Word of the Day</h2>
      <div className="text-center">
        <h3 className="text-4xl font-bold text-white font-lexend tracking-tight">{wordData.word}</h3>
        <p className="text-purple-300 italic mb-4">{wordData.partOfSpeech}</p>
        <p className="text-lg text-slate-200 mb-4">{definition}</p>
        <div className="border-t border-purple-700/50 pt-4">
          <p className="text-slate-300 italic">"{example}"</p>
        </div>
      </div>
    </div>
  );
};

export default WordOfTheDay;
