import { useEffect } from 'react';

let activeLockCount = 0;
let previousHtmlOverflow = '';
let previousBodyOverflow = '';
let previousHtmlOverscroll = '';
let previousBodyOverscroll = '';

const lockDocumentScroll = () => {
  if (typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
  }

  activeLockCount += 1;
};

const unlockDocumentScroll = () => {
  if (typeof document === 'undefined' || activeLockCount === 0) return;

  activeLockCount -= 1;

  if (activeLockCount === 0) {
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    document.body.style.overscrollBehavior = previousBodyOverscroll;
  }
};

export const useDocumentScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) return;

    lockDocumentScroll();
    return () => unlockDocumentScroll();
  }, [locked]);
};
