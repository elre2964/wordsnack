import React from 'react';
import type { FeedbackType } from '../types';

interface WordPillProps {
  word: string;
  onClick: () => void;
  isSelected: boolean;
  feedback: FeedbackType;
  colorSet: { bg: string; border: string; selectedRing: string };
}

const WordPill: React.FC<WordPillProps> = ({ word, onClick, isSelected, feedback, colorSet }) => {
  const baseClasses = "w-full p-4 rounded-lg border-2 transition-all duration-300 cursor-pointer shadow-md min-h-[5rem] flex items-center justify-center text-center";

  const feedbackClasses = {
    correct: 'bg-green-700 border-green-500 cursor-default',
    incorrect: 'bg-red-700 border-red-500 cursor-default',
  };

  if (feedback !== 'none') {
    return (
      <div className={`${baseClasses} ${feedbackClasses[feedback]}`}>
        <p className="font-bold text-lg text-white">{word}</p>
      </div>
    );
  }

  const { bg, border, selectedRing } = colorSet;
  let stateClasses = `${bg} ${border} hover:scale-105 hover:shadow-lg`;
  if (isSelected) {
    stateClasses = `${bg} ${border} scale-110 ring-4 ${selectedRing} shadow-xl`;
  }
  
  return (
    <div className={`${baseClasses} ${stateClasses}`} onClick={onClick}>
      <p className="font-bold text-lg text-white">{word}</p>
    </div>
  );
};

export default WordPill;
