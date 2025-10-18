import React from 'react';
import type { Match, GameState } from '../types';

interface ConnectingLinesProps {
    matches: Match[];
    correctMatches?: Match[];
    wordPositions: Map<string, DOMRect>;
    definitionPositions: Map<string, DOMRect>;
    containerRect: DOMRect | null;
    gameState: GameState;
}

const ConnectingLines: React.FC<ConnectingLinesProps> = ({
    matches,
    correctMatches,
    wordPositions,
    definitionPositions,
    containerRect,
    gameState,
}) => {
    if (!containerRect) return null;

    const getLinePoints = (wordId: string, definition: string) => {
        const wordRect = wordPositions.get(wordId);
        const defRect = definitionPositions.get(definition);
        if (!wordRect || !defRect) return null;

        const startX = wordRect.right - containerRect.left;
        const startY = wordRect.top - containerRect.top + wordRect.height / 2;
        const endX = defRect.left - containerRect.left;
        const endY = defRect.top - containerRect.top + defRect.height / 2;

        return { startX, startY, endX, endY };
    };

    const linesToDraw: React.ReactNode[] = [];

    if (gameState === 'PRACTICING') {
        matches.forEach((match, index) => {
            const points = getLinePoints(match.wordId, match.definition);
            if (points) {
                linesToDraw.push(
                    <line
                        key={`practicing-${index}`}
                        x1={points.startX}
                        y1={points.startY}
                        x2={points.endX}
                        y2={points.endY}
                        className="stroke-sky-400"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                );
            }
        });
    } else if (gameState === 'FEEDBACK' && correctMatches) {
        const correctMatchesMap = new Map(correctMatches.map(cm => [cm.definition, cm.wordId]));

        // Render user's matches, colored by correctness
        matches.forEach((match, index) => {
            const points = getLinePoints(match.wordId, match.definition);
            if (!points) return;

            const isCorrect = correctMatchesMap.get(match.definition) === match.wordId;
            const strokeClass = isCorrect ? 'stroke-green-500' : 'stroke-red-500';

            linesToDraw.push(
                <line
                    key={`user-${index}`}
                    x1={points.startX}
                    y1={points.startY}
                    x2={points.endX}
                    y2={points.endY}
                    className={strokeClass}
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            );
        });

        // Render correct answers (dashed green) for incorrect matches
        correctMatches.forEach((correctMatch, index) => {
            const userWordForDef = matches.find(m => m.definition === correctMatch.definition)?.wordId;
            const wasUserWrong = userWordForDef && userWordForDef !== correctMatch.wordId;
            
            if (wasUserWrong) {
                const points = getLinePoints(correctMatch.wordId, correctMatch.definition);
                if (points) {
                    linesToDraw.push(
                        <line
                            key={`correct-${index}`}
                            x1={points.startX}
                            y1={points.startY}
                            x2={points.endX}
                            y2={points.endY}
                            className="stroke-green-500"
                            strokeWidth="3"
                            strokeDasharray="8 8"
                        />
                    );
                }
            }
        });
    }

    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
        >
            {linesToDraw}
        </svg>
    );
};

export default ConnectingLines;
