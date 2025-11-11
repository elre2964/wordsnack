
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Word, TargetDefinition, GameState, FeedbackType, LoadedVocabSet, VocabSetInfo } from './types';
import WordPill from './components/WordPill';
import DefinitionBox from './components/DefinitionBox';
import Flashcard from './components/Flashcard';
import WordOfTheDay from './components/WordOfTheDay';

// Make SheetJS library available in the component
declare const XLSX: any;

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
  const [error, setError] = useState<string | null>(null);

  // Vocabulary Set Management
  const [availableSets, setAvailableSets] = useState<VocabSetInfo[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [wordOfTheDay, setWordOfTheDay] = useState<Word | null>(null);
  
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

  useEffect(() => {
    const fetchManifestAndWordOfTheDay = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/data/manifest.json');
        if (!response.ok) {
          throw new Error('Vocabulary manifest not found.');
        }
        const manifestData: VocabSetInfo[] = await response.json();
        setAvailableSets(manifestData);
        
        // Fetch a word of the day from the first set for initial display
        if (manifestData.length > 0) {
          const firstSet = manifestData[0];
          const setResponse = await fetch(firstSet.path);
          if (!setResponse.ok) throw new Error(`Failed to load word of the day set.`);
          const data = await setResponse.arrayBuffer();
          const workbook = XLSX.read(data);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawWords: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          if (rawWords.length > 0) {
            const randomWord = rawWords[Math.floor(Math.random() * rawWords.length)];
            const definitions = [randomWord.definition_1, randomWord.definition_2, randomWord.definition_3, randomWord.definition_4].filter(Boolean);
            const examples = [randomWord.example_1, randomWord.example_2].filter(Boolean);
            
            setWordOfTheDay({
              id: `${firstSet.name.replace(/\s/g, '_')}-${randomWord.word.replace(/\s/g, '_')}-wod`,
              word: randomWord.word,
              partOfSpeech: randomWord.part_of_speech || 'N/A',
              definitions,
              examples,
              flashcard: { translation: randomWord.translation || '', explanation: '' },
              setName: firstSet.name,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
        setError("Could not load vocabulary sets. Please ensure 'data/manifest.json' and associated files are available.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchManifestAndWordOfTheDay();
  }, []);

  const handleSetSelectionChange = (setId: string) => {
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

  const prepareForGame = async () => {
    if (selectedSetIds.size === 0) return;
    setIsLoading(true);
    setError(null);

    const setsToLoad = availableSets.filter(set => selectedSetIds.has(set.id));

    try {
      const loadedSetsPromises = setsToLoad.map(async (setInfo): Promise<LoadedVocabSet> => {
        const response = await fetch(setInfo.path);
         if (!response.ok) {
          throw new Error(`Vocabulary file not found at ${setInfo.path}`);
        }
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawWords: any[] = XLSX.utils.sheet_to_json(worksheet);

        const setName = setInfo.name;
        
        const transformedWords: Word[] = rawWords
          .filter(rawWord => rawWord.word) // Ensure word column exists
          .map((rawWord, index) => {
            const definitions = [
              rawWord.definition_1,
              rawWord.definition_2,
              rawWord.definition_3,
              rawWord.definition_4,
            ].filter(d => d && typeof d === 'string');
            
            const examples = [
              rawWord.example_1,
              rawWord.example_2,
            ].filter(e => e && typeof e === 'string');

            return {
              id: `${setName.replace(/\s/g, '_')}-${rawWord.word.replace(/\s/g, '_')}-${index}`,
              word: rawWord.word,
              partOfSpeech: rawWord.part_of_speech || 'none',
              definitions,
              examples,
              flashcard: {
                translation: rawWord.translation || '',
                explanation: '', // This field is not in the xlsx
              },
              setName: setName,
            };
          });

        return {
          id: setInfo.id,
          name: setName,
          words: transformedWords,
        };
      });

      const loadedSets = await Promise.all(loadedSetsPromises);
      
      setAllWords(loadedSets.flatMap(set => set.words));
      setAppScreen('MODE_SELECTION');

    } catch (err) {
      console.error("Failed to load or parse vocabulary from XLSX file:", err);
      setError(`Error loading vocabulary. Please make sure the selected files exist in the /data directory and are formatted correctly.`);
      setAppScreen('HOME');
    } finally {
      setIsLoading(false);
    }
  };


  const setupNewQuestion = useCallback((mode: GameMode) => {
    // Reset states for all modes
    setQuestionState('question');
    setSelectedOptionId(null);
    setSelectedWordId(null);
    setUserMatches(new Map());
    setGameState('PRACTICING');

    setGameMode(mode);

    if (allWords.length === 0) {
      setError("No words were loaded. Cannot start the game.");
      setAppScreen('HOME');
      return;
    }

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

  if (isLoading && appScreen === 'HOME') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner"></div>
          <p className="text-2xl text-slate-300 font-lexend">Loading Vocabulary...</p>
        </div>
      </div>
    );
  }

  if (appScreen === 'HOME') {
    return (
      <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center justify-center animate-fadeIn">
        <header className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-sky-400 font-lexend tracking-tighter">Vocabulary Matcher</h1>
            <p className="text-slate-400 mt-2 text-lg">Select your vocabulary sets to begin your practice.</p>
        </header>

        {wordOfTheDay && <WordOfTheDay wordData={wordOfTheDay} />}
        
        {error && <p className="text-red-400 bg-red-900/50 p-4 rounded-lg my-6 max-w-lg text-center animate-scaleUp">{error}</p>}

        <div className="w-full max-w-lg bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 mt-8 animate-scaleUp">
            <h2 className="text-2xl font-bold text-center text-slate-300 mb-6 font-lexend">Available Sets</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {availableSets.map(set => (
                <label key={set.id} className="flex items-center p-3 bg-slate-900/50 rounded-lg border-2 border-slate-700 hover:bg-slate-700/50 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-900/30 has-[:checked]:ring-2 has-[:checked]:ring-sky-500/50 transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSetIds.has(set.id)}
                    onChange={() => handleSetSelectionChange(set.id)}
                    className="h-6 w-6 rounded border-gray-300 text-sky-600 focus:ring-sky-500 accent-sky-500 bg-slate-800"
                  />
                  <span className="ml-4 text-lg font-medium text-slate-200">{set.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-slate-400 mb-4">Sets selected: <span className="font-bold text-xl text-sky-400">{selectedSetIds.size}</span></p>
              <button
                onClick={prepareForGame}
                disabled={selectedSetIds.size === 0}
                className="w-full px-8 py-4 bg-gradient-to-br from-green-600 to-teal-500 text-white font-bold text-xl rounded-lg shadow-lg hover:from-green-500 hover:to-teal-400 transition-all duration-300 disabled:from-slate-600 disabled:to-slate-500 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 active:scale-100"
              >
                {isLoading ? <div className="spinner mx-auto" style={{width: '28px', height: '28px', borderLeftColor: '#fff'}}></div> : 'Choose Game Mode'}
              </button>
            </div>
          </div>
      </div>
    );
  }

  if (appScreen === 'MODE_SELECTION') {
     return (
      <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center justify-center animate-fadeIn">
        <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-sky-400 font-lexend">Choose a Game Mode</h1>
            <p className="text-slate-400 mt-2 text-lg">How would you like to practice?</p>
        </header>
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <button onClick={() => setupNewQuestion('MATCHING')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-sky-500 transition-all transform hover:scale-105 animate-scaleUp" style={{animationDelay: '100ms'}}>
                <h2 className="text-2xl font-bold text-sky-400 mb-2 font-lexend">Match Definitions</h2>
                <p className="text-slate-300">The classic game. Match words from the bank to their correct definitions.</p>
            </button>
            <button onClick={() => setupNewQuestion('REVERSE_MATCH')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-purple-500 transition-all transform hover:scale-105 animate-scaleUp" style={{animationDelay: '200ms'}}>
                <h2 className="text-2xl font-bold text-purple-400 mb-2 font-lexend">Reverse Match</h2>
                <p className="text-slate-300">A new challenge. Read a definition and pick the correct word from four options.</p>
            </button>
            <button onClick={() => setupNewQuestion('FILL_IN_THE_BLANK')} className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-amber-500 transition-all transform hover:scale-105 animate-scaleUp" style={{animationDelay: '300ms'}}>
                <h2 className="text-2xl font-bold text-amber-400 mb-2 font-lexend">Fill in the Blank</h2>
                <p className="text-slate-300">Test your context skills. Complete a sentence by choosing the correct missing word.</p>
            </button>
        </div>
         <button 
          onClick={() => {
            setAppScreen('HOME');
            setSelectedSetIds(new Set());
            setAllWords([]);
          }}
          className="mt-12 text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors"
        >
          &larr; Back to Set Selection
        </button>
      </div>
     )
  }

  const renderGameContent = () => {
    switch(gameMode) {
      case 'MATCHING':
        return (
          <>
            <div className="w-full bg-slate-900/30 border-2 border-slate-700 rounded-xl p-4 mb-8 backdrop-blur-sm animate-scaleUp">
              <h2 className="text-2xl font-bold text-center text-slate-300 mb-4 font-lexend">Word Bank</h2>
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
               <h2 className="text-2xl font-bold text-center text-slate-300 font-lexend">Definitions</h2>
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
            <div className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl p-6 mb-8 backdrop-blur-sm text-center animate-scaleUp">
              {gameMode === 'REVERSE_MATCH' && (
                <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2 font-lexend">Which word means:</h2>
                  <p className="text-2xl text-purple-300">{currentQuestion.definition}</p>
                </>
              )}
              {gameMode === 'FILL_IN_THE_BLANK' && (
                 <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2 font-lexend">Complete the sentence:</h2>
                  <p className="text-2xl text-amber-300">{currentQuestion.sentence}</p>
                </>
              )}
            </div>
             <div className="flex flex-wrap justify-center items-center gap-4 min-h-[6rem] animate-fadeIn">
                {currentQuestion.options.map((word, index) => {
                  let feedback: 'none' | 'correct' | 'incorrect' | 'revealed' = 'none';
                  if (questionState === 'feedback') {
                    if (word.id === currentQuestion.correctWord.id) {
                      feedback = selectedOptionId === word.id ? 'correct' : 'revealed';
                    } else if (word.id === selectedOptionId) {
                       feedback = 'incorrect';
                    }
                  }
                  return (
                    <div style={{animationDelay: `${index * 100}ms`}} className="animate-scaleUp">
                    <WordPill 
                      key={word.id}
                      word={word.word}
                      onClick={() => handleOptionSelection(word)}
                      disabled={questionState === 'feedback'}
                      feedback={feedback}
                    />
                    </div>
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
        onClick={() => {
            setAppScreen('HOME');
            setSelectedSetIds(new Set());
            setAllWords([]);
          }}
        className="absolute top-4 left-4 md:top-8 md:left-8 text-slate-300 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500 transition-colors z-20"
      >
        &larr; Home
      </button>
      <header className="text-center mb-8 pt-12 md:pt-0">
        <h1 className="text-4xl md:text-5xl font-bold text-sky-400 font-lexend">Vocabulary Practice</h1>
        {appScreen === 'GAME' && gameMode === 'MATCHING' && <p className="text-slate-400 mt-2 text-lg">Match the 3 definitions by selecting a word from the bank first.</p>}
        {appScreen === 'GAME' && gameMode === 'REVERSE_MATCH' && <p className="text-slate-400 mt-2 text-lg">Read the definition and choose the correct word.</p>}
        {appScreen === 'GAME' && gameMode === 'FILL_IN_THE_BLANK' && <p className="text-slate-400 mt-2 text-lg">Choose the word that best completes the sentence.</p>}
      </header>

      <main className="relative flex-grow w-full max-w-4xl mx-auto flex flex-col">
        {appScreen === 'GAME' && renderGameContent()}
      </main>

      <footer className="w-full flex flex-col items-center mt-8 z-10">
        <div className="mb-8 h-16">
          {appScreen === 'GAME' && gameMode === 'MATCHING' && gameState === 'PRACTICING' && (
            <button
              onClick={handleCheckAnswers}
              disabled={userMatches.size !== 3}
              className="px-8 py-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold text-xl rounded-lg shadow-lg hover:from-green-500 hover:to-green-400 transition-all duration-300 disabled:from-slate-600 disabled:to-slate-500 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 active:scale-100"
            >
              Check Answers
            </button>
          )}
          {appScreen === 'GAME' && (gameState === 'FEEDBACK' || questionState === 'feedback') && (
            <button
              onClick={handleNext}
              className="px-8 py-4 bg-gradient-to-br from-sky-600 to-sky-500 text-white font-bold text-xl rounded-lg shadow-lg hover:from-sky-500 hover:to-sky-400 transition-all duration-300 transform hover:scale-105 active:scale-100 animate-scaleUp"
            >
              Next Round &rarr;
            </button>
          )}
        </div>

        {appScreen === 'GAME' && gameState === 'FEEDBACK' && (
          <div className="w-full max-w-5xl mt-8 animate-fadeIn">
            <h2 className="text-3xl font-bold text-center mb-6 text-amber-400 font-lexend">Flashcards Review</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {targetDefinitions.map(td => practiceWords.find(pw => pw.id === td.wordId)).filter(Boolean).map(word => (
                 <Flashcard key={word!.id} wordData={word!} />
              ))}
            </div>
          </div>
        )}

        {appScreen === 'GAME' && questionState === 'feedback' && currentQuestion && (
           <div className="w-full max-w-md mt-8 animate-fadeIn">
             <h2 className="text-3xl font-bold text-center mb-6 text-amber-400 font-lexend">Flashcard</h2>
             <Flashcard wordData={currentQuestion.correctWord} />
           </div>
        )}
      </footer>
    </div>
  );
};

export default App;