// First launch shows a short tour of the app; after that customers go straight to the menu.
// There's no branch to choose: Teecas assigns each order to a branch when it accepts it.

import { Redirect } from 'expo-router';
import { useStore } from '../store';

export default function Index() {
  const { onboarded } = useStore();
  return <Redirect href={onboarded ? '/menu' : '/welcome'} />;
}
