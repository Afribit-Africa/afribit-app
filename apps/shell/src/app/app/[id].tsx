import { useLocalSearchParams } from 'expo-router';
import { FeatureHost } from '../../shell/FeatureHost';

export default function FeatureRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FeatureHost id={typeof id === 'string' ? id : ''} />;
}
