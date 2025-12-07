
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Word, TargetDefinition, GameState, FeedbackType, VocabSetInfo } from './types';
import WordPill from './components/WordPill';
import DefinitionBox from './components/DefinitionBox';
import Flashcard from './components/Flashcard';
import WordOfTheDay from './components/WordOfTheDay';
import MemoryGame from './components/MemoryGame';

// --- Types & Helper Functions ---

interface ParsedWordData {
  word: string;
  pos?: string;
  definitions: string[];
  examples: string[];
  translation_meaning?: string;
  collision_group_id?: string;
}

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const WIN_MESSAGES = [
    "Spectacular!",
    "Vocabulary Virtuoso!",
    "Outstanding!",
    "Brilliant!",
    "Unstoppable!",
    "Sharp Mind!",
    "Excellent Work!"
];

// --- Sound System ---
const playSound = (type: 'correct' | 'incorrect' | 'click' | 'win' | 'tick') => {
    // Check if sound is enabled globally (using a simple check here or prop)
    if (localStorage.getItem('soundEnabled') === 'false') return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'incorrect') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'win') {
             osc.type = 'triangle';
             osc.frequency.setValueAtTime(400, now);
             osc.frequency.setValueAtTime(600, now + 0.1);
             osc.frequency.setValueAtTime(800, now + 0.2);
             osc.frequency.setValueAtTime(1200, now + 0.3);
             gain.gain.setValueAtTime(0.1, now);
             gain.gain.linearRampToValueAtTime(0, now + 1);
             osc.start(now);
             osc.stop(now + 1);
        } else if (type === 'click') {
             osc.type = 'sine';
             osc.frequency.setValueAtTime(800, now);
             gain.gain.setValueAtTime(0.05, now);
             gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
             osc.start(now);
             osc.stop(now + 0.05);
        } else if (type === 'tick') {
             osc.type = 'square';
             osc.frequency.setValueAtTime(1000, now);
             gain.gain.setValueAtTime(0.03, now);
             gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
             osc.start(now);
             osc.stop(now + 0.05);
        }
    } catch (e) {
        // Audio play failed
    }
};


const loadAndParseVocabSet = async (path: string): Promise<ParsedWordData[]> => {
  const jsonPath = path.replace(/\.(xlsx|Json)$/i, '.json');
  const response = await fetch(jsonPath);

  if (!response.ok) {
    throw new Error(`Vocabulary file not found at ${jsonPath}`);
  }

  const jsonData: any[] = await response.json();
  if (!jsonData || jsonData.length === 0) return [];

  const firstWord = jsonData[0];

  if (firstWord.hasOwnProperty('definition_1')) {
    return jsonData.map((rawWord: any): ParsedWordData => {
      const definitions: string[] = [];
      const examples: string[] = [];

      Object.keys(rawWord).forEach(key => {
        if (key.startsWith('definition_')) {
          const value = rawWord[key];
          if (typeof value === 'string' && value.trim()) definitions.push(value.trim());
        } else if (key.startsWith('example_')) {
          const value = rawWord[key];
          if (typeof value === 'string' && value.trim()) examples.push(value.trim());
        }
      });
      
      return {
        word: rawWord.word || '',
        pos: rawWord.part_of_speech || '',
        definitions,
        examples,
        translation_meaning: rawWord.translation || '',
        collision_group_id: rawWord.collision_group_id || '',
      };
    });
  } else {
    return jsonData.map((rawWord: any): ParsedWordData => ({
      word: rawWord.word || '',
      pos: rawWord.pos || '',
      definitions: rawWord.definitions || [],
      examples: rawWord.examples || [],
      translation_meaning: rawWord.translation_meaning || '',
      collision_group_id: rawWord.collision_group_id || '',
    }));
  }
};

type AppScreen = 'HOME' | 'MODE_SELECTION' | 'GAME';
type GameMode = 'MATCHING' | 'REVERSE_MATCH' | 'FILL_IN_THE_BLANK' | 'MEMORY' | 'TIME_ATTACK' | 'SURVIVAL';

interface Question {
  correctWord: Word;
  options: Word[];
  definition?: string;
  sentence?: string;
  blankWord?: string;
}

