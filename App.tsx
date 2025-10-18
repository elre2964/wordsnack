import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Word, TargetDefinition, GameState, FeedbackType, FlashcardData, VocabSetInfo, LoadedVocabSet, Match } from './types';
import WordPill from './components/WordPill';
import DefinitionBox from './components/DefinitionBox';
import Flashcard from './components/Flashcard';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

type AppScreen = 'HOME' | 'GAME';

const COLOR_PALETTE = [
  { bg: 'bg-sky-800', border: 'border-sky-600', selectedRing: 'ring-sky-400' },
  { bg: 'bg-indigo-800', border: 'border-indigo-600', selectedRing: 'ring-indigo-400' },
  { bg: 'bg-pink-800', border: 'border-pink-600', selectedRing: 'ring-pink-400' },
  { bg: 'bg-amber-800', border: 'border-amber-600', selectedRing: 'ring-amber-400' },
  { bg: 'bg-teal-800', border: 'border-teal-600', selectedRing: 'ring-teal-400' },
  { bg: 'bg-purple-800', border: 'border-purple-600', selectedRing: 'ring-purple-400' },
];

const App: React.FC = () => {
  // Global App State
  const [appScreen, setAppScreen] = useState<AppScreen>('HOME');
  const [isLoading, setIsLoading] = useState(true);
  const [vocabSets, setVocabSets] = useState<LoadedVocabSet[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  
  // Game-specific State
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [targetDefinitions, setTargetDefinitions] = useState<TargetDefinition[]>([]);
  const [shuffledDefinitions, setShuffledDefinitions] = useState<TargetDefinition[]>([]);
  const [gameState, setGameState] = useState<GameState>('PRACTICING');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Map<string, string>>(new Map()); // Maps Definition -> WordID
  const [wordColors, setWordColors] = useState<Map<string, typeof COLOR_PALETTE[0]>>(new Map());
  
  // Data Loading
  useEffect(() => {
    const fetchVocabSets = async () => {
      try {
        const manifestResponse = await fetch('/data/manifest.json');
        const manifest: VocabSetInfo[] = await manifestResponse.json();
        
        const loadedSets = await Promise.all(
          manifest.map(async (setInfo) => {
            const response = await fetch(setInfo.path);
            const data: any[] = await response.json();
            const transformedWords: Word[] = data.map(item => ({
              ...item,
              id: item.collision_group_id,
              partOfSpeech: item.pos,
              flashcard: { translation: item.translation_meaning || '', explanation: '' },
            }));
            return { ...setInfo, words: transformedWords };
          })
        );
        setVocabSets(loadedSets);
      } catch (error) {
        console.error("Failed to load vocabulary sets:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVocabSets();
  }, []);

  const setupNewGame = useCallback((words: Word[]) => {
    setUserMatches(new Map());
    setSelectedWordId(null);
    setSelectedDefinition(null);

    const availableWords = shuffleArray(words);
    const newPracticeWords: Word[] = [];
    const forbiddenGroupIds = new Set<string>();

    for (const word of availableWords) {
      if (newPracticeWords.length >= 6) break;
      
      const groupId = word.collision_group_id;
      if (!groupId || !forbiddenGroupIds.has(groupId)) {
        newPracticeWords.push(word);
        if (groupId) forbiddenGroupIds.add(groupId);
      }
    }
    
    // Assign colors to the practice words
    const newWordColors = new Map<string, typeof COLOR_PALETTE[0]>();
    newPracticeWords.forEach((word, index) => {
      newWordColors.set(word.id, COLOR_PALETTE[index % COLOR_PALETTE.length]);
    });
    setWordColors(newWordColors);

    const targetWords = shuffleArray(newPracticeWords).slice(0, 3);
    
    const newTargetDefinitions = targetWords.map(word => ({
      wordId: word.id,
      definition: word.definitions[Math.floor(Math.random() * word.definitions.length)],
    }));

    setPracticeWords(newPracticeWords);
    setTargetDefinitions(newTargetDefinitions);
    setShuffledDefinitions(shuffleArray(newTargetDefinitions));
    setGameState('PRACTICING');
  }, []);

  const handleWordClick = (wordId: string) => {
    if (gameState !== 'PRACTICING') return;

    const newMatches = new Map(userMatches);
    const defForThisWord = Array.from(newMatches.entries()).find(([, wId]) => wId === wordId)?.[0];

    if (selectedDefinition) {
        // A definition is selected, intending a match.
        // If the target word is already matched, remove its old match.
        if (defForThisWord) {
            newMatches.delete(defForThisWord);
        }
        // Create the new match (this also overwrites any existing match for the selected definition).
        newMatches.set(selectedDefinition, wordId);
        setUserMatches(newMatches);
        setSelectedDefinition(null);
        setSelectedWordId(null);
    } else {
        // No definition selected. User is selecting a word or un-matching.
        if (defForThisWord) {
            // It's already matched, so un-match it.
            newMatches.delete(defForThisWord);
            setUserMatches(newMatches);
        } else {
            // Not matched, so toggle selection.
            setSelectedDefinition(null);
            setSelectedWordId(prev => (prev === wordId ? null : wordId));
        }
    }
};

const handleDefinitionClick = (definition: string) => {
    if (gameState !== 'PRACTICING') return;

    const newMatches = new Map(userMatches);
    
    if (selectedWordId) {
        // A word is selected, intending a match.
        // If the selected word is already matched, remove its old match.
        const defForThisWord = Array.from(newMatches.entries()).find(([, wId]) => wId === selectedWordId)?.[0];
        if (defForThisWord) {
            newMatches.delete(defForThisWord);
        }
        // Create new match (overwrites any existing match for this definition).
        newMatches.set(definition, selectedWordId);
        setUserMatches(newMatches);
        setSelectedWordId(null);
        setSelectedDefinition(null);
    } else {
        // No word is selected. User is either selecting a definition or un-matching one.
        if (newMatches.has(definition)) {
            // It's already matched, so un-match it.
            newMatches.delete(definition);
            setUserMatches(newMatches);
        } else {
            // Not matched, so toggle its selection.
            setSelectedWordId(null);
            setSelectedDefinition(prev => (prev === definition ? null : definition));
        }
    }
};
  
  const correctMatches = useMemo(() => targetDefinitions, [targetDefinitions]);

  const handleCheck = () => {
    if (userMatches.size === 3) {
      setGameState('FEEDBACK');
      setSelectedWordId(null);
      setSelectedDefinition(null);
    }
  };

  const handleNext = () => {
    setupNewGame(allWords);
  };

  const getFeedbackForWord = (wordId: string): FeedbackType => {
      if (gameState !== 'FEEDBACK') return 'none';
      
      const userMatchDef = Array.from(userMatches.entries()).find(([, wId]) => wId === wordId)?.[0];
      if (!userMatchDef) return 'none'; 

      const correctWordForDef = correctMatches.find(cm => cm.definition === userMatchDef)?.wordId;
      
      if (targetDefinitions.some(td => td.wordId === wordId)) { // Is it a target word?
         return wordId === correctWordForDef ? 'correct' : 'incorrect';
      }
      
      return 'incorrect'; // User matched a non-target word.
  };

  const getFeedbackForDefinition = (definition: string): FeedbackType => {
      if (gameState !== 'FEEDBACK' || !userMatches.has(definition)) return 'none';
      const userWordId = userMatches.get(definition);
      const correctWordId = correctMatches.find(cm => cm.definition === definition)?.wordId;
      return userWordId === correctWordId ? 'correct' : 'incorrect';
  };

  const handleToggleSet = (setId: string) => {
    setSelectedSetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = () => {
    const allIds = new Set(vocabSets.map(set => set.id));
    setSelectedSetIds(allIds);
  };

  const handleClearAll = () => {
    setSelectedSetIds(new Set());
  };

  const handleStartGame = () => {
    if (selectedSetIds.size === 0) return;
    const selectedWords = vocabSets
      .filter(set => selectedSetIds.has(set.id))
      .flatMap(set => set.words);
    
    setAllWords(selectedWords);
    setupNewGame(selectedWords);
    setAppScreen('GAME');
  };

  const totalSelectedWords = useMemo(() => {
    return vocabSets
      .filter(set => selectedSetIds.has(set.id))
      .reduce((sum, set) => sum + set.words.length, 0);
  }, [vocabSets, selectedSetIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-2xl animate-pulse">Loading Vocabulary...</p>
      </div>
    );
  }

  if (appScreen === 'HOME') {
    return (
       <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center justify-center">
        <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Vocabulary Matcher</h1>
            <p className="text-slate-400 mt-2">Choose which vocabulary sets you want to practice.</p>
        </header>
        <div className="w-full max-w-lg bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between mb-4 gap-4">
            <button onClick={handleSelectAll} className="flex-1 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-500 transition-colors">Select All</button>
            <button onClick={handleClearAll} className="flex-1 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500 transition-colors">Clear All</button>
          </div>
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            {vocabSets.map(set => (
              <label key={set.id} className="flex items-center p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedSetIds.has(set.id)}
                  onChange={() => handleToggleSet(set.id)}
                  className="h-6 w-6 rounded bg-slate-800 border-slate-500 text-sky-500 focus:ring-sky-500"
                />
                <span className="ml-4 font-semibold text-lg text-slate-200">{set.name}</span>
                <span className="ml-auto text-sm bg-slate-800 text-sky-400 px-3 py-1 rounded-full">{set.words.length} words</span>
              </label>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-slate-400 mb-4">Total words selected: <span className="font-bold text-xl text-sky-400">{totalSelectedWords}</span></p>
            <button
              onClick={handleStartGame}
              disabled={selectedSetIds.size === 0}
              className="w-full px-8 py-4 bg-green-600 text-white font-bold text-xl rounded-lg shadow-lg hover:bg-green-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col relative">
      <button 
        onClick={() => setAppScreen('HOME')}
        className="absolute top-4 left-4 md:top-8 md:left-8 text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors z-20"
      >
        &larr; Change Sets
      </button>
      <header className="text-center mb-8 pt-12 md:pt-0">
        <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Vocabulary Matcher</h1>
        <p className="text-slate-400 mt-2">Connect 3 words to their definitions.</p>
      </header>

      <main className="flex-grow w-full max-w-5xl mx-auto relative mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-16 gap-y-4">
          {/* Left Column for Words */}
          <div className="space-y-4 flex flex-col justify-around">
              <h2 className="text-2xl font-bold text-center text-slate-300">Words</h2>
              {practiceWords.map(word => (
                  <div key={word.id}>
                      <WordPill 
                        word={word.word}
                        onClick={() => handleWordClick(word.id)}
                        isSelected={selectedWordId === word.id}
                        feedback={getFeedbackForWord(word.id)}
                        colorSet={wordColors.get(word.id)!}
                      />
                  </div>
              ))}
          </div>
          {/* Right Column for Definitions */}
          <div className="space-y-4 flex flex-col justify-around">
              <h2 className="text-2xl font-bold text-center text-slate-300">Definitions</h2>
              {shuffledDefinitions.map(({ definition }) => {
                const userWordId = userMatches.get(definition);
                const matchedWord = userWordId ? (practiceWords.find(w => w.id === userWordId)?.word || null) : null;
                
                return (
                  <div key={definition}>
                      <DefinitionBox 
                        definition={definition}
                        onClick={() => handleDefinitionClick(definition)}
                        isSelected={selectedDefinition === definition}
                        feedback={getFeedbackForDefinition(definition)}
                        matchedWord={matchedWord}
                      />
                  </div>
                );
              })}
          </div>
        </div>
      </main>

      <footer className="w-full flex flex-col items-center">
        <div className="mb-8">
          {gameState === 'PRACTICING' ? (
            <button
              onClick={handleCheck}
              disabled={userMatches.size !== 3}
              className="px-8 py-4 bg-green-600 text-white font-bold text-xl rounded-lg shadow-lg hover:bg-green-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check Answers
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-8 py-4 bg-sky-600 text-white font-bold text-xl rounded-lg shadow-lg hover:bg-sky-500 transition-all duration-300"
            >
              Next Practice
            </button>
          )}
        </div>

        {gameState === 'FEEDBACK' && (
          <div className="w-full max-w-5xl mt-8">
            <h2 className="text-3xl font-bold text-center mb-6 text-amber-400">Flashcards Review</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {practiceWords.map(word => (
                <Flashcard key={word.id} wordData={word} />
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};

export default App;
