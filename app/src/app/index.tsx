// Customers go straight to the menu. There's no branch to choose: Teecas assigns each order to
// a branch when it accepts it.

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/menu" />;
}