const App: React.FC = () => {
  // Global App State
  const [appScreen, setAppScreen] = useState<AppScreen>('HOME');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Data
  const [availableSets, setAvailableSets] = useState<VocabSetInfo[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set<string>());
  const [wordOfTheDay, setWordOfTheDay] = useState<Word | null>(null);
  const [allVocabWords, setAllVocabWords] = useState<Word[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Word[]>([]);

  // Session Stats (Ephemeral - resets on reload)
  const [sessionScore, setSessionScore] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);

  // Game State
  const [gameWords, setGameWords] = useState<Word[]>([]); 
  const [gameMode, setGameMode] = useState<GameMode>('MATCHING');
  
  // Matching Game Specifics
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [targetDefinitions, setTargetDefinitions] = useState<TargetDefinition[]>([]);
  const [shuffledDefinitions, setShuffledDefinitions] = useState<TargetDefinition[]>([]);
  const [gameState, setGameState] = useState<GameState>('PRACTICING');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Map<string, string>>(new Map<string, string>());

  // Other Game Modes Specifics
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionState, setQuestionState] = useState<'question' | 'feedback'>('question');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  
  // Time Attack & Survival Specifics
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Results Modal
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [roundPoints, setRoundPoints] = useState(0);
  const [winMessage, setWinMessage] = useState("");


  // --- Sound Toggle ---
  const toggleSound = () => {
      const newState = !soundEnabled;
      setSoundEnabled(newState);
      localStorage.setItem('soundEnabled', String(newState));
  };

  // --- Initial Data Load ---
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const manifestResponse = await fetch('/data/manifest.json');
        const manifestData: VocabSetInfo[] = await manifestResponse.json();
        setAvailableSets(manifestData);
        
        const allSetsPromises = manifestData.map(async (setInfo): Promise<Word[]> => {
          const rawWords = await loadAndParseVocabSet(setInfo.path);
          return rawWords
            .filter(rawWord => rawWord.word && rawWord.definitions && rawWord.definitions.length > 0)
            .map((rawWord, index) => ({
              id: `${setInfo.name.replace(/\s/g, '_')}-${rawWord.word.replace(/\s/g, '_')}-${index}`,
              word: rawWord.word,
              partOfSpeech: rawWord.pos || 'N/A',
              definitions: rawWord.definitions || [],
              examples: rawWord.examples || [],
              flashcard: { translation: rawWord.translation_meaning || '', explanation: '' },
              setName: setInfo.name,
              collision_group_id: rawWord.collision_group_id,
            }));
        });
        
        const allLoadedWordsArrays = await Promise.all(allSetsPromises);
        const flattenedWords = allLoadedWordsArrays.flat();
        setAllVocabWords(flattenedWords);

        if (flattenedWords.length > 0) {
          setWordOfTheDay(flattenedWords[Math.floor(Math.random() * flattenedWords.length)]);
        }

      } catch (err) {
        console.error(err);
        setError("Failed to load vocabulary data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
    
    // Check local storage only for sound preference
    const savedSound = localStorage.getItem('soundEnabled');
    if (savedSound === 'false') setSoundEnabled(false);
  }, []);

  // --- Timer ---
  useEffect(() => {
      if (isTimerRunning && timeLeft > 0) {
          timerRef.current = window.setTimeout(() => {
              setTimeLeft(prev => prev - 1);
              if (timeLeft <= 5) playSound('tick');
          }, 1000);
      } else if (isTimerRunning && timeLeft === 0) {
          // Time Up!
          if (gameMode === 'SURVIVAL') {
             endRound(0, "Game Over!");
          } else {
             endRound(0, "Time's Up!");
          }
      }
      return () => {
          if (timerRef.current) clearTimeout(timerRef.current);
      };
  }, [isTimerRunning, timeLeft, gameMode]);


  // --- Handlers ---

  const handleSetSelectionChange = (setId: string) => {
    setSelectedSetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) newSet.delete(setId);
      else newSet.add(setId);
      return newSet;
    });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (query.trim() === '') {
        setSearchResults([]);
        return;
    }
    const filteredWords = allVocabWords.filter(word => 
        word.word.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filteredWords);
  };

  const prepareForGame = () => {
    if (selectedSetIds.size === 0) return;
    
    const selectedSetNames = new Set(
        availableSets.filter(set => selectedSetIds.has(set.id)).map(set => set.name)
    );

    const wordsForGame = allVocabWords.filter(word => selectedSetNames.has(word.setName));
    
    if (wordsForGame.length > 0) {
        setGameWords(wordsForGame);
        setAppScreen('MODE_SELECTION');
    } else {
        setError("No words found for selection.");
    }
  };

  // --- Game Mechanics ---

  const addScore = (basePoints: number) => {
      // Calculate multiplier based on combo (max 3x)
      const multiplier = Math.min(3, 1 + (currentCombo * 0.1));
      const points = Math.round(basePoints * multiplier);
      
      setSessionScore(prev => prev + points);
      setCurrentCombo(prev => prev + 1);
      return points;
  };

  const resetCombo = () => {
      setCurrentCombo(0);
  };

  const endRound = (pointsEarned: number, customMessage?: string) => {
      setIsTimerRunning(false);
      setRoundPoints(pointsEarned);
      setWinMessage(customMessage || WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)]);
      setShowRoundSummary(true);
      if (pointsEarned > 0 && customMessage !== "Game Over!") playSound('win');
      else playSound('incorrect');
  };

  const startSpecificGame = useCallback((mode: GameMode, isNextQuestion: boolean = false) => {
    // Reset Round State
    setQuestionState('question');
    setSelectedOptionId(null);
    setSelectedWordId(null);
    setUserMatches(new Map());
    setGameState('PRACTICING');
    setShowRoundSummary(false);
    setGameMode(mode);
    
    // Timer Logic
    // If it's a new game (not next question) OR if it's survival (reset timer every Q), set time.
    // Time Attack (mode='TIME_ATTACK'): 120 seconds global. Don't reset on next question.
    // Survival (mode='SURVIVAL'): 10 seconds per question. Reset on next question.
    if (!isNextQuestion) {
        if (mode === 'TIME_ATTACK') {
             setTimeLeft(120); 
             setIsTimerRunning(true);
        } else if (mode === 'SURVIVAL') {
             setTimeLeft(10);
             setIsTimerRunning(true);
        } else {
            setIsTimerRunning(false);
        }
    } else if (mode === 'SURVIVAL') {
        // Survival resets timer on every question
        setTimeLeft(10);
        setIsTimerRunning(true);
    } 
    // For Time Attack next question, we keep the existing timer running.

    if (gameWords.length === 0) {
       setError("No words loaded.");
       setAppScreen('HOME');
       return;
    }

    // Logic for setting up specific games
    if (mode === 'MATCHING') {
        const shuffledPool = shuffleArray<Word>(gameWords);
        const newPracticeWords: Word[] = [];
        const forbiddenIds = new Set<string>();

        // Ensure unique collision groups
        for (const w of shuffledPool) {
            if (newPracticeWords.length >= 6) break;
            if (!w.collision_group_id || !forbiddenIds.has(w.collision_group_id)) {
                newPracticeWords.push(w);
                if (w.collision_group_id) forbiddenIds.add(w.collision_group_id);
            }
        }

        const targetWords = shuffleArray(newPracticeWords).slice(0, 3);
        const newDefs = targetWords.map(w => ({
            wordId: w.id,
            definition: w.definitions[Math.floor(Math.random() * w.definitions.length)]
        }));

        setPracticeWords(newPracticeWords);
        setTargetDefinitions(newDefs);
        setShuffledDefinitions(shuffleArray(newDefs));
        
    } else if (mode === 'REVERSE_MATCH' || mode === 'TIME_ATTACK' || mode === 'SURVIVAL') {
        const shuffled = shuffleArray<Word>(gameWords);
        if (shuffled.length < 4) return;
        const correct = shuffled[0];
        const def = correct.definitions[Math.floor(Math.random() * correct.definitions.length)];
        const options = shuffleArray(shuffled.slice(0, 4));
        setCurrentQuestion({ correctWord: correct, options, definition: def });
        
    } else if (mode === 'FILL_IN_THE_BLANK') {
        const candidates = gameWords.filter((w: Word) => w.examples.length > 0);
        if (candidates.length < 4) {
             // Fallback if not enough examples
             startSpecificGame('REVERSE_MATCH');
             return;
        }
        
        const shuffled = shuffleArray<Word>(candidates);
        const correct = shuffled[0];
        const rawEx = correct.examples[Math.floor(Math.random() * correct.examples.length)];
        // Replace the word (case insensitive) with blanks
        const blanked = rawEx.replace(new RegExp(`\\b${correct.word}\\b`, 'i'), '_______');
        const options = shuffleArray<Word>(shuffled.slice(0, 4));
        
        setCurrentQuestion({ correctWord: correct, options, sentence: blanked, blankWord: correct.word });
    }

    setAppScreen('GAME');
  }, [gameWords]);


  // --- Interaction Handlers (Matching Game) ---
  const handleWordClick = (wordId: string) => {
    if (gameState !== 'PRACTICING') return;
    if (soundEnabled) playSound('click');
    setSelectedWordId(prev => (prev === wordId ? null : wordId));
  };

  const handleDefinitionClick = (definition: string) => {
    if (gameState !== 'PRACTICING') return;
    if (soundEnabled) playSound('click');

    const newMatches = new Map(userMatches);
    // Remove existing match for this definition if any
    if (newMatches.has(definition)) newMatches.delete(definition);

    // If a word is selected, match it
    if (selectedWordId) {
        // Remove if this word was matched elsewhere
        for (const [def, wId] of newMatches.entries()) {
            if (wId === selectedWordId) newMatches.delete(def);
        }
        newMatches.set(definition, selectedWordId);
        setUserMatches(newMatches);
        setSelectedWordId(null);
    }
  };

  const handleCheckAnswers = () => {
    let allCorrect = true;
    targetDefinitions.forEach(td => {
        if (userMatches.get(td.definition) !== td.wordId) allCorrect = false;
    });
    
    if (allCorrect) {
        const points = addScore(300); // 300 base points for matching set
        if (soundEnabled) playSound('correct');
        endRound(points);
    } else {
        resetCombo();
        if (soundEnabled) playSound('incorrect');
        setGameState('FEEDBACK'); // Show errors
    }
  };

  // --- Interaction Handlers (Quiz Modes) ---
  const handleOptionSelection = (selected: Word) => {
      if (questionState === 'feedback' || !currentQuestion) return;
      
      const isCorrect = selected.id === currentQuestion.correctWord.id;
      
      if (gameMode === 'TIME_ATTACK') {
          // TIME ATTACK: Incorrect doesn't end game, just streak
          if (isCorrect) {
              addScore(100);
              if (soundEnabled) playSound('correct');
              startSpecificGame('TIME_ATTACK', true); // Next question, maintain timer
          } else {
              resetCombo();
              if (soundEnabled) playSound('incorrect');
              // Flash red or shake? For now just next question
               startSpecificGame('TIME_ATTACK', true);
          }
          return;
      }

      if (gameMode === 'SURVIVAL') {
          // SURVIVAL: Incorrect ends game immediately
          if (isCorrect) {
              addScore(150);
              if (soundEnabled) playSound('correct');
              startSpecificGame('SURVIVAL', true); // Next question, resets timer
          } else {
              resetCombo();
              if (soundEnabled) playSound('incorrect');
              endRound(0, "Game Over!");
          }
          return;
      }

      // Normal Modes (Reverse Match, Fill Blank)
      setSelectedOptionId(selected.id);
      setQuestionState('feedback');
      
      if (isCorrect) {
          const points = addScore(100);
          if (soundEnabled) playSound('correct');
          endRound(points);
      } else {
          resetCombo();
          if (soundEnabled) playSound('incorrect');
      }
  };

  // --- Navigation ---
  const goHome = () => {
      setAppScreen('HOME');
      setShowRoundSummary(false);
      setSearchQuery('');
      // Reset session score on home? Maybe keep it for "Session" feel.
      // setSessionScore(0); 
  };

  // --- Renderers ---

  if (isLoading && allVocabWords.length === 0) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-950 text-slate-200 font-lexend">
              <div className="flex flex-col items-center gap-4">
                  <div className="spinner"></div>
                  <p>Loading Dictionary...</p>
              </div>
          </div>
      );
  }

  // --- HOME SCREEN ---
  if (appScreen === 'HOME') {
      return (
          <div className="container mx-auto p-4 min-h-screen flex flex-col items-center animate-fadeIn relative">
              {/* Top Bar */}
              <div className="w-full flex justify-between items-center p-4">
                  <div className="flex items-center gap-2">
                     <span className="text-3xl">🎮</span>
                     <span className="text-sky-400 font-bold font-mono text-xl">{sessionScore} pts</span>
                  </div>
                  <button onClick={toggleSound} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                      {soundEnabled ? '🔊' : '🔇'}
                  </button>
              </div>

              {/* Header */}
              <header className="text-center mb-10 mt-4 w-full">
                  <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-lexend tracking-tight mb-2 drop-shadow-lg">
                      VOCAB ARCADE
                  </h1>
                  <p className="text-slate-400 text-lg">Master English. Beat the High Score.</p>
              </header>

              {/* Search */}
              <div className="w-full max-w-2xl mb-12 relative z-20 group">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search any word..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="w-full px-6 py-4 bg-slate-900/80 border-2 border-slate-700 rounded-full text-lg text-white placeholder-slate-500 focus:ring-4 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition-all shadow-2xl group-hover:border-slate-500"
                    />
                    <span className="absolute right-6 top-1/2 transform -translate-y-1/2 text-2xl">🔍</span>
                </div>
              </div>

              {searchQuery ? (
                  // Search Results
                  <div className="w-full max-w-6xl animate-fadeIn pb-20">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                          {searchResults.length > 0 ? searchResults.map(word => (
                              <Flashcard key={word.id} wordData={word} />
                          )) : (
                              <p className="text-slate-500 text-center col-span-3 py-10">No words found.</p>
                          )}
                      </div>
                  </div>
              ) : (
                  // Dashboard Content
                  <div className="w-full max-w-5xl flex flex-col gap-8 pb-20 px-4">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Word of Day */}
                          <div className="flex flex-col">
                              {wordOfTheDay && <WordOfTheDay wordData={wordOfTheDay} />}
                          </div>

                          {/* Play Config */}
                          <div className="bg-slate-900/60 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 flex flex-col shadow-xl">
                              <h3 className="text-2xl font-bold text-white mb-6 font-lexend border-b border-slate-700 pb-2">Select Your Pack</h3>
                              
                              <div className="flex-grow overflow-y-auto max-h-60 mb-6 space-y-3 pr-2 custom-scrollbar">
                                  {availableSets.map(set => (
                                      <label key={set.id} className="flex items-center p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-all has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-900/20 group">
                                          <div className="relative flex items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedSetIds.has(set.id)}
                                                onChange={() => handleSetSelectionChange(set.id)}
                                                className="peer appearance-none w-6 h-6 border-2 border-slate-500 rounded bg-slate-900 checked:bg-cyan-500 checked:border-cyan-500 transition-colors"
                                            />
                                            <svg className="absolute w-4 h-4 text-white pointer-events-none hidden peer-checked:block left-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </div>
                                          <span className="ml-4 text-slate-300 font-medium text-lg group-hover:text-white transition-colors">{set.name}</span>
                                      </label>
                                  ))}
                              </div>

                              <button
                                onClick={prepareForGame}
                                disabled={selectedSetIds.size === 0}
                                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xl rounded-xl shadow-lg shadow-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                              >
                                  START GAME 🚀
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- MODE SELECTION SCREEN ---
  if (appScreen === 'MODE_SELECTION') {
      return (
        <div className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center animate-fadeIn">
             <button onClick={goHome} className="absolute top-6 left-6 bg-slate-800/50 px-6 py-3 rounded-full border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 transition-all font-bold z-50">
                 &larr; EXIT
             </button>
             
             <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 font-lexend text-center mt-20 md:mt-0">SELECT MODE</h1>
             <p className="text-slate-400 mb-12 text-xl">How do you want to play?</p>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full px-4 pb-10">
                {/* Mode Cards */}
                <button onClick={() => startSpecificGame('MATCHING')} className="group relative p-8 bg-slate-900/60 border-2 border-slate-700 rounded-3xl hover:border-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-cyan-500 rotate-12">🧩</div>
                    <h3 className="text-2xl font-bold text-cyan-400 mb-2 relative z-10">Classic Matching</h3>
                    <p className="text-slate-400 relative z-10">Connect words to their definitions. Relaxed pace.</p>
                </button>

                <button onClick={() => startSpecificGame('TIME_ATTACK')} className="group relative p-8 bg-slate-900/60 border-2 border-amber-600/50 rounded-3xl hover:border-amber-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-amber-500 rotate-12">⚡</div>
                    <h3 className="text-2xl font-bold text-amber-400 mb-2 relative z-10">2 Minute Blitz</h3>
                    <p className="text-slate-400 relative z-10">120 seconds. How many words can you get right?</p>
                </button>

                <button onClick={() => startSpecificGame('SURVIVAL')} className="group relative p-8 bg-slate-900/60 border-2 border-red-900/50 rounded-3xl hover:border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-red-500 rotate-12">💀</div>
                    <h3 className="text-2xl font-bold text-red-400 mb-2 relative z-10">Survival</h3>
                    <p className="text-slate-400 relative z-10">10 seconds per word. One wrong move and it's over.</p>
                </button>

                <button onClick={() => startSpecificGame('REVERSE_MATCH')} className="group relative p-8 bg-slate-900/60 border-2 border-slate-700 rounded-3xl hover:border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-purple-500 rotate-12">🎯</div>
                    <h3 className="text-2xl font-bold text-purple-400 mb-2 relative z-10">Reverse Match</h3>
                    <p className="text-slate-400 relative z-10">See the definition, pick the word. Multiple choice.</p>
                </button>

                <button onClick={() => startSpecificGame('MEMORY')} className="group relative p-8 bg-slate-900/60 border-2 border-slate-700 rounded-3xl hover:border-pink-500 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-pink-500 rotate-12">🧠</div>
                    <h3 className="text-2xl font-bold text-pink-400 mb-2 relative z-10">Memory</h3>
                    <p className="text-slate-400 relative z-10">Flip cards to find pairs. Test your memory.</p>
                </button>

                <button onClick={() => startSpecificGame('FILL_IN_THE_BLANK')} className="group relative p-8 bg-slate-900/60 border-2 border-slate-700 rounded-3xl hover:border-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all text-left overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] p-0 opacity-10 group-hover:opacity-20 transition-opacity text-9xl text-blue-500 rotate-12">📝</div>
                    <h3 className="text-2xl font-bold text-blue-400 mb-2 relative z-10">Fill in the Blank</h3>
                    <p className="text-slate-400 relative z-10">Complete the sentence with the right word.</p>
                </button>
             </div>
        </div>
      );
  }

  // --- GAME SCREEN ---
  return (
      <div className="container mx-auto p-4 min-h-screen flex flex-col relative">
          
          {/* Round Summary Modal */}
          {showRoundSummary && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
                  <div className="bg-slate-900 border-2 border-slate-700 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full mx-4 transform animate-pop relative overflow-hidden">
                      {/* Decorative background glow */}
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none"></div>

                      <h2 className="text-4xl font-bold text-white mb-2 font-lexend relative z-10">
                         {roundPoints > 0 ? winMessage : "Game Over"}
                      </h2>
                      
                      <div className="py-6 relative z-10">
                          <p className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">
                              {gameMode === 'SURVIVAL' || gameMode === 'TIME_ATTACK' ? "Session Score" : "Round Score"}
                          </p>
                          <p className="text-6xl font-mono font-bold text-cyan-400 drop-shadow-lg">
                              {gameMode === 'SURVIVAL' || gameMode === 'TIME_ATTACK' ? sessionScore : `+${roundPoints}`}
                          </p>
                      </div>

                      <div className="flex flex-col gap-3 relative z-10">
                         <button
                            onClick={() => {
                                setShowRoundSummary(false);
                                startSpecificGame(gameMode);
                            }}
                            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
                         >
                            {gameMode === 'SURVIVAL' ? "Try Again ➔" : "Next Round ➔"}
                         </button>
                         <button
                            onClick={goHome}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-lg transition-all active:scale-95"
                         >
                            Exit to Menu
                         </button>
                      </div>
                  </div>
              </div>
          )}

          {/* Top Game Bar */}
          <div className="flex justify-between items-center mb-8 relative z-10">
             <button onClick={() => setAppScreen('MODE_SELECTION')} className="bg-slate-800/80 px-4 py-2 rounded-full border border-slate-600 text-slate-400 hover:text-white transition-colors font-bold text-sm">
                ✕ QUIT
             </button>

             {(gameMode === 'TIME_ATTACK' || gameMode === 'SURVIVAL') && (
                 <div className={`text-4xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse scale-110' : 'text-white'}`}>
                     {gameMode === 'SURVIVAL' ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
                 </div>
             )}

             <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Session Score</span>
                <span className="text-2xl font-mono font-bold text-cyan-400">{sessionScore}</span>
             </div>
          </div>
          
          {/* Combo Indicator */}
          {currentCombo > 1 && (
              <div className="absolute top-20 right-4 animate-pop rotate-12 z-0 opacity-50 pointer-events-none">
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 drop-shadow-sm">
                      {currentCombo}x COMBO!
                  </p>
              </div>
          )}

          <main className="flex-grow w-full max-w-4xl mx-auto relative z-10 flex flex-col justify-center">
              
              {/* MEMORY GAME RENDERER */}
              {gameMode === 'MEMORY' && (
                  <MemoryGame 
                    words={gameWords} 
                    onComplete={(score) => endRound(score)}
                    onMatch={() => { if(soundEnabled) playSound('correct'); }}
                    onMismatch={() => { if(soundEnabled) playSound('incorrect'); }}
                  />
              )}

              {/* OTHER GAMES RENDERER */}
              {gameMode !== 'MEMORY' && (
                <>
                  {gameMode === 'MATCHING' && (
                     <>
                        <h2 className="text-center text-xl text-slate-400 mb-6 font-lexend">Match the definitions</h2>
                        {/* Reduced spacing from space-y-4 to space-y-2 */}
                        <div className="space-y-2 mb-20 pb-32 md:pb-0"> 
                            {shuffledDefinitions.map(({ definition, wordId: correctWordId }) => {
                                const userWordId = userMatches.get(definition);
                                const matchedWordObj = userWordId ? practiceWords.find(w => w.id === userWordId) : null;
                                const correctWordObj = (gameState === 'FEEDBACK' && userWordId !== correctWordId) ? practiceWords.find(w => w.id === correctWordId) : null;
                                
                                let feedback: FeedbackType = 'none';
                                if (gameState === 'FEEDBACK') {
                                    if (userWordId === correctWordId) feedback = 'correct';
                                    else if (userWordId) feedback = 'incorrect';
                                }

                                return (
                                    <DefinitionBox
                                        key={definition}
                                        definition={definition}
                                        onClick={() => handleDefinitionClick(definition)}
                                        feedback={feedback}
                                        matchedWord={matchedWordObj?.word || null}
                                        correctWord={correctWordObj?.word || null}
                                        isTargetedForSelection={!!selectedWordId && userMatches.get(definition) !== selectedWordId}
                                    />
                                )
                            })}
                        </div>
                        
                        {/* Word Bank at Bottom for Matching */}
                         <div className="w-full bg-slate-950 border-t-2 border-slate-700 p-4 fixed bottom-0 left-0 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:static md:bg-transparent md:border-none md:p-0 md:shadow-none">
                          <div className="max-w-4xl mx-auto">
                             <div className="flex flex-wrap justify-center items-center gap-3">
                                {practiceWords.map(word => {
                                  const isUsed = Array.from(userMatches.values()).includes(word.id);
                                  let feedback: 'correct' | 'incorrect' | 'none' = 'none';
                                  if(gameState === 'FEEDBACK') {
                                    const correctDef = targetDefinitions.find(td => td.wordId === word.id);
                                    if(correctDef && userMatches.get(correctDef.definition) === word.id) {
                                      feedback = 'correct';
                                    } else if (isUsed) {
                                      feedback = 'incorrect';
                                    }
                                  }
                                  return (
                                    <WordPill 
                                        key={word.id}
                                        word={word.word}
                                        onClick={() => handleWordClick(word.id)}
                                        isSelected={selectedWordId === word.id}
                                        isUsed={gameState === 'PRACTICING' && isUsed && selectedWordId !== word.id}
                                        feedback={feedback}
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* Game Controls inside sticky area for mobile access */}
                              <div className="mt-4 flex justify-center md:hidden">
                                   {gameState === 'PRACTICING' ? (
                                       <button 
                                        onClick={handleCheckAnswers}
                                        disabled={userMatches.size !== 3}
                                        className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                       >
                                           CHECK ANSWERS
                                       </button>
                                   ) : (
                                        <button 
                                        onClick={() => startSpecificGame(gameMode)}
                                        className="w-full py-3 bg-cyan-600 text-white rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
                                       >
                                           NEXT ROUND ➔
                                       </button>
                                   )}
                              </div>
                          </div>
                        </div>
                        
                        {/* Desktop Controls */}
                        <div className="hidden md:flex justify-center mt-8 h-20">
                           {gameState === 'PRACTICING' ? (
                               <button 
                                onClick={handleCheckAnswers}
                                disabled={userMatches.size !== 3}
                                className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-full font-bold text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
                               >
                                   CHECK ANSWERS
                               </button>
                           ) : (
                                <button 
                                onClick={() => startSpecificGame(gameMode)}
                                className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
                               >
                                   NEXT ROUND ➔
                               </button>
                           )}
                        </div>
                     </>
                  )}

                  {(gameMode === 'REVERSE_MATCH' || gameMode === 'TIME_ATTACK' || gameMode === 'SURVIVAL' || gameMode === 'FILL_IN_THE_BLANK') && currentQuestion && (
                      <div className="max-w-2xl mx-auto w-full">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 mb-8 backdrop-blur-sm text-center min-h-[220px] flex flex-col justify-center items-center shadow-2xl relative overflow-hidden">
                            {/* Decorative element */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-purple-500"></div>
                            
                            {(gameMode === 'REVERSE_MATCH' || gameMode === 'TIME_ATTACK' || gameMode === 'SURVIVAL') && (
                                <>
                                    <h2 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Select the word for</h2>
                                    <p className="text-2xl md:text-3xl text-white font-medium leading-relaxed">"{currentQuestion.definition}"</p>
                                </>
                            )}
                            {gameMode === 'FILL_IN_THE_BLANK' && (
                                <>
                                     <h2 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Complete the Sentence</h2>
                                     <p className="text-2xl md:text-3xl text-amber-200 font-medium leading-relaxed">"{currentQuestion.sentence}"</p>
                                </>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20">
                            {currentQuestion.options.map(word => {
                                let feedback: 'none' | 'correct' | 'incorrect' | 'revealed' = 'none';
                                if (questionState === 'feedback') {
                                    if (word.id === currentQuestion.correctWord.id) feedback = selectedOptionId === word.id ? 'correct' : 'revealed';
                                    else if (word.id === selectedOptionId) feedback = 'incorrect';
                                }

                                return (
                                    <button 
                                        key={word.id}
                                        onClick={() => handleOptionSelection(word)}
                                        disabled={questionState === 'feedback'}
                                        className={`
                                            p-6 rounded-2xl border-2 transition-all duration-200 text-xl font-bold font-lexend
                                            ${feedback === 'none' ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-500 hover:bg-slate-800 hover:text-white hover:scale-[1.02] active:scale-[0.98]' : ''}
                                            ${feedback === 'correct' ? 'bg-green-600 border-green-500 text-white scale-105 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''}
                                            ${feedback === 'incorrect' ? 'bg-red-900/50 border-red-500 text-red-200 opacity-50' : ''}
                                            ${feedback === 'revealed' ? 'bg-green-900/30 border-green-500/50 text-green-200' : ''}
                                        `}
                                    >
                                        {word.word}
                                    </button>
                                )
                            })}
                        </div>
                        
                        {/* Next Question Button (for non-timed modes) */}
                        {questionState === 'feedback' && gameMode !== 'TIME_ATTACK' && gameMode !== 'SURVIVAL' && (
                            <div className="flex justify-center">
                                <button 
                                    onClick={() => startSpecificGame(gameMode)}
                                    className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 animate-pop"
                                >
                                    Next Question ➔
                                </button>
                            </div>
                        )}
                      </div>
                  )}
                </>
              )}
          </main>
      </div>
  );
};

export default App;
