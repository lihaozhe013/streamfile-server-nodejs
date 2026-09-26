import { useOutletContext } from 'react-router';
import type { RuntimeFeatures } from '@/types';

export function useFeatures(): RuntimeFeatures {
  return useOutletContext<RuntimeFeatures>();
}
