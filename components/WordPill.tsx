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
  const baseClasses = "p-3 rounded-full border-2 transition-all duration-300 shadow-lg flex items-center justify-center text-center transform w-auto min-w-[150px] px-6 font-lexend";
  
  let stateClasses = "";

  switch (feedback) {
    case 'correct':
      stateClasses = "bg-green-500 border-green-300 ring-4 ring-green-500/50 cursor-default scale-105 shadow-green-500/30 shadow-xl";
      break;
    case 'incorrect':
      stateClasses = "bg-red-500 border-red-300 ring-4 ring-red-500/50 cursor-default scale-95 opacity-70 shadow-red-500/30 shadow-lg";
      break;
    case 'revealed':
      stateClasses = "bg-teal-500 border-teal-300 ring-4 ring-teal-500/50 cursor-default scale-105 shadow-teal-500/30 shadow-xl";
      break;
    default: // 'none'
      if (isSelected) {
        stateClasses = "bg-sky-500 border-sky-300 ring-4 ring-sky-500/50 shadow-sky-500/40 shadow-xl scale-110 cursor-pointer";
      } else if (isUsed) {
        stateClasses = "opacity-0 pointer-events-none scale-90"; 
      } else if (disabled) {
         stateClasses = "bg-slate-700/60 border-slate-600 opacity-30 cursor-not-allowed";
      } else {
        stateClasses = "bg-slate-800/80 border-slate-600 hover:bg-sky-900/50 hover:border-sky-500 hover:scale-105 hover:shadow-sky-500/20 cursor-pointer active:scale-100";
      }
  }
  
  return (
    <button className={`${baseClasses} ${stateClasses}`} onClick={!disabled && !isUsed ? onClick : undefined} disabled={disabled || isUsed}>
      <p className="font-bold text-lg text-white whitespace-nowrap">{word}</p>
    </button>
  );
};

export default WordPill;