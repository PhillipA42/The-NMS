import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { LoadingProvider, useLoading } from './context/LoadingContext'
import { NetworkDataProvider } from './context/NetworkDataContext'
import SidebarTree from './components/SidebarTree'
import Dashboard from './components/Dashboard'
import ReportTable from './components/ReportTable'
import Escalation from './components/Escalation'
import DataLoader from './components/DataLoader'
import './App.css'

/** Thin progress bar shown at the top of the viewport while any API call is in-flight */
const GlobalLoadingBar = () => {
  const { isLoading } = useLoading()
  if (!isLoading) return null
  return <div className="global-loading-bar" />
}

function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <>
      <GlobalLoadingBar />
      <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <SidebarTree
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed(prev => !prev)}
        />
        <main className="app-main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<ReportTable mode="manifest" />} />
            <Route path="/escalation" element={<Escalation />} />
            <Route path="/data-loader" element={<DataLoader />} />
            <Route path="/ict-officers" element={<ReportTable mode="ictOfficers" />} />
            <Route path="/contractors" element={<ReportTable mode="contractors" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

function App() {
  return (
    <LoadingProvider>
      <NetworkDataProvider>
        <Router>
          <AppShell />
        </Router>
      </NetworkDataProvider>
    </LoadingProvider>
  )
}

export default App
