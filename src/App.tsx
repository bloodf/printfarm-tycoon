import { useGame } from './game/store'
import { World } from './world/World'
import { BootScreen, DayReport, MainMenu, PauseMenu } from './ui/screens/Menus'
import { Hud } from './ui/hud/Hud'
import { Laptop } from './ui/laptop/Laptop'
import { PackingStation, PrinterMenu } from './ui/screens/Stations'

export default function App() {
  const screen = useGame((g) => g.screen)
  const overlay = useGame((g) => g.overlay)
  return (
    <>
      <World />
      {screen === 'boot' && <BootScreen />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && (
        <>
          <Hud />
          {overlay === 'laptop' && <Laptop />}
          {overlay === 'printer' && <PrinterMenu />}
          {overlay === 'packing' && <PackingStation />}
          {overlay === 'pause' && <PauseMenu />}
          {overlay === 'report' && <DayReport />}
        </>
      )}
    </>
  )
}
