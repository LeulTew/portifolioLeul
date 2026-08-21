import { createContext, useContext } from 'react';

export interface ScrollState {
  progress: number;
  scrollY: number;
}

export const ScrollStateContext = createContext<ScrollState>({
  progress: 0,
  scrollY: 0,
});

export function usePortfolioScroll(): ScrollState {
  return useContext(ScrollStateContext);
}
