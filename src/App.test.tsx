import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import type { CardProps } from './Card';
import { countSets, isSet } from './setGame';

function findCardTriple(container: HTMLElement, shouldBeSet: boolean): HTMLButtonElement[] | null {
    const shapes: Record<string, CardProps['shape']> = {
        square: 'square',
        squares: 'square',
        circle: 'circle',
        circles: 'circle',
        triangle: 'triangle',
        triangles: 'triangle',
    };
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.set-card'));
    const cards = buttons.map((button) => {
        const [number, color, shading, shape] = button.getAttribute('aria-label')!.split(' ');
        return {
            button,
            card: {
                number: Number(number) as CardProps['number'],
                color: color as CardProps['color'],
                shading: shading as CardProps['shading'],
                shape: shapes[shape],
            },
        };
    });

    for (let first = 0; first < cards.length - 2; first += 1) {
        for (let second = first + 1; second < cards.length - 1; second += 1) {
            for (let third = second + 1; third < cards.length; third += 1) {
                const candidates = [cards[first], cards[second], cards[third]];
                if (isSet(candidates.map(({ card }) => card)) === shouldBeSet) {
                    return candidates.map(({ button }) => button);
                }
            }
        }
    }

    return null;
}

function readObscuredFace(card: HTMLButtonElement) {
    const symbols = Array.from(card.querySelectorAll<SVGSVGElement>('.set-card__symbol'));
    const shape = symbols[0]?.querySelector('circle, polygon, rect:not([width="6"])');
    const fill = shape?.getAttribute('fill');

    return {
        color: card.style.getPropertyValue('--card-surface'),
        shape: shape?.tagName,
        number: symbols.length,
        shading: symbols[0]?.querySelector('pattern')
            ? 'striped'
            : fill === '#fff'
                ? 'solid'
                : 'open',
    };
}

afterEach(() => {
    jest.useRealTimers();
    window.localStorage.clear();
});

