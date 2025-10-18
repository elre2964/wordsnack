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
  const baseClasses = "w-full py-4 px-4 rounded-xl border-2 transition-all duration-300 shadow-lg flex flex-col items-center justify-center text-center bg-slate-800/50 backdrop-blur-sm";

  const feedbackClasses = {
    correct: 'bg-green-500/30 border-green-400',
    incorrect: 'bg-red-500/30 border-red-400',
    none: ''
  };

  let appliedClasses = '';

  if (feedback !== 'none') {
    appliedClasses = feedbackClasses[feedback];
  } else if (isTargetedForSelection) {
    appliedClasses = 'scale-105 ring-4 ring-sky-400/50 shadow-xl border-sky-500 border-dashed cursor-pointer';
  } else if (matchedWord) {
    appliedClasses = 'border-sky-700 cursor-pointer hover:bg-slate-700/50';
  } else {
    appliedClasses = 'border-slate-700 cursor-default';
  }


  return (
    <div className={`${baseClasses} ${appliedClasses}`} onClick={onClick}>
      <div className="min-h-[2.5rem] mb-2 flex items-center justify-center">
        {feedback === 'incorrect' ? (
          <div className="text-center">
            {matchedWord && <p className="font-bold text-red-300 text-lg line-through">{matchedWord}</p>}
            <p className="font-bold text-green-300 text-lg">{correctWord}</p>
          </div>
        ) : feedback === 'correct' ? (
           <p className="font-bold text-green-300 text-lg">{matchedWord}</p>
        ) : matchedWord ? (
           <p className="font-bold text-sky-300 text-lg">{matchedWord}</p>
        ) : (
          isTargetedForSelection && <span className="text-slate-400">Place word here</span>
        )}
      </div>
      <p className="text-slate-300 text-sm md:text-base">{definition}</p>
    </div>
  );
};

export default DefinitionBox;