
import React from 'react';
import type { Word } from '../types';

interface FlashcardProps {
  wordData: Word;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

const Flashcard: React.FC<FlashcardProps> = ({ wordData, isFavorite = false, onToggleFavorite }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-lg w-full transform transition-all duration-300 hover:shadow-purple-500/20 hover:border-purple-500/80 min-h-[250px] flex flex-col justify-between relative overflow-hidden group [transform-style:preserve-3d] hover:-translate-y-2">
       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-600/10 via-transparent to-sky-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="transform [transform:translateZ(50px)] relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
             <h3 className="text-3xl font-bold text-purple-400 font-lexend">{wordData.word}</h3>
             <p className="text-md text-slate-400 italic mb-3">{wordData.partOfSpeech}</p>
          </div>
          {onToggleFavorite && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(wordData.id);
              }}
              className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-600 hover:text-yellow-200 hover:bg-slate-700'}`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
          )}
        </div>

        <span className="text-xs bg-slate-700 text-purple-300 px-3 py-1 rounded-full font-semibold tracking-wide">{wordData.setName}</span>
        
        {wordData.flashcard.translation && (
          <div className="my-4">
            <h4 className="font-semibold text-lg text-amber-400 font-lexend">Translation</h4>
            <p className="text-slate-300 text-lg"><span className="font-medium">{wordData.flashcard.translation}</span></p>
          </div>
        )}
      </div>

      <div className="transform [transform:translateZ(30px)] relative z-10">
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
