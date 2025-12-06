
import React, { useState, useEffect } from 'react';
import type { Word, MemoryCardType } from '../types';

interface MemoryGameProps {
  words: Word[];
  onComplete: () => void;
  onMatch: () => void; // For sound effects
  onMismatch: () => void; // For sound effects
}

const MemoryGame: React.FC<MemoryGameProps> = ({ words, onComplete, onMatch, onMismatch }) => {
  const [cards, setCards] = useState<MemoryCardType[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initialize game
    if (words.length === 0) return;

    // Select up to 6 words for a 4x3 or similar grid
    const gameWords = words.slice(0, 6);
    
    const newCards: MemoryCardType[] = [];
    gameWords.forEach(word => {
      // Card for the Word
      newCards.push({
        id: `${word.id}-word`,
        content: word.word,
        type: 'word',
        wordId: word.id,
        isFlipped: false,
        isMatched: false
      });
      // Card for the Definition (pick first one for simplicity)
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
            setTimeout(onComplete, 500);
        }
      }, 400);
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
      }, 800);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-slate-300 mb-6 font-lexend">Memory Match</h2>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {cards.map((card, index) => (
            <div 
            key={card.id} 
            onClick={() => handleCardClick(index)}
            className={`
                relative aspect-square cursor-pointer perspective-1000 transition-all duration-300
                ${card.isMatched ? 'cursor-default' : ''}
            `}
            >
            <div className={`
                w-full h-full rounded-xl shadow-lg transition-all duration-500 transform-style-preserve-3d
                ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : ''}
            `}>
                {/* Front of card (hidden state) - Now with a nice pattern */}
                <div className="absolute w-full h-full bg-slate-800 border-2 border-slate-700 rounded-xl flex items-center justify-center backface-hidden group hover:border-sky-500/50 transition-colors">
                    <div className="w-full h-full rounded-xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700/50 to-slate-900 opacity-50 flex items-center justify-center">
                         <span className="text-4xl text-slate-600 font-bold opacity-20">?</span>
                    </div>
                </div>

                {/* Back of card (revealed state) */}
                <div className={`
                    absolute w-full h-full rounded-xl flex items-center justify-center p-2 text-center backface-hidden [transform:rotateY(180deg)] overflow-hidden
                    ${card.isMatched 
                        ? 'bg-green-900/40 border-2 border-green-500/50 opacity-60 grayscale-[0.3]' 
                        : card.type === 'word' 
                            ? 'bg-purple-900/80 border-2 border-purple-500' 
                            : 'bg-sky-900/80 border-2 border-sky-500'}
                `}>
                    <div className="w-full max-h-full overflow-y-auto custom-scrollbar flex items-center justify-center">
                        <p className={`font-bold leading-tight ${card.type === 'word' ? 'text-lg md:text-xl text-white' : 'text-xs md:text-sm text-slate-200'}`}>
                            {card.content}
                        </p>
                    </div>
                    {card.isMatched && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/10">
                            <span className="text-green-400 text-4xl">✓</span>
                        </div>
                    )}
                </div>
            </div>
            </div>
        ))}
        </div>
    </div>
  );
};

export default MemoryGame;
