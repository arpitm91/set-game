import type { CardColor, CardProps, CardShape, CardShading } from './Card';

export type GameCard = CardProps & { id: number };

export type RemoveSetResult = {
    board: GameCard[];
    deck: GameCard[];
};

const shapes: CardShape[] = ['square', 'circle', 'triangle'];
const colors: CardColor[] = ['R', 'G', 'B'];
const shadings: CardShading[] = ['solid', 'striped', 'open'];
const numbers: CardProps['number'][] = [1, 2, 3];
const attributes = ['shape', 'color', 'shading', 'number'] as const;

export function createDeck(): GameCard[] {
    const deck: GameCard[] = [];

    shapes.forEach((shape) => {
        colors.forEach((color) => {
            shadings.forEach((shading) => {
                numbers.forEach((number) => {
                    deck.push({ id: deck.length, shape, color, shading, number });
                });
            });
        });
    });

    return deck;
}

function shuffleDeck(deck: GameCard[]): GameCard[] {
    for (let index = deck.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
}

export function createInitialDeal(): { board: GameCard[]; deck: GameCard[] } {
    const deck = shuffleDeck(createDeck());

    return { board: deck.splice(0, 12), deck };
}

export function isSet(cards: readonly CardProps[]): boolean {
    if (cards.length !== 3) {
        return false;
    }

    return attributes.every((attribute) => {
        const distinctValues = new Set(cards.map((card) => card[attribute]));
        return distinctValues.size === 1 || distinctValues.size === 3;
    });
}

export function findSets(cards: readonly CardProps[]): number[][] {
    const sets: number[][] = [];

    for (let first = 0; first < cards.length - 2; first += 1) {
        for (let second = first + 1; second < cards.length - 1; second += 1) {
            for (let third = second + 1; third < cards.length; third += 1) {
                if (isSet([cards[first], cards[second], cards[third]])) {
                    sets.push([first, second, third]);
                }
            }
        }
    }

    return sets;
}

export function hasSet(cards: readonly CardProps[]): boolean {
    return findSets(cards).length > 0;
}

export function countSets(cards: readonly CardProps[]): number {
    return findSets(cards).length;
}

export function removeSetAndRefill(
    board: GameCard[],
    deck: GameCard[],
    selectedIds: readonly number[],
): RemoveSetResult {
    const selectedCardIds = new Set(selectedIds);
    const cardsAfterRemoval = board.filter((card) => !selectedCardIds.has(card.id));
    const replacements = cardsAfterRemoval.length === 9 ? deck.slice(0, 3) : [];
    let replacementIndex = 0;
    const nextBoard = board.reduce<GameCard[]>((remainingCards, card) => {
        if (!selectedCardIds.has(card.id)) {
            remainingCards.push(card);
        } else if (replacements[replacementIndex]) {
            remainingCards.push(replacements[replacementIndex]);
            replacementIndex += 1;
        }
        return remainingCards;
    }, []);

    return {
        board: nextBoard,
        deck: deck.slice(replacementIndex),
    };
}