import { ModernTVLoader } from './loader/ModernTVLoader';
import type { ModernTVLoaderProps } from './loader/ModernTVLoader';

export function Loader(props: ModernTVLoaderProps) {
  return <ModernTVLoader {...props} />;
}

export default Loader;