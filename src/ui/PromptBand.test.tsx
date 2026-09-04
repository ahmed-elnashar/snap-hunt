import { render, screen } from '@testing-library/react-native';

import { NUMERAL_THRESHOLD_MS } from '@/game/scoring';

import { PromptBand } from './PromptBand';

const props = { prompt: 'something round and blue', topInset: 44 };

/**
 * The numeral is deliberately outside the accessibility tree — the timer track
 * announces the time, and reading it twice is worse than not reading it. These
 * are assertions about what is on screen, so they opt into hidden elements.
 */
const HIDDEN = { includeHiddenElements: true } as const;

describe('PromptBand', () => {
  it('shows the prompt', () => {
    render(<PromptBand {...props} remainingMs={20_000} />);
    expect(screen.getByText('something round and blue')).toBeOnTheScreen();
  });

  describe('the countdown numeral', () => {
    it('is absent while there is plenty of time', () => {
      render(<PromptBand {...props} remainingMs={20_000} />);
      expect(screen.queryByText(/^\d{2}$/, HIDDEN)).toBeNull();
    });

    it('appears only in the last five seconds', () => {
      const { rerender } = render(
        <PromptBand {...props} remainingMs={NUMERAL_THRESHOLD_MS + 1000} />,
      );
      expect(screen.queryByText(/^\d{2}$/, HIDDEN)).toBeNull();

      rerender(<PromptBand {...props} remainingMs={NUMERAL_THRESHOLD_MS} />);
      expect(screen.getByText('05', HIDDEN)).toBeOnTheScreen();
    });

    it('counts down whole seconds, padded', () => {
      const { rerender } = render(<PromptBand {...props} remainingMs={4200} />);
      expect(screen.getByText('05', HIDDEN)).toBeOnTheScreen();

      rerender(<PromptBand {...props} remainingMs={3000} />);
      expect(screen.getByText('03', HIDDEN)).toBeOnTheScreen();

      rerender(<PromptBand {...props} remainingMs={400} />);
      expect(screen.getByText('01', HIDDEN)).toBeOnTheScreen();

      rerender(<PromptBand {...props} remainingMs={0} />);
      expect(screen.getByText('00', HIDDEN)).toBeOnTheScreen();
    });

    it('does not scale with Dynamic Type, so the band cannot be forced open', () => {
      render(<PromptBand {...props} remainingMs={2000} />);
      expect(screen.getByText('02', HIDDEN)).toHaveProp('allowFontScaling', false);
    });

    it('never appears on an untimed round', () => {
      render(<PromptBand {...props} remainingMs={null} />);
      expect(screen.queryByText(/^\d{2}$/, HIDDEN)).toBeNull();
    });
  });

  describe('VoiceOver', () => {
    it('reads the time left rather than the visual rule', () => {
      render(<PromptBand {...props} remainingMs={8000} />);
      expect(screen.getByLabelText('8 seconds left')).toBeOnTheScreen();
    });

    it('says second, singular, at one', () => {
      render(<PromptBand {...props} remainingMs={600} />);
      expect(screen.getByLabelText('1 second left')).toBeOnTheScreen();
    });

    it('says there is no limit on the untimed first round', () => {
      render(<PromptBand {...props} remainingMs={null} />);
      expect(screen.getByLabelText('No time limit on this round')).toBeOnTheScreen();
    });

    it('does not read the numeral twice, once as text and once as the timer', () => {
      render(<PromptBand {...props} remainingMs={2000} />);
      expect(screen.getByText('02', HIDDEN)).toHaveProp(
        'accessibilityElementsHidden',
        true,
      );
    });
  });

  describe('the daily challenge', () => {
    it('is marked when it is today’s', () => {
      render(<PromptBand {...props} remainingMs={20_000} isDaily />);
      expect(screen.getByText("Today's submission")).toBeOnTheScreen();
    });

    it('is not marked otherwise', () => {
      render(<PromptBand {...props} remainingMs={20_000} />);
      expect(screen.queryByText("Today's submission")).toBeNull();
    });
  });
});
