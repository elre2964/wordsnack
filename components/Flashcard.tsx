import React from 'react';
import type { Word } from '../types';

interface FlashcardProps {
  wordData: Word;
}

const Flashcard: React.FC<FlashcardProps> = ({ wordData }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg w-full transform transition-all duration-300 hover:shadow-purple-500/20 hover:border-purple-500/80 min-h-[250px] flex flex-col justify-between relative overflow-hidden group [transform-style:preserve-3d] hover:-translate-y-2">
       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-600/10 via-transparent to-sky-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="transform [transform:translateZ(50px)]">
        <div className="mb-4">
          <h3 className="text-3xl font-bold text-purple-400 font-lexend">{wordData.word}</h3>
          <p className="text-md text-slate-400 italic mb-3">{wordData.partOfSpeech}</p>
          <span className="text-xs bg-slate-700 text-purple-300 px-3 py-1 rounded-full font-semibold tracking-wide">{wordData.setName}</span>
        </div>
        
        {wordData.flashcard.translation && (
          <div className="mb-4">
            <h4 className="font-semibold text-lg text-amber-400 font-lexend">Translation</h4>
            <p className="text-slate-300 text-lg"><span className="font-medium">{wordData.flashcard.translation}</span></p>
          </div>
        )}
      </div>

      <div className="transform [transform:translateZ(30px)]">
        <h4 className="font-semibold text-lg text-amber-400 font-lexend">Examples</h4>
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