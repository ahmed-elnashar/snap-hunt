import { render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';

import { type Verdict } from '@/judge/schema';

import { Ruling } from './Ruling';

const make = (over: Partial<Verdict>): Verdict => ({
  verdict: 'accept',
  confidence: 0.9,
  detected: 'a blue enamel mug',
  reason: 'A blue enamel mug. Round on every axis I can test from here. Admitted.',
  ...over,
});

const props = { imageUri: 'file:///print.jpg', caseNumber: 'NO. 000412' };

describe('Ruling', () => {
  it('stamps an accept ADMITTED', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'accept' })} />);
    expect(screen.getByText('ADMITTED')).toBeOnTheScreen();
  });

  it('stamps a confident reject NOT ADMITTED', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'reject', confidence: 0.9 })} />);
    expect(screen.getByText('NOT ADMITTED')).toBeOnTheScreen();
  });

  it('stamps an unclear ADMITTED, because unclear awards the point', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'unclear', confidence: 0.2 })} />);
    expect(screen.getByText('ADMITTED')).toBeOnTheScreen();
  });

  it('stamps an unsure reject ADMITTED, which is the generous tie-break made visible', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'reject', confidence: 0.4 })} />);
    expect(screen.getByText('ADMITTED')).toBeOnTheScreen();
  });

  it('shows the judge’s ruling verbatim', () => {
    const verdict = make({
      reason: 'A dog. Dogs are not round, whatever their owners maintain.',
    });
    render(<Ruling {...props} verdict={verdict} />);
    expect(screen.getByText(verdict.reason)).toBeOnTheScreen();
  });

  it('announces the ruling through a live region when it lands', () => {
    const verdict = make({});
    render(<Ruling {...props} verdict={verdict} />);
    expect(screen.getByText(verdict.reason)).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
  });

  /**
   * PLAN.md: accept and reject must differ by more than colour. Asserting the
   * words differ is the mechanical half; the shapes differ too (ring vs bar).
   */
  it('distinguishes the two outcomes by word, not only by ink', () => {
    const { rerender } = render(
      <Ruling {...props} verdict={make({ verdict: 'accept' })} />,
    );
    const admitted = screen.getByText('ADMITTED');
    expect(admitted).toBeOnTheScreen();

    rerender(<Ruling {...props} verdict={make({ verdict: 'reject', confidence: 1 })} />);
    expect(screen.queryByText('ADMITTED')).toBeNull();
    expect(screen.getByText('NOT ADMITTED')).toBeOnTheScreen();
  });

  it('labels the stamp for VoiceOver rather than leaving it as loose text', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'reject', confidence: 1 })} />);
    expect(screen.getByLabelText('Stamped not admitted')).toBeOnTheScreen();
  });

  it('names the photograph by what the judge saw', () => {
    render(<Ruling {...props} verdict={make({ detected: 'a fire extinguisher' })} />);
    expect(
      screen.getByLabelText('Your photograph of a fire extinguisher'),
    ).toBeOnTheScreen();
  });

  it('prints the case number', () => {
    render(<Ruling {...props} verdict={make({})} />);
    expect(screen.getByText('NO. 000412')).toBeOnTheScreen();
  });
});

describe('the develop', () => {
  it('says the judge is looking while there is no ruling', () => {
    render(<Ruling {...props} verdict={null} />);
    expect(screen.getByText('The judge is looking.')).toBeOnTheScreen();
  });

  it('shows no stamp before a ruling exists', () => {
    render(<Ruling {...props} verdict={null} />);
    expect(screen.queryByText('ADMITTED')).toBeNull();
    expect(screen.queryByText('NOT ADMITTED')).toBeNull();
  });

  it('labels the developing print as developing', () => {
    render(<Ruling {...props} verdict={null} />);
    expect(screen.getByLabelText('Your photograph, developing')).toBeOnTheScreen();
  });

  it('replaces the waiting line with the ruling when it arrives', () => {
    const { rerender } = render(<Ruling {...props} verdict={null} />);
    rerender(<Ruling {...props} verdict={make({})} />);
    expect(screen.queryByText('The judge is looking.')).toBeNull();
    expect(screen.getByText('ADMITTED')).toBeOnTheScreen();
  });

  it('caps the ruling at three lines, so a long reason cannot grow the card', () => {
    const verdict = make({ reason: 'x'.repeat(140) });
    render(<Ruling {...props} verdict={verdict} />);
    expect(screen.getByText(verdict.reason)).toHaveProp('numberOfLines', 3);
  });
});

describe('the stamp landing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('thumps and sounds at contact, not at the start of the travel', () => {
    render(<Ruling {...props} verdict={make({})} />);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('does not thump while the judge is still looking', () => {
    render(<Ruling {...props} verdict={null} />);
    jest.advanceTimersByTime(5000);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe('with reduce-motion enabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Not "the same animation, instantly". The verdict is presented as a composed
   * still — already landed, still tilted, still off-register — and the physical
   * feedback is not withheld, because reduce-motion is about movement.
   */
  it('presents the finished composition', () => {
    render(<Ruling {...props} verdict={make({ verdict: 'reject', confidence: 1 })} />);
    expect(screen.getByText('NOT ADMITTED')).toBeOnTheScreen();
    expect(screen.getByLabelText('Stamped not admitted')).toBeOnTheScreen();
  });

  it('still shows the ruling', () => {
    const verdict = make({});
    render(<Ruling {...props} verdict={verdict} />);
    expect(screen.getByText(verdict.reason)).toBeOnTheScreen();
  });

  it('still thumps, and immediately rather than after a travel', () => {
    render(<Ruling {...props} verdict={make({})} />);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('is still fully playable: the print, the stamp and the ruling are all there', () => {
    const verdict = make({ detected: 'a blue enamel mug' });
    render(<Ruling {...props} verdict={verdict} />);
    expect(
      screen.getByLabelText('Your photograph of a blue enamel mug'),
    ).toBeOnTheScreen();
    expect(screen.getByText('ADMITTED')).toBeOnTheScreen();
    expect(screen.getByText('NO. 000412')).toBeOnTheScreen();
  });
});
