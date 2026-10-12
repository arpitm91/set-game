import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import './Card.css';

export type CardShape = 'square' | 'circle' | 'triangle';
export type CardColor = 'R' | 'G' | 'B';
export type CardShading = 'solid' | 'striped' | 'open';
export type CardNumber = 1 | 2 | 3;

export type CardObscuredFace = {
    shape: CardShape;
    color: CardColor;
    shading: CardShading;
    number: CardNumber;
};

export type CardProps = {
    shape: CardShape;
    color: CardColor;
    shading: CardShading;
    number: CardNumber;
    selected?: boolean;
    hinted?: boolean;
    disabled?: boolean;
    obscured?: boolean;
    obscuredFace?: CardObscuredFace;
    landscape?: boolean;
    onClick?: () => void;
};

const colors: Record<CardColor, string> = {
    R: '#d84b52',
    G: '#45a47f',
    B: '#3565c8',
};

function CardSymbol({ shape, shading }: {
    shape: CardShape;
    shading: CardShading;
}) {
    const patternId = `stripes-${useId().replace(/:/g, '')}`;
    const fill = shading === 'solid'
        ? '#fff'
        : shading === 'striped'
            ? `url(#${patternId})`
            : 'var(--card-surface, #fff)';
    const shapeProps = {
        fill,
        stroke: '#fff',
        strokeWidth: 2.5,
        strokeLinejoin: 'round' as const,
    };

    return (
        <svg className="set-card__symbol" viewBox="0 0 100 42" aria-hidden="true">
            {shading === 'striped' && (
                <defs>
                    <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
                        <rect width="6" height="6" fill="var(--card-surface, #fff)" />
                        <path d="M0 0v6" stroke="#fff" strokeWidth="2" />
                    </pattern>
                </defs>
            )}
            {shape === 'square' && (
                <rect {...shapeProps} x="30" y="2" width="40" height="38" />
            )}
            {shape === 'circle' && (
                <circle {...shapeProps} cx="50" cy="21" r="19" />
            )}
            {shape === 'triangle' && (
                <polygon {...shapeProps} points="50,2 71.94,40 28.06,40" />
            )}
        </svg>
    );
}

export default function Card({
    shape,
    color,
    shading,
    number,
    selected = false,
    hinted = false,
    disabled = false,
    obscured = false,
    obscuredFace,
    landscape = false,
    onClick,
}: CardProps) {
    const visibleFace = obscured && obscuredFace
        ? obscuredFace
        : { shape, color, shading, number };
    const [backdropStyle] = useState(() => ({
        '--card-transition-duration': `${650 + Math.floor(Math.random() * 550)}ms`,
    }));
    const cardStyle = {
        '--card-surface': colors[visibleFace.color],
        '--symbol-columns': landscape ? visibleFace.number : 1,
        '--symbol-rows': landscape ? 1 : visibleFace.number,
        ...backdropStyle,
    } as CSSProperties;

    return (
        <button
            className={`set-card${selected ? ' set-card--selected' : ''}${hinted ? ' set-card--hinted' : ''}${obscured ? ' set-card--obscured' : ''}`}
            type="button"
            style={cardStyle}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={obscured
                ? 'Card hidden while window is unfocused'
                : `${number} ${color} ${shading} ${shape}${number === 1 ? '' : 's'}`}
        >
            {Array.from({ length: visibleFace.number }, (_, index) => (
                <CardSymbol key={index} shape={visibleFace.shape} shading={visibleFace.shading} />
            ))}
        </button>
    );
}