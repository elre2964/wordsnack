import React from 'react';
import type { FeedbackType } from '../types';

interface DefinitionBoxProps {
  definition: string;
  onClick: () => void;
  isSelected: boolean;
  feedback: FeedbackType;
  matchedWord: string | null;
}

const DefinitionBox: React.FC<DefinitionBoxProps> = ({ definition, onClick, isSelected, feedback, matchedWord }) => {
  const baseClasses = "w-full min-h-[5rem] p-4 rounded-lg border-2 transition-all duration-300 shadow-md flex flex-col items-center justify-center text-center cursor-pointer";

  const feedbackClasses = {
    correct: 'bg-green-800 border-green-500 cursor-default scale-105',
    incorrect: 'bg-red-800 border-red-500 cursor-default',
  };

  let appliedClasses = '';

  if (feedback !== 'none') {
    appliedClasses = feedbackClasses[feedback];
  } else if (matchedWord) {
    appliedClasses = 'bg-slate-600 border-sky-500 scale-105';
  } else if (isSelected) {
    appliedClasses = 'bg-slate-600 scale-110 ring-4 ring-sky-400 shadow-xl border-sky-500';
  }
   else {
    appliedClasses = 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-sky-500';
  }

  return (
    <div className={`${baseClasses} ${appliedClasses}`} onClick={onClick}>
      {matchedWord && <p className="font-bold text-sky-400 mb-1 text-sm">{matchedWord}</p>}
      <p className="text-slate-200 text-sm md:text-base">{definition}</p>
    </div>
  );
};

export default DefinitionBox;
