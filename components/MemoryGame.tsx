
import React, { useState, useEffect } from 'react';
import type { Word, MemoryCardType } from '../types';

interface MemoryGameProps {
  words: Word[];
  onComplete: (score: number) => void;
  onMatch: () => void;
  onMismatch: () => void;
}

const MemoryGame: React.FC<MemoryGameProps> = ({ words, onComplete, onMatch, onMismatch }) => {
  const [cards, setCards] = useState<MemoryCardType[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    // Initialize game
    if (words.length === 0) return;

    // Select up to 6 words for a 4x3 grid
    const gameWords = words.slice(0, 6);
    
    const newCards: MemoryCardType[] = [];
    gameWords.forEach(word => {
      newCards.push({
        id: `${word.id}-word`,
        content: word.word,
        type: 'word',
        wordId: word.id,
        isFlipped: false,
        isMatched: false
      });
      newCards.push({
        id: `${word.id}-def`,
        content: word.definitions[0] || "No definition",
        type: 'definition',
        wordId: word.id,
        isFlipped: false,
        isMatched: false
      });
    });

    // Shuffle
    const shuffled = newCards.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setMatchedCount(0);
    setFlippedCards([]);
    setMoves(0);
  }, [words]);

  const handleCardClick = (index: number) => {
    if (isProcessing || cards[index].isFlipped || cards[index].isMatched) return;

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, index];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      setMoves(m => m + 1);
      checkForMatch(newFlipped, newCards);
    }
  };

  const checkForMatch = (flippedIndices: number[], currentCards: MemoryCardType[]) => {
    const card1 = currentCards[flippedIndices[0]];
    const card2 = currentCards[flippedIndices[1]];

    if (card1.wordId === card2.wordId) {
      // Match!
      onMatch();
      setTimeout(() => {
        const matchedCards = currentCards.map((card, idx) => 
          flippedIndices.includes(idx) ? { ...card, isMatched: true } : card
        );
        setCards(matchedCards);
        setFlippedCards([]);
        setIsProcessing(false);
        
        const newMatchedCount = matchedCount + 1;
        setMatchedCount(newMatchedCount);
        
        if (newMatchedCount === currentCards.length / 2) {
            // Calculate simplistic score based on moves. 
            // Optimal moves = 6. Each extra move reduces score.
            const baseScore = 1000;
            const penalty = (moves - 6) * 50;
            const finalScore = Math.max(100, baseScore - penalty);
            setTimeout(() => onComplete(finalScore), 500);
        }
      }, 400); // Shorter delay
    } else {
      // No match
      onMismatch();
      setTimeout(() => {
        const resetCards = currentCards.map((card, idx) => 
          flippedIndices.includes(idx) ? { ...card, isFlipped: false } : card
        );
        setCards(resetCards);
        setFlippedCards([]);
        setIsProcessing(false);
      }, 800); // Wait time to see the cards before flipping back
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4 px-4">
             <h2 className="text-2xl font-bold text-slate-300 font-lexend">Memory Match</h2>
             <span className="text-sky-400 font-mono text-lg">Moves: {moves}</span>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {cards.map((card, index) => (
            <div 
            key={card.id} 
            onClick={() => handleCardClick(index)}
            className={`
                relative aspect-square cursor-pointer perspective-1000 transition-all duration-300
                ${card.isMatched ? 'cursor-default' : 'hover:scale-105 active:scale-95'}
            `}
            >
            <div className={`
                w-full h-full rounded-xl shadow-xl transition-all duration-500 transform-style-preserve-3d
                ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : ''}
            `}>
                {/* Front of card (hidden state) */}
                <div className="absolute w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700/50 rounded-xl flex items-center justify-center backface-hidden">
                    <div className="w-full h-full flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
                    <span className="absolute text-4xl text-sky-500/20 font-bold">?</span>
                </div>

                {/* Back of card (revealed state) */}
                <div className={`
                    absolute w-full h-full rounded-xl flex items-center justify-center p-3 text-center backface-hidden [transform:rotateY(180deg)] overflow-hidden border-2
                    ${card.isMatched 
                        ? 'bg-emerald-900/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : card.type === 'word' 
                            ? 'bg-indigo-900/90 border-indigo-500/50' 
                            : 'bg-sky-900/90 border-sky-500/50'}
                `}>
                    <div className="w-full h-full flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
                        <p className={`font-lexend font-bold leading-snug ${card.type === 'word' ? 'text-lg md:text-2xl text-white' : 'text-xs md:text-sm text-slate-200'}`}>
                            {card.content}
                        </p>
                    </div>
                </div>
            </div>
            </div>
        ))}
        </div>
    </div>
  );
};

export default MemoryGame;
