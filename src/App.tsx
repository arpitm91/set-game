import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './App.css';
import Card from './Card';
import type { CardColor, CardNumber, CardShape, CardShading } from './Card';
import { countSets, createInitialDeal, findSets, hasSet, isSet, removeSetAndRefill } from './setGame';
import type { GameCard } from './setGame';

type ObscuredFace = {
  color: CardColor;
  shape: CardShape;
  number: CardNumber;
  shading: CardShading;
};

type ObscuredFeature = keyof ObscuredFace;

const obscuredFeatureOrder: ObscuredFeature[] = ['color', 'shape', 'number', 'shading'];
const availableColors: CardColor[] = ['R', 'G', 'B'];
const availableShapes: CardShape[] = ['square', 'circle', 'triangle'];
const availableNumbers: CardNumber[] = [1, 2, 3];
const availableShadings: CardShading[] = ['solid', 'striped', 'open'];
const obscuredFeatureInterval = 1000;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomObscuredFace(): ObscuredFace {
  return {
    color: randomItem(availableColors),
    shape: randomItem(availableShapes),
    number: randomItem(availableNumbers),
    shading: randomItem(availableShadings),
  };
}

function changeObscuredFeature(face: ObscuredFace, feature: ObscuredFeature): ObscuredFace {
  switch (feature) {
    case 'color':
      return { ...face, color: randomItem(availableColors.filter((value) => value !== face.color)) };
    case 'shape':
      return { ...face, shape: randomItem(availableShapes.filter((value) => value !== face.shape)) };
    case 'number':
      return { ...face, number: randomItem(availableNumbers.filter((value) => value !== face.number)) };
    case 'shading':
      return { ...face, shading: randomItem(availableShadings.filter((value) => value !== face.shading)) };
  }
}

function getGridColumns(cardCount: number, viewportWidth: number): number {
  if (cardCount === 0 || viewportWidth <= 640) {
    return 3;
  }

  return Math.ceil(cardCount / 3);
}

type GameState = {
  board: GameCard[];
  deck: GameCard[];
  selected: number[];
  hintAvailable: boolean;
  hintedCardIds: number[];
  score: number;
  seconds: number;
  message: string;
  finished: boolean;
};

type CardLayout = {
  width: number;
  landscape: boolean;
  symbolGap: number;
};

function createGame(deal: ReturnType<typeof createInitialDeal>, message: string): GameState {
  const { board, deck } = deal;
  return {
    board,
    deck,
    selected: [],
    hintAvailable: false,
    hintedCardIds: [],
    score: 0,
    seconds: 0,
    message,
    finished: false,
  };
}

function newGame(): GameState {
  return createGame(createInitialDeal(), 'Find a Set: each feature must be all the same or all different.');
}

function completeSet(game: GameState, selectedIds: number[]): GameState {
  const { board, deck } = removeSetAndRefill(game.board, game.deck, selectedIds);
  const finished = deck.length === 0 && !hasSet(board);

  return {
    ...game,
    board,
    deck,
    selected: [],
    hintAvailable: false,
    hintedCardIds: [],
    score: game.score + 1,
    message: finished ? 'No more Sets. Game complete!' : 'Set found!',
    finished,
  };
}

