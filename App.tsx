
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Word, TargetDefinition, GameState, FeedbackType, VocabSetInfo, UserStats } from './types';
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

// Sound Effects Helpers (Simple Web Audio API or HTML5 Audio)
const playSound = (type: 'correct' | 'incorrect' | 'click' | 'win') => {
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
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'incorrect') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'win') {
             osc.frequency.setValueAtTime(400, now);
             osc.frequency.setValueAtTime(600, now + 0.1);
             osc.frequency.setValueAtTime(1000, now + 0.2);
             gain.gain.setValueAtTime(0.1, now);
             gain.gain.linearRampToValueAtTime(0, now + 0.5);
             osc.start(now);
             osc.stop(now + 0.5);
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

type AppScreen = 'HOME' | 'MODE_SELECTION' | 'GAME' | 'FAVORITES';
type GameMode = 'MATCHING' | 'REVERSE_MATCH' | 'FILL_IN_THE_BLANK' | 'MEMORY';

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

  // Data
  const [availableSets, setAvailableSets] = useState<VocabSetInfo[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set<string>());
  const [wordOfTheDay, setWordOfTheDay] = useState<Word | null>(null);
  const [allVocabWords, setAllVocabWords] = useState<Word[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Word[]>([]);

  // Persistence & Stats
  const [userStats, setUserStats] = useState<UserStats>({
    wordsLearned: 0,
    currentStreak: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    lastPlayed: new Date().toISOString()
  });
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Game State
  const [gameWords, setGameWords] = useState<Word[]>([]); // Words used in current game session
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [winMessage, setWinMessage] = useState(WIN_MESSAGES[0]);


  // --- Persistence Loading ---
  useEffect(() => {
    const loadPersistence = () => {
      const savedStats = localStorage.getItem('vocabAppStats');
      if (savedStats) {
        try {
          setUserStats(JSON.parse(savedStats));
        } catch (e) { console.error("Failed to load stats"); }
      }

      const savedFavorites = localStorage.getItem('vocabAppFavorites');
      if (savedFavorites) {
        try {
            const parsed = JSON.parse(savedFavorites);
            if (Array.isArray(parsed)) {
                setFavoriteIds(new Set(parsed));
            }
        } catch (e) { console.error("Failed to load favorites"); }
      }
    };
    loadPersistence();
  }, []);

  // Save on change
  useEffect(() => {
    localStorage.setItem('vocabAppStats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    localStorage.setItem('vocabAppFavorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const updateStats = (correct: boolean) => {
      setUserStats(prev => {
          const newStats = { ...prev };
          newStats.totalAttempts += 1;
          if (correct) {
              newStats.totalCorrect += 1;
              newStats.wordsLearned += 1; // Simplistic logic, but works for motivation
              
              // Check streak
              const lastDate = new Date(prev.lastPlayed).toDateString();
              const today = new Date().toDateString();
              if (lastDate !== today) {
                  newStats.currentStreak += 1;
              }
              newStats.lastPlayed = new Date().toISOString();
          }
          return newStats;
      });
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
  }, []);

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

  const triggerWin = () => {
      setWinMessage(WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)]);
      playSound('win');
      setShowConfetti(true);
      updateStats(true);
  };

  const startSpecificGame = useCallback((mode: GameMode) => {
    // Reset Game State
    setQuestionState('question');
    setSelectedOptionId(null);
    setSelectedWordId(null);
    setUserMatches(new Map());
    setGameState('PRACTICING');
    setShowConfetti(false);
    setGameMode(mode);

    if (gameWords.length === 0) {
       setError("No words loaded.");
       setAppScreen('HOME');
       return;
    }

    // Setup based on mode
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
        
    } else if (mode === 'REVERSE_MATCH') {
        const shuffled = shuffleArray<Word>(gameWords);
        if (shuffled.length < 4) return;
        const correct = shuffled[0];
        const def = correct.definitions[Math.floor(Math.random() * correct.definitions.length)];
        const options = shuffleArray(shuffled.slice(0, 4));
        setCurrentQuestion({ correctWord: correct, options, definition: def });
    } else if (mode === 'FILL_IN_THE_BLANK') {
        const candidates = gameWords.filter((w: Word) => w.examples.length > 0);
        if (candidates.length < 4) return;
        
        const shuffled = shuffleArray<Word>(candidates);
        const correct = shuffled[0];
        const rawEx = correct.examples[Math.floor(Math.random() * correct.examples.length)];
        const blanked = rawEx.replace(new RegExp(`\\b${correct.word}\\b`, 'i'), '_______');
        const options = shuffleArray<Word>(shuffled.slice(0, 4));
        
        setCurrentQuestion({ correctWord: correct, options, sentence: blanked, blankWord: correct.word });
    } else if (mode === 'MEMORY') {
       // Just setting the mode is enough, the component handles initialization based on gameWords
    }

    setAppScreen('GAME');
  }, [gameWords]);


  // --- Interaction Handlers (Matching Game) ---
  const handleWordClick = (wordId: string) => {
    if (gameState !== 'PRACTICING') return;
    setSelectedWordId(prev => (prev === wordId ? null : wordId));
    playSound('click');
  };

  const handleDefinitionClick = (definition: string) => {
    if (gameState !== 'PRACTICING') return;
    playSound('click');

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
        triggerWin();
    } else {
        playSound('incorrect');
        updateStats(false);
    }
    setGameState('FEEDBACK');
  };

  // --- Interaction Handlers (Quiz Modes) ---
  const handleOptionSelection = (selected: Word) => {
      if (questionState === 'feedback' || !currentQuestion) return;
      setSelectedOptionId(selected.id);
      setQuestionState('feedback');
      
      const isCorrect = selected.id === currentQuestion.correctWord.id;
      if (isCorrect) {
          triggerWin();
      } else {
          playSound('incorrect');
          updateStats(false);
      }
  };

  // --- Navigation ---
  const goHome = () => {
      setAppScreen('HOME');
      setShowConfetti(false);
      setSearchQuery('');
  };

  // --- Renderers ---

  if (isLoading && allVocabWords.length === 0) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-950">
              <div className="text-center">
                  <div className="spinner mb-4 mx-auto"></div>
                  <p className="text-slate-300 font-lexend">Loading Vocabulary...</p>
              </div>
          </div>
      );
  }

  // HOME SCREEN (Dashboard)
  if (appScreen === 'HOME') {
      return (
          <div className="container mx-auto p-4 min-h-screen flex flex-col items-center animate-fadeIn relative">
              {/* Header */}
              <header className="text-center mb-8 mt-8 w-full">
                  <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-500 font-lexend tracking-tight mb-2">
                      Vocabulary Master
                  </h1>
                  <p className="text-slate-400 text-lg">Level up your English skills.</p>
              </header>

              {/* Search */}
              <div className="w-full max-w-2xl mb-10 relative z-20">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search for a word..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="w-full px-6 py-4 bg-slate-800/80 backdrop-blur-md border-2 border-slate-700 rounded-full text-lg text-white placeholder-slate-500 focus:ring-4 focus:ring-sky-500/30 focus:border-sky-500 outline-none transition-all shadow-2xl"
                    />
                    <svg className="absolute right-5 top-1/2 transform -translate-y-1/2 text-slate-500 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
              </div>

              {searchQuery ? (
                  // Search Results
                  <div className="w-full max-w-6xl animate-fadeIn pb-20">
                      <h2 className="text-2xl font-bold text-sky-400 mb-6 px-4">Search Results</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                          {searchResults.length > 0 ? searchResults.map(word => (
                              <Flashcard 
                                key={word.id} 
                                wordData={word} 
                                isFavorite={favoriteIds.has(word.id)}
                                onToggleFavorite={toggleFavorite}
                              />
                          )) : (
                              <p className="text-slate-500 text-center col-span-3 py-10">No words found.</p>
                          )}
                      </div>
                  </div>
              ) : (
                  // Dashboard Content
                  <div className="w-full max-w-5xl flex flex-col gap-8 pb-20">
                      
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-4 px-2">
                          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center transform hover:scale-105 transition-all">
                              <p className="text-slate-400 text-sm uppercase tracking-wider font-bold">Words Learned</p>
                              <p className="text-3xl font-bold text-sky-400">{userStats.wordsLearned}</p>
                          </div>
                          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center transform hover:scale-105 transition-all">
                              <p className="text-slate-400 text-sm uppercase tracking-wider font-bold">Streak</p>
                              <p className="text-3xl font-bold text-amber-400">{userStats.currentStreak} <span className="text-base">days</span></p>
                          </div>
                          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center transform hover:scale-105 transition-all">
                              <p className="text-slate-400 text-sm uppercase tracking-wider font-bold">Accuracy</p>
                              <p className="text-3xl font-bold text-green-400">
                                {userStats.totalAttempts > 0 ? Math.round((userStats.totalCorrect / userStats.totalAttempts) * 100) : 0}%
                              </p>
                          </div>
                      </div>

                      {/* Main Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Left: Word of Day & Favorites */}
                          <div className="space-y-6">
                              {wordOfTheDay && <WordOfTheDay wordData={wordOfTheDay} />}
                              
                              <button 
                                onClick={() => setAppScreen('FAVORITES')}
                                className="w-full bg-gradient-to-r from-pink-900/40 to-rose-900/40 border border-pink-700/50 p-6 rounded-2xl flex items-center justify-between group hover:border-pink-500 transition-all"
                              >
                                  <div className="text-left">
                                      <h3 className="text-2xl font-bold text-pink-300 mb-1">My List</h3>
                                      <p className="text-pink-200/60">Review your {favoriteIds.size} saved words</p>
                                  </div>
                                  <div className="bg-pink-500/20 p-3 rounded-full group-hover:bg-pink-500 group-hover:text-white transition-colors text-pink-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                  </div>
                              </button>
                          </div>

                          {/* Right: Play Config */}
                          <div className="bg-slate-800/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 flex flex-col">
                              <h3 className="text-xl font-bold text-slate-200 mb-4 font-lexend">Start Practice Session</h3>
                              
                              <div className="flex-grow overflow-y-auto max-h-64 mb-6 space-y-2 pr-2 custom-scrollbar">
                                  {availableSets.map(set => (
                                      <label key={set.id} className="flex items-center p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-all has-[:checked]:border-sky-500 has-[:checked]:bg-sky-900/20">
                                          <input 
                                            type="checkbox" 
                                            checked={selectedSetIds.has(set.id)}
                                            onChange={() => handleSetSelectionChange(set.id)}
                                            className="w-5 h-5 rounded border-gray-500 text-sky-500 focus:ring-sky-500 bg-slate-800"
                                          />
                                          <span className="ml-3 text-slate-300 font-medium">{set.name}</span>
                                      </label>
                                  ))}
                              </div>

                              <button
                                onClick={prepareForGame}
                                disabled={selectedSetIds.size === 0}
                                className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xl rounded-xl shadow-lg shadow-sky-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                              >
                                  Play Now
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // FAVORITES SCREEN
  if (appScreen === 'FAVORITES') {
      const favoriteWords = allVocabWords.filter(w => favoriteIds.has(w.id));
      return (
        <div className="container mx-auto p-4 min-h-screen pt-20">
            <button onClick={goHome} className="fixed top-6 left-6 z-50 bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all">
                &larr; Back
            </button>
            
            <h2 className="text-4xl font-bold text-center text-pink-400 mb-8 font-lexend">My Saved Words</h2>
            
            {favoriteWords.length === 0 ? (
                <div className="text-center text-slate-500 mt-20">
                    <p className="text-2xl mb-4">Your list is empty.</p>
                    <p>Star words during search or games to add them here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {favoriteWords.map(word => (
                        <Flashcard 
                            key={word.id} 
                            wordData={word} 
                            isFavorite={true}
                            onToggleFavorite={toggleFavorite}
                        />
                    ))}
                </div>
            )}
        </div>
      );
  }

  // MODE SELECTION SCREEN
  if (appScreen === 'MODE_SELECTION') {
      return (
        <div className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center animate-fadeIn">
             <button onClick={goHome} className="absolute top-6 left-6 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-600 text-slate-400 hover:text-white transition-colors">&larr; Home</button>
             
             <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 font-lexend">Choose Activity</h1>
             <p className="text-slate-400 mb-12 text-lg">Select a game mode to practice your words.</p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full px-4">
                <button onClick={() => startSpecificGame('MATCHING')} className="group relative p-8 bg-slate-800/40 border border-slate-700 rounded-2xl hover:bg-sky-900/20 hover:border-sky-500 transition-all text-left overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-sky-400 mb-2">Classic Matching</h3>
                    <p className="text-slate-400">Match words to their definitions. The classic way to learn.</p>
                </button>

                <button onClick={() => startSpecificGame('REVERSE_MATCH')} className="group relative p-8 bg-slate-800/40 border border-slate-700 rounded-2xl hover:bg-purple-900/20 hover:border-purple-500 transition-all text-left overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-purple-400 mb-2">Reverse Match</h3>
                    <p className="text-slate-400">See the definition and pick the correct word from options.</p>
                </button>

                <button onClick={() => startSpecificGame('MEMORY')} className="group relative p-8 bg-slate-800/40 border border-slate-700 rounded-2xl hover:bg-pink-900/20 hover:border-pink-500 transition-all text-left overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-pink-400 mb-2">Memory Game</h3>
                    <p className="text-slate-400">Flip cards to find matching pairs. Test your memory and vocab.</p>
                </button>

                <button onClick={() => startSpecificGame('FILL_IN_THE_BLANK')} className="group relative p-8 bg-slate-800/40 border border-slate-700 rounded-2xl hover:bg-amber-900/20 hover:border-amber-500 transition-all text-left overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-amber-400 mb-2">Fill in the Blank</h3>
                    <p className="text-slate-400">Complete sentences using the correct vocabulary word.</p>
                </button>
             </div>
        </div>
      );
  }

  // GAME SCREEN
  return (
      <div className="container mx-auto p-4 min-h-screen flex flex-col relative">
          {/* Confetti & Win Overlay */}
          {showConfetti && (
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
                  {[...Array(50)].map((_, i) => (
                      <div 
                        key={i}
                        className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-confetti"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10px`,
                            backgroundColor: ['#FFD700', '#FF69B4', '#00BFFF', '#00FF7F'][Math.floor(Math.random() * 4)],
                            animationDuration: `${Math.random() * 3 + 2}s`,
                            animationDelay: `${Math.random() * 2}s`
                        }}
                      />
                  ))}
                  <div className="bg-slate-900/90 p-8 rounded-3xl border border-yellow-500/50 shadow-2xl text-center transform animate-pop relative max-w-md w-full mx-4">
                      <div className="text-6xl mb-4">🎉</div>
                      <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-2 font-lexend">
                        {winMessage}
                      </h2>
                      <p className="text-slate-300 mb-8 text-lg">You're mastering these words!</p>
                      
                      <div className="flex justify-center gap-4">
                        {gameMode !== 'MEMORY' && (
                             <button
                                onClick={() => {
                                    setShowConfetti(false);
                                    startSpecificGame(gameMode);
                                }}
                                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95"
                             >
                                Next Round &rarr;
                             </button>
                        )}
                        {gameMode === 'MEMORY' && (
                             <button
                                onClick={() => {
                                    setShowConfetti(false);
                                    startSpecificGame(gameMode);
                                }}
                                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95"
                             >
                                Play Again ↺
                             </button>
                        )}
                         <button
                            onClick={goHome}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95"
                         >
                            Quit
                         </button>
                      </div>
                  </div>
              </div>
          )}

          <button onClick={goHome} className="absolute top-4 left-4 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-600 text-slate-400 hover:text-white transition-colors z-40">
            &larr; Quit
          </button>

          <header className="text-center mt-16 mb-8">
              <h2 className="text-3xl font-bold text-sky-400 font-lexend">
                  {gameMode === 'MATCHING' && "Match Definitions"}
                  {gameMode === 'REVERSE_MATCH' && "Reverse Match"}
                  {gameMode === 'FILL_IN_THE_BLANK' && "Complete the Sentence"}
                  {gameMode === 'MEMORY' && "Memory Match"}
              </h2>
          </header>

          <main className="flex-grow w-full max-w-4xl mx-auto">
              
              {/* MEMORY GAME RENDERER */}
              {gameMode === 'MEMORY' && (
                  <MemoryGame 
                    words={gameWords} 
                    onComplete={() => {
                        triggerWin();
                    }}
                    onMatch={() => playSound('correct')}
                    onMismatch={() => playSound('incorrect')}
                  />
              )}

              {/* OTHER GAMES RENDERER */}
              {gameMode !== 'MEMORY' && (
                <>
                  {/* Game Content Logic Same as before but with Sound */}
                  {gameMode === 'MATCHING' && (
                     <>
                        <div className="w-full bg-slate-900/30 border-2 border-slate-700 rounded-xl p-4 mb-8 backdrop-blur-sm">
                          <h2 className="text-lg font-bold text-center text-slate-400 mb-4 font-lexend">Word Bank</h2>
                          <div className="flex flex-wrap justify-center items-center gap-4">
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
                        </div>
                        <div className="space-y-4">
                            {shuffledDefinitions.map(({ definition, wordId: correctWordId }) => {
                                const userWordId = userMatches.get(definition);
                                const matchedWordObj = userWordId ? practiceWords.find(w => w.id === userWordId) : null;
                                const correctWordObj = (gameState === 'FEEDBACK' && userWordId !== correctWordId) ? practiceWords.find(w => w.id === correctWordId) : null;
                                
                                // Feedback Logic
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
                     </>
                  )}

                  {(gameMode === 'REVERSE_MATCH' || gameMode === 'FILL_IN_THE_BLANK') && currentQuestion && (
                      <>
                        <div className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl p-8 mb-8 backdrop-blur-sm text-center min-h-[200px] flex flex-col justify-center items-center">
                            {gameMode === 'REVERSE_MATCH' && (
                                <>
                                    <h2 className="text-xl font-semibold text-slate-400 mb-4 font-lexend">Which word means:</h2>
                                    <p className="text-2xl text-purple-300 leading-relaxed">"{currentQuestion.definition}"</p>
                                </>
                            )}
                            {gameMode === 'FILL_IN_THE_BLANK' && (
                                <>
                                     <h2 className="text-xl font-semibold text-slate-400 mb-4 font-lexend">Complete the sentence:</h2>
                                     <p className="text-2xl text-amber-300 leading-relaxed">"{currentQuestion.sentence}"</p>
                                </>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            p-6 rounded-xl border-2 transition-all duration-300 text-lg font-bold font-lexend
                                            ${feedback === 'none' ? 'bg-slate-800 border-slate-600 hover:border-sky-500 hover:bg-slate-700 text-white' : ''}
                                            ${feedback === 'correct' ? 'bg-green-500/20 border-green-500 text-green-400 scale-105 shadow-green-500/20 shadow-lg' : ''}
                                            ${feedback === 'incorrect' ? 'bg-red-500/20 border-red-500 text-red-400 opacity-50' : ''}
                                            ${feedback === 'revealed' ? 'bg-sky-500/20 border-sky-500 text-sky-400' : ''}
                                        `}
                                    >
                                        {word.word}
                                    </button>
                                )
                            })}
                        </div>
                      </>
                  )}

                  {/* Game Controls */}
                  <div className="mt-8 flex justify-center h-20">
                       {gameMode === 'MATCHING' && gameState === 'PRACTICING' && (
                           <button 
                            onClick={handleCheckAnswers}
                            disabled={userMatches.size !== 3}
                            className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                           >
                               Check Answers
                           </button>
                       )}
                  </div>

                  {/* Flashcard Review (Shown after round) */}
                  {((gameState === 'FEEDBACK') || (questionState === 'feedback')) && (
                      <div className="mt-12 w-full">
                           <h3 className="text-2xl font-bold text-center text-slate-300 mb-6">Review Words</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {gameMode === 'MATCHING' ? 
                                    practiceWords.map(w => <Flashcard key={w.id} wordData={w} isFavorite={favoriteIds.has(w.id)} onToggleFavorite={toggleFavorite} />) 
                                    : 
                                    (currentQuestion && <Flashcard wordData={currentQuestion.correctWord} isFavorite={favoriteIds.has(currentQuestion.correctWord.id)} onToggleFavorite={toggleFavorite} />)
                                }
                           </div>
                      </div>
                  )}
                </>
              )}
          </main>
      </div>
  );
};

export default App;
