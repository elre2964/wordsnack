import React from 'react';

interface WordPillProps {
  word: string;
  onClick: () => void;
  isSelected: boolean;
}

const WordPill: React.FC<WordPillProps> = ({ word, onClick, isSelected }) => {
  const baseClasses = "p-3 rounded-lg border-2 transition-all duration-300 cursor-pointer shadow-md flex items-center justify-center text-center";
  
  let stateClasses = "bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-sky-500";
  if (isSelected) {
    stateClasses = "bg-slate-600 border-sky-500 ring-4 ring-sky-400 shadow-xl scale-105";
  }
  
  return (
    <div className={`${baseClasses} ${stateClasses} w-auto px-6`} onClick={onClick}>
      <p className="font-bold text-lg text-white whitespace-nowrap">{word}</p>
    </div>
  );
};

export default WordPill;
