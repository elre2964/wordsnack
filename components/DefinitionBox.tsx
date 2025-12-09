
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
  const baseClasses = "w-full py-4 px-4 rounded-xl border-2 transition-all duration-300 shadow-lg flex flex-col justify-center text-center backdrop-blur-md min-h-[100px]";

  const feedbackClasses = {
    correct: 'bg-green-500/10 border-green-500/50 shadow-green-500/10',
    incorrect: 'bg-red-500/10 border-red-500/50 shadow-red-500/10',
    none: 'bg-slate-800/60 border-slate-700/50 hover:border-slate-500 cursor-pointer hover:bg-slate-800/80'
  };

  let appliedClasses = feedbackClasses[feedback];

  if (feedback === 'none') {
    if (isTargetedForSelection) {
        appliedClasses = 'scale-105 ring-2 ring-cyan-400 shadow-cyan-500/30 border-cyan-500 bg-slate-800';
    } else if (matchedWord) {
        appliedClasses = 'border-slate-500 bg-slate-800/80 cursor-pointer';
    }
  }

  return (
    <div className={`${baseClasses} ${appliedClasses} relative overflow-hidden`} onClick={onClick}>
      
      {/* Definition Text */}
      <p className="text-slate-200 text-sm md:text-base font-medium leading-snug mb-3 relative z-10">
        {definition}
      </p>

      {/* Answer Area */}
      <div className="flex flex-col items-center justify-center min-h-[1.5rem] relative z-10">
        {feedback === 'incorrect' ? (
          <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-bottom-2">
            {matchedWord ? (
                 <div className="flex items-center gap-2">
                    <span className="text-red-400 text-sm line-through decoration-red-500/50 opacity-80">{matchedWord}</span>
                    <span className="text-red-500 text-xs">✕</span>
                 </div>
            ) : (
                <span className="text-red-400 text-xs italic">No match selected</span>
            )}
            <div className="flex items-center gap-1 bg-slate-950/30 px-3 py-1 rounded-full mt-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Correct:</span>
                <span className="font-bold text-green-400 text-sm font-lexend">{correctWord}</span>
            </div>
          </div>
        ) : feedback === 'correct' ? (
           <div className="flex items-center gap-2 bg-green-500/10 px-4 py-1 rounded-full animate-pop">
               <span className="text-green-400 text-lg">✓</span>
               <span className="font-bold text-green-300 text-lg font-lexend">{matchedWord}</span>
           </div>
        ) : matchedWord ? (
           <div className="bg-cyan-500/10 px-4 py-1 rounded-full border border-cyan-500/30">
               <span className="font-bold text-cyan-300 text-base font-lexend">{matchedWord}</span>
           </div>
        ) : (
          isTargetedForSelection && (
              <span className="text-cyan-400 text-xs uppercase tracking-widest font-bold animate-pulse">
                  Select Word Below
              </span>
          )
        )}
      </div>
    </div>
  );
};

export default DefinitionBox;
