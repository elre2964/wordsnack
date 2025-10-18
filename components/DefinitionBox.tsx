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
  const baseClasses = "w-full py-4 px-4 rounded-lg border-2 transition-all duration-300 shadow-md flex flex-col items-center justify-center text-center";

  const feedbackClasses = {
    correct: 'bg-green-800/50 border-green-500',
    incorrect: 'bg-red-800/50 border-red-500',
    none: ''
  };

  let appliedClasses = '';

  if (feedback !== 'none') {
    appliedClasses = feedbackClasses[feedback];
  } else if (isTargetedForSelection) {
    // Any box is a target when a word is selected. This indicates "place here" or "replace here".
    appliedClasses = 'bg-slate-600 scale-105 ring-4 ring-sky-400 shadow-xl border-sky-500 cursor-pointer';
  } else if (matchedWord) {
    // A word is placed, but no word is currently selected in the bank. Indicates "pick up".
    appliedClasses = 'bg-slate-800 border-sky-700 cursor-pointer hover:bg-slate-700'; // Simple blue border
  } else {
    // Default, empty, not a target.
    appliedClasses = 'bg-slate-700 border-slate-600 cursor-default';
  }


  return (
    <div className={`${baseClasses} ${appliedClasses}`} onClick={onClick}>
      <div className="min-h-[2.5rem] mb-2 flex items-center justify-center">
        {feedback === 'incorrect' ? (
          <div className="text-center">
            {matchedWord && <p className="font-bold text-red-400 text-lg line-through">{matchedWord}</p>}
            <p className="font-bold text-green-400 text-lg">{correctWord}</p>
          </div>
        ) : feedback === 'correct' ? (
           <p className="font-bold text-green-300 text-lg">{matchedWord}</p>
        ) : matchedWord ? (
           <p className="font-bold text-sky-400 text-lg">{matchedWord}</p>
        ) : (
          isTargetedForSelection && <span className="text-slate-400">Click to place word...</span>
        )}
      </div>
      <p className="text-slate-200 text-sm md:text-base">{definition}</p>
    </div>
  );
};

export default DefinitionBox;