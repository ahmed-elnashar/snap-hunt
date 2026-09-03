import { render, screen } from '@testing-library/react-native';

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
