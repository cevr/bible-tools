import { useKeyboard, type UseKeyboardOptions } from '@opentui/solid';
import type { KeyEvent } from '@opentui/core';

/**
 * Keyboard handler for modal/overlay components.
 * Calls stopPropagation() on every keystroke to prevent
 * parent handlers from firing while this modal is mounted.
 */
export const useModalKeyboard = (
  callback: (key: KeyEvent) => void,
  options?: UseKeyboardOptions,
) => {
  useKeyboard((key) => {
    key.stopPropagation();
    callback(key);
  }, options);
};
