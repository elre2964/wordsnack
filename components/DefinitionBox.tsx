import React from 'react';
import type { FeedbackType } from '../types';

interface DefinitionBoxProps {
  definition: string;
  onClick: () => void;
  feedback: FeedbackType;
  matchedWord: string | null;
  correctWord: string | null;
  isTargetedForSelection: boolean;
}

const DefinitionBox: React.FC<DefinitionBoxProps> = ({ definition, onClick, feedback, matchedWord, correctWord, isTargetedForSelection }) => {
  const baseClasses = "w-full py-4 px-4 rounded-xl border-2 transition-all duration-300 shadow-lg flex flex-col justify-between text-center bg-slate-800/50 backdrop-blur-sm min-h-[120px]";

  const feedbackClasses = {
    correct: 'bg-green-500/20 border-green-400 scale-105 shadow-green-500/20 shadow-xl animate-pop',
    incorrect: 'bg-red-500/20 border-red-400 scale-95 shadow-red-500/20 shadow-lg animate-shake',
    none: ''
  };

  let appliedClasses = '';

  if (feedback !== 'none') {
    appliedClasses = feedbackClasses[feedback];
  } else if (isTargetedForSelection) {
    appliedClasses = 'scale-105 ring-4 ring-sky-400/50 shadow-xl border-sky-500 border-dashed cursor-pointer bg-sky-900/30';
  } else if (matchedWord) {
    appliedClasses = 'border-slate-600 bg-slate-900/40 cursor-pointer hover:bg-slate-700/50 hover:border-sky-700';
  } else {
    appliedClasses = 'border-slate-700 cursor-default';
  }


  return (
    <div className={`${baseClasses} ${appliedClasses}`} onClick={onClick}>
      <div className="min-h-[2.5rem] mb-2 flex items-center justify-center font-lexend">
        {feedback === 'incorrect' ? (
          <div className="text-center">
            {matchedWord && <p className="font-bold text-red-400 text-lg line-through decoration-2">{matchedWord}</p>}
            <p className="font-bold text-green-400 text-lg">{correctWord}</p>
          </div>
        ) : feedback === 'correct' ? (
           <p className="font-bold text-green-300 text-lg">{matchedWord}</p>
        ) : matchedWord ? (
           <p className="font-bold text-sky-400 text-lg">{matchedWord}</p>
        ) : (
          isTargetedForSelection && <span className="text-slate-400 italic">Place word here...</span>
        )}
      </div>
      <p className="text-slate-300 text-sm md:text-base">{definition}</p>
    </div>
  );
};

export default DefinitionBox;