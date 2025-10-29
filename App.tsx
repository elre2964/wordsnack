
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// FIX: Import RawWordData to correctly type data from JSON files.
import type { Word, TargetDefinition, GameState, FeedbackType, VocabSetInfo, LoadedVocabSet, RawWordData } from './types';
import WordPill from './components/WordPill';
import DefinitionBox from './components/DefinitionBox';
import Flashcard from './components/Flashcard';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

type AppScreen = 'HOME' | 'MODE_SELECTION' | 'GAME';
type GameMode = 'MATCHING' | 'REVERSE_MATCH' | 'FILL_IN_THE_BLANK';

interface Question {
  correctWord: Word;
  options: Word[];
  // For Reverse Match
  definition?: string;
  // For Fill in the Blank
  sentence?: string;
  blankWord?: string;
}


const App: React.FC = () => {
  // Global App State
  const [appScreen, setAppScreen] = useState<AppScreen>('HOME');
  const [isLoading, setIsLoading] = useState(true);
  const [vocabSets, setVocabSets] = useState<LoadedVocabSet[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Word[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Game-specific State
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('MATCHING');

  // State for Matching Game
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [targetDefinitions, setTargetDefinitions] = useState<TargetDefinition[]>([]);
  const [shuffledDefinitions, setShuffledDefinitions] = useState<TargetDefinition[]>([]);
  const [gameState, setGameState] = useState<GameState>('PRACTICING');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Map<string, string>>(new Map()); // Maps Definition -> WordID

  // State for New Game Modes
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionState, setQuestionState] = useState<'question' | 'feedback'>('question');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);


  // Data Loading
  useEffect(() => {
    const fetchVocabSets = async () => {
      try {
        const manifestResponse = await fetch('/data/manifest.json');
        const manifest: VocabSetInfo[] = await manifestResponse.json();
        
        const loadedSets = await Promise.all(
          manifest.map(async (setInfo) => {
            const response = await fetch(setInfo.path);
            // FIX: Use RawWordData to type the fetched JSON data, resolving errors with 'unknown' type.
            const data: RawWordData[] = await response.json();
            // FIX: Explicitly type 'item' as RawWordData to allow property access and ensure correct type inference for 'transformedWords'. This resolves cascading type errors throughout the component.
            const transformedWords: Word[] = data.map((item: RawWordData) => ({
              ...item,
              id: item.collision_group_id,
              partOfSpeech: item.pos,
              flashcard: { translation: item.translation_meaning || '', explanation: '' },
              setName: setInfo.name,
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

  const allWordsFromAllSets = useMemo(() => {
    return vocabSets.flatMap(set => set.words);
  }, [vocabSets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
        setSearchResults([]);
        setHasSearched(true);
        return;
    }
    const query = searchQuery.trim().toLowerCase();
    
    const results = allWordsFromAllSets.filter(word => 
        word.word.toLowerCase().includes(query)
    );
    
    const uniqueResults = results.filter((word, index, self) => 
        index === self.findIndex(w => w.word === word.word && w.setName === word.setName)
    );

    setSearchResults(uniqueResults);
    setHasSearched(true);
  };


  const setupNewQuestion = useCallback((mode: GameMode) => {
    // Reset states for all modes
    setQuestionState('question');
    setSelectedOptionId(null);
    setSelectedWordId(null);
    setUserMatches(new Map());
    setGameState('PRACTICING');

    setGameMode(mode);

    if (mode === 'MATCHING') {
      const availableWords = shuffleArray(allWords);
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
      
      const targetWords = shuffleArray(newPracticeWords).slice(0, 3);
      
      const newTargetDefinitions = targetWords.map(word => ({
        wordId: word.id,
        definition: word.definitions[Math.floor(Math.random() * word.definitions.length)],
      }));

      setPracticeWords(newPracticeWords);
      setTargetDefinitions(newTargetDefinitions);
      setShuffledDefinitions(shuffleArray(newTargetDefinitions));
    } else if (mode === 'REVERSE_MATCH') {
       const shuffled = shuffleArray(allWords);
       if (shuffled.length < 4) return;
       
       const correctWord = shuffled[0];
       const definition = correctWord.definitions[Math.floor(Math.random() * correctWord.definitions.length)];
       const options = shuffleArray(shuffled.slice(0, 4));
       
       setCurrentQuestion({ definition, options, correctWord });

    } else if (mode === 'FILL_IN_THE_BLANK') {
       const wordsWithExamples = shuffleArray(allWords.filter(w => w.examples && w.examples.length > 0));
       if (wordsWithExamples.length < 4) return; // Not enough data for this mode

       const correctWord = wordsWithExamples[0];
       const exampleSentence = correctWord.examples[Math.floor(Math.random() * correctWord.examples.length)];
       const blankWord = correctWord.word;
       const sentenceWithBlank = exampleSentence.replace(new RegExp(`\\b${blankWord}\\b`, 'i'), '_______');

       const distractors = wordsWithExamples.slice(1, 4);
       const options = shuffleArray([correctWord, ...distractors]);

       setCurrentQuestion({ sentence: sentenceWithBlank, blankWord, options, correctWord });
    }
    
    setAppScreen('GAME');
  }, [allWords]);

  const handleWordClick = (wordId: string) => {
    if (gameState !== 'PRACTICING') return;
    setSelectedWordId(prev => (prev === wordId ? null : wordId));
  };

  const handleDefinitionClick = (definition: string) => {
    if (gameState !== 'PRACTICING') return;

    const newMatches = new Map(userMatches);
    const wordIdInBox = newMatches.get(definition);

    if (selectedWordId) {
        if (wordIdInBox === selectedWordId) {
            setSelectedWordId(null);
            return;
        }
        for (const [def, wId] of newMatches.entries()) {
            if (wId === selectedWordId) {
                newMatches.delete(def);
                break;
            }
        }
        newMatches.set(definition, selectedWordId);
        setUserMatches(newMatches);
        setSelectedWordId(null);
    } else if (wordIdInBox) {
        newMatches.delete(definition);
        setUserMatches(newMatches);
        setSelectedWordId(wordIdInBox);
    }
  };
  
  const correctMatches = useMemo(() => targetDefinitions, [targetDefinitions]);

  const handleCheckAnswers = () => {
    if (userMatches.size === 3) {
      setGameState('FEEDBACK');
      setSelectedWordId(null);
    }
  };

  const handleNext = () => {
    setupNewQuestion(gameMode);
  };
  
  const getFeedbackForDefinition = (definition: string): FeedbackType => {
      if (gameState !== 'FEEDBACK' || !userMatches.has(definition)) return 'none';
      const userWordId = userMatches.get(definition);
      const correctWordId = correctMatches.find(cm => cm.definition === definition)?.wordId;
      return userWordId === correctWordId ? 'correct' : 'incorrect';
  };

  const handleOptionSelection = (selectedWord: Word) => {
    if (questionState === 'feedback' || !currentQuestion) return;
    setSelectedOptionId(selectedWord.id);
    setQuestionState('feedback');
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

  const prepareForGame = () => {
    if (selectedSetIds.size === 0) return;
    const selectedWords = vocabSets
      .filter(set => selectedSetIds.has(set.id))
      .flatMap(set => set.words);
    
    setAllWords(selectedWords);
    setAppScreen('MODE_SELECTION');
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
            <p className="text-slate-400 mt-2">Search for a word or choose sets to practice.</p>
        </header>

        <div className="w-full max-w-lg mb-8">
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim() === '') {
                            setHasSearched(false);
                            setSearchResults([]);
                        }
                    }}
                    placeholder="Search for a word..."
                    className="flex-grow bg-slate-700/80 border-2 border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                    aria-label="Search for a word"
                />
                <button type="submit" className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-500 transition-colors">
                    Search
                </button>
            </form>
        </div>

        {hasSearched ? (
            <div className="w-full max-w-4xl">
              <div className="flex justify-start mb-4">
                  <button onClick={() => { setHasSearched(false); setSearchQuery(''); setSearchResults([]); }} className="text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors">
                      &larr; Back to Vocab Sets
                  </button>
                </div>
                {searchResults.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.map((word) => (
                            <Flashcard key={`${word.word}-${word.setName}`} wordData={word} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-8 bg-slate-800/50 rounded-xl border border-slate-700">
                        <p className="text-xl text-slate-400">No results found for "{searchQuery}".</p>
                    </div>
                )}
            </div>
        ) : (
          <div className="w-full max-w-lg bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700">
            <h2 className="text-2xl font-bold text-center text-slate-300 mb-4">Practice Sets</h2>
            <div className="flex justify-between mb-4 gap-4">
              <button onClick={handleSelectAll} className="flex-1 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-500 transition-colors">Select All</button>
              <button onClick={handleClearAll} className="flex-1 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500 transition-colors">Clear All</button>
            </div>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
              {vocabSets.map(set => (
                <label key={set.id} className="flex items-center p-4 bg-slate-700/80 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors">
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
                onClick={prepareForGame}
                disabled={selectedSetIds.size === 0}
                className="w-full px-8 py-4 bg-green-600 text-white font-bold text-xl rounded-lg shadow-lg hover:bg-green-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 active:scale-100"
              >
                Choose Game Mode
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (appScreen === 'MODE_SELECTION') {
     return (
      <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center justify-center">
        <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Choose a Game Mode</h1>
            <p className="text-slate-400 mt-2">How would you like to practice?</p>
        </header>
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <button onClick={() => setupNewQuestion('MATCHING')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-sky-500 transition-all transform hover:scale-105">
                <h2 className="text-2xl font-bold text-sky-400 mb-2">Match Definitions</h2>
                <p className="text-slate-300">The classic game. Match words from the bank to their correct definitions.</p>
            </button>
            <button onClick={() => setupNewQuestion('REVERSE_MATCH')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-sky-500 transition-all transform hover:scale-105">
                <h2 className="text-2xl font-bold text-sky-400 mb-2">Reverse Match</h2>
                <p className="text-slate-300">A new challenge. Read a definition and pick the correct word from four options.</p>
            </button>
            <button onClick={() => setupNewQuestion('FILL_IN_THE_BLANK')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-sky-500 transition-all transform hover:scale-105">
                <h2 className="text-2xl font-bold text-sky-400 mb-2">Fill in the Blank</h2>
                <p className="text-slate-300">Test your context skills. Complete a sentence by choosing the correct missing word.</p>
            </button>
        </div>
         <button 
          onClick={() => setAppScreen('HOME')}
          className="mt-12 text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors"
        >
          &larr; Change Sets
        </button>
      </div>
     )
  }

  const renderGameContent = () => {
    switch(gameMode) {
      case 'MATCHING':
        return (
          <>
            <div className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl p-4 mb-8 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-center text-slate-300 mb-4">Word Bank</h2>
              <div 
                className="flex flex-wrap justify-center items-center gap-4 min-h-[6rem] transition-all duration-300"
                role="toolbar"
                aria-label="Word bank"
              >
                {practiceWords.map(word => {
                  const isUsed = Array.from(userMatches.values()).includes(word.id);
                  return (
                    <div key={word.id}>
                      <WordPill 
                        word={word.word}
                        onClick={() => handleWordClick(word.id)}
                        isSelected={selectedWordId === word.id}
                        isUsed={gameState === 'PRACTICING' && isUsed && selectedWordId !== word.id}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-full space-y-4">
               <h2 className="text-2xl font-bold text-center text-slate-300">Definitions</h2>
                {shuffledDefinitions.map(({ definition, wordId: correctDefWordId }) => {
                  const userWordId = userMatches.get(definition);
                  const matchedWordObject = userWordId ? practiceWords.find(w => w.id === userWordId) : null;
                  const matchedWord = matchedWordObject ? matchedWordObject.word : null;
                  
                  const correctWordObject = (gameState === 'FEEDBACK' && userWordId !== correctDefWordId) ? practiceWords.find(w => w.id === correctDefWordId) : null;
                  const correctWord = correctWordObject ? correctWordObject.word : null;

                  return (
                    <div key={definition}>
                        <DefinitionBox 
                          definition={definition}
                          onClick={() => handleDefinitionClick(definition)}
                          feedback={getFeedbackForDefinition(definition)}
                          matchedWord={matchedWord}
                          correctWord={correctWord}
                          isTargetedForSelection={!!selectedWordId && userMatches.get(definition) !== selectedWordId}
                        />
                    </div>
                  );
                })}
            </div>
          </>
        );
      case 'REVERSE_MATCH':
      case 'FILL_IN_THE_BLANK':
        if (!currentQuestion) return <p>Loading question...</p>;
        return (
          <>
            <div className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl p-6 mb-8 backdrop-blur-sm text-center">
              {gameMode === 'REVERSE_MATCH' && (
                <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Which word means:</h2>
                  <p className="text-2xl text-sky-300">{currentQuestion.definition}</p>
                </>
              )}
              {gameMode === 'FILL_IN_THE_BLANK' && (
                 <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Complete the sentence:</h2>
                  <p className="text-2xl text-sky-300">{currentQuestion.sentence}</p>
                </>
              )}
            </div>
             <div className="flex flex-wrap justify-center items-center gap-4 min-h-[6rem]">
                {currentQuestion.options.map(word => {
                  let feedback: 'none' | 'correct' | 'incorrect' | 'revealed' = 'none';
                  if (questionState === 'feedback') {
                    if (word.id === currentQuestion.correctWord.id) {
                      feedback = 'revealed';
                    }
                    if (word.id === selectedOptionId) {
                      feedback = selectedOptionId === currentQuestion.correctWord.id ? 'correct' : 'incorrect';
                    }
                  }
                  return (
                    <WordPill 
                      key={word.id}
                      word={word.word}
                      onClick={() => handleOptionSelection(word)}
                      disabled={questionState === 'feedback'}
                      feedback={feedback}
                    />
                  );
                })}
             </div>
          </>
        );
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col">
       <button 
        onClick={() => setAppScreen('HOME')}
        className="absolute top-4 left-4 md:top-8 md:left-8 text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors z-20"
      >
        &larr; Change Sets / Mode
      </button>
      <header className="text-center mb-8 pt-12 md:pt-0">
        <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Vocabulary Matcher</h1>
        {gameMode === 'MATCHING' && <p className="text-slate-400 mt-2">Match the 3 definitions below by selecting a word from the bank first.</p>}
        {gameMode === 'REVERSE_MATCH' && <p className="text-slate-400 mt-2">Read the definition and choose the correct word.</p>}
        {gameMode === 'FILL_IN_THE_BLANK' && <p className="text-slate-400 mt-2">Choose the word that best completes the sentence.</p>}
      </header>

      <main className="relative flex-grow w-full max-w-4xl mx-auto flex flex-col">
        {renderGameContent()}
      </main>

      <footer className="w-full flex flex-col items-center mt-8 z-10">
        <div className="mb-8 h-16">
          {gameMode === 'MATCHING' && gameState === 'PRACTICING' && (
            <button
              onClick={handleCheckAnswers}
              disabled={userMatches.size !== 3}
              className="px-8 py-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold text-xl rounded-lg shadow-lg hover:from-green-500 hover:to-green-400 transition-all duration-300 disabled:from-slate-600 disabled:to-slate-500 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 active:scale-100"
            >
              Check Answers
            </button>
          )}
          {(gameState === 'FEEDBACK' || questionState === 'feedback') && (
            <button
              onClick={handleNext}
              className="px-8 py-4 bg-gradient-to-br from-sky-600 to-sky-500 text-white font-bold text-xl rounded-lg shadow-lg hover:from-sky-500 hover:to-sky-400 transition-all duration-300 transform hover:scale-105 active:scale-100"
            >
              Next
            </button>
          )}
        </div>

        {gameState === 'FEEDBACK' && (
          <div className="w-full max-w-5xl mt-8">
            <h2 className="text-3xl font-bold text-center mb-6 text-amber-400">Flashcards Review</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {targetDefinitions.map(td => practiceWords.find(pw => pw.id === td.wordId)).filter(Boolean).map(word => (
                 <Flashcard key={word!.id} wordData={word!} />
              ))}
            </div>
          </div>
        )}

        {questionState === 'feedback' && currentQuestion && (
           <div className="w-full max-w-md mt-8">
             <h2 className="text-3xl font-bold text-center mb-6 text-amber-400">Flashcard</h2>
             <Flashcard wordData={currentQuestion.correctWord} />
           </div>
        )}
      </footer>
    </div>
  );
};

export default App;
