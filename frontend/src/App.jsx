import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { LoadingProvider, useLoading } from './context/LoadingContext'
import { NetworkDataProvider } from './context/NetworkDataContext'
import SidebarTree from './components/SidebarTree'
import Dashboard from './components/Dashboard'
import ReportTable from './components/ReportTable'
import Escalation from './components/Escalation'
import './App.css'

/** Thin progress bar shown at the top of the viewport while any API call is in-flight */
const GlobalLoadingBar = () => {
  const { isLoading } = useLoading()
  if (!isLoading) return null
  return <div className="global-loading-bar" />
}

function AppShell() {
  return (
    <>
      <GlobalLoadingBar />
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
        <SidebarTree />
        <div style={{ padding: '2.5rem 3rem', flex: 1, fontFamily: 'Inter, sans-serif', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<ReportTable mode="manifest" />} />
            <Route path="/escalation" element={<Escalation />} />
            <Route path="/ict-officers" element={<ReportTable mode="ictOfficers" />} />
            <Route path="/contractors" element={<ReportTable mode="contractors" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
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
