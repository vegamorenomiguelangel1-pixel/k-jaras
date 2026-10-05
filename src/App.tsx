import { AppStore } from './store'
import { Shell } from './components/Shell'

export function App() {
  return (
    <AppStore>
      <Shell />
    </AppStore>
  )
}
