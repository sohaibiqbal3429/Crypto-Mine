import { AppProviders } from '@/providers/AppProviders'
import { AppNavigator } from '@/navigation/AppNavigator'

function App(): JSX.Element {
  return (
    <AppProviders>
      <AppNavigator />
    </AppProviders>
  )
}

export default App
