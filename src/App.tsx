import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import BusPage from './components/pages/BusPage'
import MetroPage from './components/pages/MetroPage'
import RailRoadPage from './components/pages/RailRoadPage'
import SbuBusPage from './components/pages/SbuBusPage'

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/bus" element={<BusPage />} />
          <Route path="/sbu-bus" element={<SbuBusPage />} />
          <Route path="/metro" element={<MetroPage />} />
          <Route path="/railroad" element={<RailRoadPage />} />
          <Route path="/" element={<Navigate to="/bus" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}

export default App