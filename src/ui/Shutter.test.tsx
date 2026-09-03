import { fireEvent, render, screen } from '@testing-library/react-native';

import { Shutter } from './Shutter';

describe('Shutter', () => {
  it('is reachable by its label rather than by position', () => {
    render(<Shutter onPress={jest.fn()} />);
    expect(screen.getByLabelText('Submit a photograph')).toBeOnTheScreen();
  });

  it('submits when pressed', () => {
    const onPress = jest.fn();
    render(<Shutter onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Submit a photograph'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not submit twice while the office is still dealing with the last one', () => {
    const onPress = jest.fn();
    render(<Shutter onPress={onPress} busy />);
    fireEvent.press(screen.getByLabelText('Submit a photograph'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('tells VoiceOver it is busy, not merely that it is disabled', () => {
    render(<Shutter onPress={jest.fn()} busy />);
    const shutter = screen.getByLabelText('Submit a photograph');
    expect(shutter).toBeDisabled();
    expect(shutter).toBeBusy();
  });

  it('explains itself differently when busy', () => {
    const { rerender } = render(<Shutter onPress={jest.fn()} />);
    expect(screen.getByLabelText('Submit a photograph')).toHaveProp(
      'accessibilityHint',
      'Takes the photograph and hands it to the judge.',
    );
    rerender(<Shutter onPress={jest.fn()} busy />);
    expect(screen.getByLabelText('Submit a photograph')).toHaveProp(
      'accessibilityHint',
      'The office is dealing with your last submission.',
    );
  });
});
