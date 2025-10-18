import React from 'react';

interface WordPillProps {
  word: string;
  onClick: () => void;
  isSelected?: boolean;
  isUsed?: boolean;
  feedback?: 'none' | 'correct' | 'incorrect' | 'revealed';
  disabled?: boolean;
}

const WordPill: React.FC<WordPillProps> = ({ word, onClick, isSelected, isUsed, feedback = 'none', disabled = false }) => {
  const baseClasses = "p-3 rounded-lg border-2 transition-all duration-300 shadow-lg flex items-center justify-center text-center transform w-auto min-w-[150px] px-6";
  
  let stateClasses = "";

  switch (feedback) {
    case 'correct':
      stateClasses = "bg-green-500/80 border-green-400 ring-4 ring-green-500/50 cursor-default scale-105";
      break;
    case 'incorrect':
      stateClasses = "bg-red-500/80 border-red-400 cursor-default opacity-50";
      break;
    case 'revealed':
      stateClasses = "bg-slate-700/60 border-green-500 ring-2 ring-green-500/80 cursor-default scale-105";
      break;
    default: // 'none'
      if (isSelected) {
        stateClasses = "bg-sky-500/80 border-sky-400 ring-4 ring-sky-500/50 shadow-sky-500/40 shadow-xl scale-105 cursor-pointer";
      } else if (isUsed) {
        stateClasses = "opacity-0 pointer-events-none"; // Specific to the matching game.
      } else if (disabled) {
         stateClasses = "bg-slate-700/60 border-slate-600 opacity-50 cursor-not-allowed";
      } else {
        stateClasses = "bg-slate-700/60 border-slate-600 hover:bg-slate-600 hover:border-sky-500 hover:-translate-y-0.5 cursor-pointer";
      }
  }
  
  return (
    <div className={`${baseClasses} ${stateClasses}`} onClick={!disabled ? onClick : undefined}>
      <p className="font-bold text-lg text-white whitespace-nowrap">{word}</p>
    </div>
  );
};

export default WordPill;