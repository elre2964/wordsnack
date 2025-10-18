import React from 'react';
import type { Word } from '../types';

interface FlashcardProps {
  wordData: Word;
}

const Flashcard: React.FC<FlashcardProps> = ({ wordData }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg w-full transform transition-all duration-300 hover:scale-105 hover:shadow-sky-500/20 hover:border-sky-500/80 min-h-[250px] flex flex-col justify-between">
      <div>
        <div className="mb-4">
          <h3 className="text-2xl font-bold text-sky-400">{wordData.word}</h3>
          <p className="text-md text-slate-400 italic mb-2">{wordData.partOfSpeech}</p>
          <span className="text-xs bg-slate-700 text-sky-300 px-3 py-1 rounded-full font-semibold">{wordData.setName}</span>
        </div>
        
        {wordData.flashcard.translation && (
          <div className="mb-4">
            <h4 className="font-semibold text-lg text-amber-400">Translation</h4>
            <p className="text-slate-300 text-lg"><span className="font-medium">{wordData.flashcard.translation}</span></p>
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-lg text-amber-400">Examples</h4>
        <ul className="list-disc list-inside space-y-2 mt-2 pl-2">
          {wordData.examples.map((example, index) => (
            <li key={index} className="text-slate-300">{example}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Flashcard;