import { fireEvent, render, screen } from '@testing-library/react-native';

import { MIN_TOUCH_TARGET_PT } from '@/design/tokens';

import { PaperButton } from './PaperButton';

/** Flattens the style prop, which RN gives as an array or a function result. */
function minHeightOf(element: { props: { style?: unknown } }): number {
  const style = element.props.style;
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  const layers: unknown[] = Array.isArray(resolved) ? resolved.flat(9) : [resolved];
  for (const layer of layers) {
    if (typeof layer === 'object' && layer !== null && 'minHeight' in layer) {
      const value = (layer as { minHeight?: unknown }).minHeight;
      if (typeof value === 'number') return value;
    }
  }
  return 0;
}

describe('PaperButton', () => {
  it('presses', () => {
    const onPress = jest.fn();
    render(<PaperButton label="Open Settings" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const onPress = jest.fn();
    render(<PaperButton label="Open Settings" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('never appends an arrow or any other ornament to its label', () => {
    // DESIGN.md: an arrow appended to button text is on the tells list.
    render(<PaperButton label="Hand over the camera" onPress={jest.fn()} />);
    expect(screen.getByText('Hand over the camera')).toBeOnTheScreen();
    expect(screen.queryByText(/[→›>]/)).toBeNull();
  });

  it('omits the hint entirely when none is given', () => {
    render(<PaperButton label="Take it again" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Take it again' })).not.toHaveProp(
      'accessibilityHint',
    );
  });

  it('is at least as tall as the minimum touch target', () => {
    // A 13pt text link shipped once, and the only thing that caught it was
    // trying to tap it on a real screen. This is the assertion that would
    // have caught it instead.
    render(<PaperButton label="Take the next one" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Take the next one' });
    expect(minHeightOf(button)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PT);
  });
});
