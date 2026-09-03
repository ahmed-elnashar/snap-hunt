import { fireEvent, render, screen } from '@testing-library/react-native';

import { PaperButton } from './PaperButton';

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
});
