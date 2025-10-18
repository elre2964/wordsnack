
import React from 'react';
import type { Match } from '../types';

interface ConnectingLinesProps {
    matches: Match[];
    correctMatches?: Match[];
    wordPositions: Map<string, DOMRect>;
    definitionPositions: Map<string, DOMRect>;
    containerRect: DOMRect | null;
}

const ConnectingLines: React.FC<ConnectingLinesProps> = ({
    matches,
    correctMatches,
    wordPositions,
    definitionPositions,
    containerRect,
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

    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
        >
            {/* Render correct answers (dashed green) */}
            {correctMatches?.map((match, index) => {
                const points = getLinePoints(match.wordId, match.definition);
                if (!points) return null;
                return (
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
            })}

            {/* Render user's matches (solid, color-coded) */}
            {matches.map((match, index) => {
                const points = getLinePoints(match.wordId, match.definition);
                if (!points) return null;

                const isCorrect = correctMatches
                    ? correctMatches.some(
                        (cm) => cm.wordId === match.wordId && cm.definition === match.definition
                    )
                    : undefined;

                let strokeClass = 'stroke-sky-400';
                if (isCorrect === true) strokeClass = 'stroke-green-500';
                if (isCorrect === false) strokeClass = 'stroke-red-500';

                return (
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
            })}
        </svg>
    );
};

export default ConnectingLines;
