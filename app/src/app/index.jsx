// First launch shows a short tour of the app, then a page to sign in, create an account or
// continue as a guest. After that customers go straight to the menu.
// There's no branch to choose: Teecas assigns each order to a branch when it accepts it.

import { Redirect } from 'expo-router';
import { useStore } from '../store';

export default function Index() {
  const { onboarded, account, gateSeen } = useStore();
  const href = !onboarded ? '/welcome' : account || gateSeen ? '/menu' : '/start';
  return <Redirect href={href} />;
}