it('toggles and remembers dark mode', () => {
    const { container } = render(<App />);
    expect(container.querySelector('header .game-message')).not.toBeInTheDocument();
    expect(container.querySelector('section .game-message')).toBeInTheDocument();
    expect(container.querySelector('.header-leading .text-button--primary')).not.toBeInTheDocument();
    expect(container.querySelector('.header-actions .text-button--primary')).toHaveTextContent('New game');
    expect(container.querySelector('.header-actions .options-trigger')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Dark mode' });

    fireEvent.click(toggle);

    expect(container.querySelector('.App')).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('set-theme')).toBe('dark');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('pauses the timer and blurs the cards while the window is unfocused', () => {
    jest.useFakeTimers();
    const { container } = render(<App />);
    const app = container.querySelector('.App');

    act(() => {
        window.dispatchEvent(new Event('blur'));
    });
    expect(app).toHaveAttribute('data-window-focused', 'false');
    expect(container.querySelectorAll('.set-card--obscured')).toHaveLength(12);
    expect(container.querySelector('.set-card')).toHaveAttribute('aria-label', 'Card hidden while window is unfocused');
    const symbolsPerObscuredCard = Array.from(container.querySelectorAll('.set-card--obscured'))
        .map((card) => card.querySelectorAll('.set-card__symbol').length);
    expect(symbolsPerObscuredCard.every((count) => count >= 1 && count <= 3)).toBe(true);
    const obscuredCards = Array.from(container.querySelectorAll<HTMLButtonElement>('.set-card'));
    let previousFaces = obscuredCards.map(readObscuredFace);

    for (let step = 0; step < 4; step += 1) {
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        const nextFaces = obscuredCards.map(readObscuredFace);
        const changedIndices = nextFaces.flatMap((face, index) => (
            JSON.stringify(face) !== JSON.stringify(previousFaces[index]) ? [index] : []
        ));
        expect(changedIndices).toHaveLength(1);

        const changedProperties = Object.keys(nextFaces[changedIndices[0]]).filter((key) => (
            nextFaces[changedIndices[0]][key as keyof typeof nextFaces[number]]
            !== previousFaces[changedIndices[0]][key as keyof typeof previousFaces[number]]
        ));
        expect(changedProperties.length).toBeGreaterThanOrEqual(2);
        expect(changedProperties.length).toBeLessThanOrEqual(4);
        previousFaces = nextFaces;
    }

    act(() => {
        jest.advanceTimersByTime(4000);
    });
    expect(screen.getByText('0:00')).toBeInTheDocument();

    act(() => {
        window.dispatchEvent(new Event('focus'));
    });
    expect(app).toHaveAttribute('data-window-focused', 'true');
    expect(container.querySelectorAll('.set-card--obscured')).toHaveLength(0);

    act(() => {
        jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0:01')).toBeInTheDocument();
});

it('deducts a point for an incorrect three-card guess', () => {
    const { container } = render(<App />);
    const incorrectTriple = findCardTriple(container, false);
    expect(incorrectTriple).not.toBeNull();

    incorrectTriple!.forEach((button) => fireEvent.click(button));

    expect(screen.getByText('Not a Set. Change your selection and try again.')).toBeInTheDocument();
    const score = Array.from(container.querySelectorAll('.stat')).find((stat) =>
        stat.querySelector('.stat-label')?.textContent === 'SCORE',
    )?.querySelector('strong');
    expect(score?.textContent).toBe('-1');
    expect(container.querySelectorAll('.stat')).toHaveLength(3);
});

it('penalizes an incorrect no-set claim and then offers a single hint', () => {
    const { container } = render(<App />);
    let match = findCardTriple(container, true);
    let attempts = 0;

    while (!match && attempts < 23) {
        fireEvent.click(screen.getByRole('button', { name: 'No Set' }));
        match = findCardTriple(container, true);
        attempts += 1;
    }

    expect(match).not.toBeNull();
    const scoreElement = Array.from(container.querySelectorAll('.stat')).find((stat) =>
        stat.querySelector('.stat-label')?.textContent === 'SCORE',
    )?.querySelector('strong');
    const originalScore = Number(scoreElement?.textContent);
    const setsLeft = countSets(Array.from(container.querySelectorAll<HTMLButtonElement>('.set-card')).map((card) => {
        const [number, color, shading, shape] = card.getAttribute('aria-label')!.split(' ');
        const shapes: Record<string, CardProps['shape']> = {
            square: 'square', squares: 'square',
            circle: 'circle', circles: 'circle',
            triangle: 'triangle', triangles: 'triangle',
        };
        return {
            number: Number(number) as CardProps['number'],
            color: color as CardProps['color'],
            shading: shading as CardProps['shading'],
            shape: shapes[shape],
        };
    }));

    fireEvent.click(screen.getByRole('button', { name: 'No Set' }));
    expect(screen.getByText(new RegExp(`There ${setsLeft === 1 ? 'is' : 'are'} ${setsLeft} Sets? left\\. 1 point deducted\\.`))).toBeInTheDocument();
    expect(scoreElement?.textContent).toBe(String(originalScore - 1));
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(container.querySelectorAll('.set-card--hinted')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'No Set' })).toBeInTheDocument();
});

it('runs a timer, finds a set, and restarts a solo game', () => {
    jest.useFakeTimers();
    const { container } = render(<App />);

    expect(container.querySelectorAll('.set-card')).toHaveLength(12);
    expect(container.querySelectorAll('.set-card__color-code')).toHaveLength(0);
    expect(Array.from(container.querySelectorAll('.set-card')).every((card) =>
        /^[1-3] [RGB] /.test(card.getAttribute('aria-label') ?? ''),
    )).toBe(true);
    expect(screen.getByText('0:00')).toBeInTheDocument();

    act(() => {
        jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeInTheDocument();

    let match = findCardTriple(container, true);
    let attempts = 0;
    while (!match && attempts < 23) {
        fireEvent.click(screen.getByRole('button', { name: 'No Set' }));
        match = findCardTriple(container, true);
        attempts += 1;
    }

    expect(match).not.toBeNull();
    match!.forEach((button) => fireEvent.click(button));
    expect(screen.getByText('Set found!')).toBeInTheDocument();
    expect(container.querySelector('.stat strong')?.textContent).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(container.querySelectorAll('.set-card')).toHaveLength(12);
    expect(container.querySelector('.stat strong')?.textContent).toBe('0');
    expect(screen.getByText('0:00')).toBeInTheDocument();
});