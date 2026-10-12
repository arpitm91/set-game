import { countSets, createDeck, createInitialDeal, findSets, hasSet, isSet, removeSetAndRefill } from './setGame';
import type { CardProps } from './Card';

const sameFeatureSet: CardProps[] = [
    { shape: 'square', color: 'R', shading: 'solid', number: 1 },
    { shape: 'square', color: 'R', shading: 'solid', number: 2 },
    { shape: 'square', color: 'R', shading: 'solid', number: 3 },
];

describe('Set rules', () => {
    it('accepts sets where each feature is all the same or all different', () => {
        expect(isSet(sameFeatureSet)).toBe(true);
        expect(isSet([
            sameFeatureSet[0],
            { shape: 'circle', color: 'G', shading: 'striped', number: 2 },
            { shape: 'triangle', color: 'B', shading: 'open', number: 3 },
        ])).toBe(true);
    });

    it('rejects a set when a feature is neither all the same nor all different', () => {
        expect(isSet([
            sameFeatureSet[0],
            sameFeatureSet[1],
            { ...sameFeatureSet[0], shape: 'circle' },
        ])).toBe(false);
    });

    it('requires exactly three cards', () => {
        expect(isSet(sameFeatureSet.slice(0, 2))).toBe(false);
        expect(isSet([...sameFeatureSet, sameFeatureSet[0]])).toBe(false);
    });

    it('builds all 81 unique cards and deals 12', () => {
        const deck = createDeck();
        const deal = createInitialDeal();
        const uniqueCards = new Set(deck.map(({ shape, color, shading, number }) =>
            `${shape}-${color}-${shading}-${number}`,
        ));

        expect(deck).toHaveLength(81);
        expect(uniqueCards.size).toBe(81);
        expect(deal.board).toHaveLength(12);
        expect(deal.deck).toHaveLength(69);
        expect(deal.board.length + deal.deck.length).toBe(81);
        expect(new Set([...deal.board, ...deal.deck].map(({ id }) => id)).size).toBe(81);
    });

    it('detects whether a board contains a set', () => {
        expect(hasSet(sameFeatureSet)).toBe(true);
        expect(hasSet([])).toBe(false);
        expect(findSets(sameFeatureSet)).toEqual([[0, 1, 2]]);
        expect(countSets(sameFeatureSet)).toBe(1);
        expect(countSets([])).toBe(0);
    });

    it('draws replacements only when removing a set leaves nine cards', () => {
        const completeDeck = createDeck();
        const deck = completeDeck.slice(15);
        const board = completeDeck.slice(0, 15);
        const selectedIds = board.slice(0, 3).map(({ id }) => id);

        const expandedResult = removeSetAndRefill(board, deck, selectedIds);
        expect(expandedResult.board).toHaveLength(12);
        expect(expandedResult.deck).toHaveLength(66);

        const refillResult = removeSetAndRefill(
            expandedResult.board,
            expandedResult.deck,
            expandedResult.board.slice(0, 3).map(({ id }) => id),
        );
        expect(refillResult.board).toHaveLength(12);
        expect(refillResult.deck).toHaveLength(63);
    });

    it('keeps replacing sets during a normal 12-card round', () => {
        const completeDeck = createDeck();
        const result = removeSetAndRefill(
            completeDeck.slice(0, 12),
            completeDeck.slice(12),
            completeDeck.slice(0, 3).map(({ id }) => id),
        );

        expect(result.board).toHaveLength(12);
        expect(result.deck).toHaveLength(66);
    });
});