function dealThreeCards(game: GameState, message: string): GameState {
  if (game.deck.length === 0) {
    return {
      ...game,
      selected: [],
      hintAvailable: false,
      hintedCardIds: [],
      finished: true,
      message: 'No more Sets. Game complete!',
    };
  }

  const addedCards = game.deck.slice(0, 3);
  const board = [...game.board, ...addedCards];
  const deck = game.deck.slice(addedCards.length);
  const finished = deck.length === 0 && !hasSet(board);

  return {
    ...game,
    board,
    deck,
    selected: [],
    hintAvailable: false,
    hintedCardIds: [],
    finished,
    message: finished ? 'No more Sets. Game complete!' : message,
  };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function getInitialDarkMode(): boolean {
  const savedTheme = window.localStorage.getItem('set-theme');
  if (savedTheme !== null) {
    return savedTheme === 'dark';
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function App() {
  const [game, setGame] = useState<GameState>(newGame);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [windowFocused, setWindowFocused] = useState(true);
  const [obscuredFaces, setObscuredFaces] = useState<Record<number, ObscuredFace>>({});
  const obscuredFacesRef = useRef<Record<number, ObscuredFace>>({});
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const cardGridRef = useRef<HTMLDivElement>(null);
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);

  useEffect(() => {
    window.localStorage.setItem('set-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!optionsOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !optionsRef.current?.contains(event.target)) {
        setOptionsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOptionsOpen(false);
        optionsRef.current?.querySelector('button')?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [optionsOpen]);

  useEffect(() => {
    const grid = cardGridRef.current;
    if (!grid) {
      return undefined;
    }

    const measureCardWidth = () => {
      const gridWidth = grid.clientWidth;
      const gridHeight = grid.clientHeight;
      if (gridWidth === 0 || gridHeight === 0) {
        return;
      }

      const columns = getGridColumns(game.board.length, window.innerWidth);
      const rows = Math.ceil(game.board.length / columns);
      const styles = window.getComputedStyle(grid);
      const columnGap = Number.parseFloat(styles.columnGap) || 0;
      const rowGap = Number.parseFloat(styles.rowGap) || 0;
      const cellWidth = (gridWidth - columnGap * (columns - 1)) / columns;
      const cellHeight = (gridHeight - rowGap * (rows - 1)) / rows;
      const landscape = cellWidth >= cellHeight;
      const aspectRatio = landscape ? 4 / 3 : 3 / 4;
      const nextWidth = Math.min(cellWidth, cellHeight * aspectRatio);
      const symbolGap = Math.min(10, Math.max(2, Math.min(cellWidth, cellHeight) * 0.04));

      setCardLayout((currentLayout) => (
        currentLayout !== null
          && currentLayout.landscape === landscape
          && Math.abs(currentLayout.width - nextWidth) < 0.5
          && Math.abs(currentLayout.symbolGap - symbolGap) < 0.5
          ? currentLayout
          : { width: nextWidth, landscape, symbolGap }
      ));
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(measureCardWidth);
    resizeObserver?.observe(grid);
    if (grid.parentElement) {
      resizeObserver?.observe(grid.parentElement);
    }
    window.addEventListener('resize', measureCardWidth);
    measureCardWidth();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureCardWidth);
    };
  }, [game.board.length]);

  useEffect(() => {
    const handleBlur = () => {
      const faces = Object.fromEntries(game.board.map(({ id }) => [id, randomObscuredFace()]));
      obscuredFacesRef.current = faces;
      setObscuredFaces(faces);
      setWindowFocused(false);
    };
    const handleFocus = () => setWindowFocused(document.visibilityState !== 'hidden');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      } else {
        setWindowFocused(document.hasFocus());
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [game.board]);

  useEffect(() => {
    if (windowFocused || game.board.length === 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const cardId = randomItem(game.board).id;
      const featureCount = 2 + Math.floor(Math.random() * 3);
      const features = shuffle(obscuredFeatureOrder).slice(0, featureCount);
      const nextFaces = { ...obscuredFacesRef.current };
      nextFaces[cardId] = features.reduce(
        changeObscuredFeature,
        nextFaces[cardId] ?? randomObscuredFace(),
      );
      obscuredFacesRef.current = nextFaces;
      setObscuredFaces(nextFaces);
    }, obscuredFeatureInterval);

    return () => window.clearInterval(timer);
  }, [game.board, windowFocused]);

  useEffect(() => {
    if (game.finished || !windowFocused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGame((current) => current.finished
        ? current
        : { ...current, seconds: current.seconds + 1 });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.finished, windowFocused]);

  function selectCard(cardId: number) {
    setGame((current) => {
      if (current.finished) {
        return current;
      }

      if (current.selected.includes(cardId)) {
        return {
          ...current,
          selected: current.selected.filter((id) => id !== cardId),
          message: 'Selection updated.',
        };
      }

      const selected = current.selected.length === 3
        ? [cardId]
        : [...current.selected, cardId];

      if (selected.length < 3) {
        return { ...current, selected, message: `Select ${3 - selected.length} more.` };
      }

      const chosenCards = current.board.filter((card) => selected.includes(card.id));
      if (!isSet(chosenCards)) {
        return {
          ...current,
          selected,
          score: current.score - 1,
          message: 'Not a Set. Change your selection and try again.',
        };
      }

      return completeSet(current, selected);
    });
  }

  function handleNoSetAction() {
    setGame((current) => {
      if (current.finished) {
        return current;
      }

      if (current.hintAvailable) {
        const firstSet = findSets(current.board)[0];
        if (!firstSet) {
          return {
            ...current,
            hintAvailable: false,
            hintedCardIds: [],
            message: 'No Set remains on the board.',
          };
        }

        return {
          ...current,
          selected: [],
          hintAvailable: false,
          hintedCardIds: firstSet.map((cardIndex) => current.board[cardIndex].id),
          message: 'Hint: the highlighted cards make a Set.',
        };
      }

      const setsLeft = countSets(current.board);
      if (setsLeft > 0) {
        return {
          ...current,
          selected: [],
          hintAvailable: true,
          hintedCardIds: [],
          score: current.score - 1,
          message: `There ${setsLeft === 1 ? 'is' : 'are'} ${setsLeft} ${setsLeft === 1 ? 'Set' : 'Sets'} left. 1 point deducted.`,
        };
      }

      return dealThreeCards(current, 'No Set on the board. Three cards added.');
    });
  }

  const gridColumns = getGridColumns(game.board.length, window.innerWidth);

  return (
    <main
      className="App"
      data-theme={darkMode ? 'dark' : 'light'}
      data-window-focused={windowFocused}
    >
      <div className="game-shell">
        <header className="game-header">
          <div className="header-leading">
            <button className="text-button header-set-action" type="button" onClick={handleNoSetAction} disabled={game.finished}>
              {game.hintAvailable ? 'Hint' : 'No Set'}
            </button>
            <div className="game-stats" aria-label="Game statistics">
              <div className="stat">
                <span className="stat-label">SCORE</span>
                <strong>{game.score}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">TIME</span>
                <strong>{formatTime(game.seconds)}</strong>
              </div>
              <div className="stat">
                <span className="stat-label">DECK</span>
                <strong>{game.deck.length}</strong>
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="text-button text-button--primary" type="button" onClick={() => setGame(newGame())}>
              New game
            </button>
            <div className="header-options" ref={optionsRef}>
              <button
                className="options-trigger"
                type="button"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((open) => !open)}
              >
                <span className="options-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              {optionsOpen && (
                <div className="options-menu" role="menu" aria-label="Options">
                  <button
                    className="options-menu__item"
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={darkMode}
                    onClick={() => {
                      setDarkMode((enabled) => !enabled);
                      setOptionsOpen(false);
                    }}
                  >
                    <span className="options-menu__check" aria-hidden="true" />
                    Dark mode
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="game-board" aria-label="Set game board">
          <div className="board-toolbar">
            <p className="game-message" aria-live="polite" title={game.message}>{game.message}</p>
          </div>
          <div
            ref={cardGridRef}
            className="card-grid"
            aria-label={`${game.board.length} cards`}
            style={{
              '--card-columns': gridColumns,
              ...(cardLayout === null ? {} : {
                '--card-width': `${cardLayout.width}px`,
                '--card-aspect-ratio': cardLayout.landscape ? '4 / 3' : '3 / 4',
                '--symbol-gap': `${cardLayout.symbolGap}px`,
              }),
            } as CSSProperties}
          >
            {game.board.map(({ id, ...card }) => (
              <Card
                key={id}
                {...card}
                selected={game.selected.includes(id)}
                hinted={game.hintedCardIds.includes(id)}
                disabled={game.finished}
                obscured={!windowFocused}
                obscuredFace={obscuredFaces[id]}
                landscape={cardLayout?.landscape ?? false}
                onClick={() => selectCard(id)}
              />
            ))}
          </div>

          {game.finished && (
            <div className="game-over" role="status">
              <strong>Game complete</strong>
              <span>You found {game.score} {game.score === 1 ? 'Set' : 'Sets'} in {formatTime(game.seconds)}.</span>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

export default App;
