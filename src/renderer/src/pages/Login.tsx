import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useNavigationStore } from '../stores/navigationStore'
import { Eye, EyeOff, Lock, Mail, ShieldAlert, WifiOff } from 'lucide-react'

export default function Login(): React.JSX.Element {
  const { hasUsers, checkHasUsers, login, register, isLoading, error, clearError } = useAuthStore()
  const { setView } = useNavigationStore()

  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showIpConfig, setShowIpConfig] = useState(false)
  const [serverIpInput, setServerIpInput] = useState(
    (window as any).apiServer ? (window as any).apiServer.getIp() : 'localhost'
  )

  // Check if any users exist in the DB when the screen loads
  useEffect(() => {
    checkHasUsers().then((exists) => {
      // If no users exist, switch to register mode to create master key
      if (!exists) {
        setIsRegisterMode(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    clearError()
    setValidationError(null)

    // Basic password validation
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters')
      return
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setValidationError('Please enter your name')
        return
      }
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match')
        return
      }

      const success = await register(name, password)
      if (success) {
        // Go to onboarding wizard first
        setView('onboarding')
      }
    } else {
      const success = await login(password)
      if (success) {
        // Success! Proceed to dashboard
        setView('dashboard')
      }
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle at center, var(--bg-surface) 0%, var(--bg-app) 100%)',
        position: 'relative'
      }}
    >
      {/* 1. Custom Frameless Titlebar controls (need a small one here since main app shell isn't mounted yet) */}
      <div
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 12px',
            '-webkit-app-region': 'drag'
          } as any
        }
      >
        <button
          className="titlebar-btn close"
          style={
            {
              width: 32,
              height: 32,
              '-webkit-app-region': 'no-drag',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            } as any
          }
          onClick={() => window.api.window.close()}
        >
          &times;
        </button>
      </div>

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '40px 32px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* Animated Geometric Logo */}
        <div style={{ marginBottom: 24, position: 'relative' }}>
          <div
            style={{
              width: 64,
              height: 64,
              border: '3px solid var(--color-secondary)',
              borderRadius: '12px',
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 3s infinite ease-in-out',
              boxShadow: '0 0 16px rgba(52, 152, 219, 0.3)'
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--color-accent)',
                borderRadius: '6px',
                transform: 'rotate(-45deg)'
              }}
            />
          </div>
        </div>

        <h2
          className="font-bold text-lg"
          style={{ marginBottom: 8, fontSize: '24px', letterSpacing: '0.5px' }}
        >
          CogniTwin
        </h2>
        <p className="text-muted text-sm" style={{ marginBottom: 32, textAlign: 'center' }}>
          {isRegisterMode
            ? 'Set up your local master password to initialize your personal twin'
            : 'Enter master password to decrypt your digital workspace'}
        </p>

        {/* Errors */}
        {(error || validationError) && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(231, 76, 60, 0.1)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{validationError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {isRegisterMode && (
            <div className="input-group">
              <span className="input-label">YOUR NAME</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ paddingLeft: 38 }}
                />
                <Lock
                  size={16}
                  className="text-muted"
                  style={{ position: 'absolute', left: 14, top: 12 }}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <span className="input-label">MASTER PASSWORD</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field w-full"
                placeholder={isRegisterMode ? 'Choose a strong password' : 'Enter master password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: 38, paddingRight: 40 }}
              />
              <Lock
                size={16}
                className="text-muted"
                style={{ position: 'absolute', left: 14, top: 12 }}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 6,
                  padding: 6,
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isRegisterMode && (
            <div className="input-group">
              <span className="input-label">CONFIRM PASSWORD</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field w-full"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingLeft: 38 }}
                />
                <Lock
                  size={16}
                  className="text-muted"
                  style={{ position: 'absolute', left: 14, top: 12 }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
            style={{ padding: '12px', marginTop: 12 }}
          >
            {isLoading ? 'Processing...' : isRegisterMode ? 'Initialize Twin' : 'Unlock Workspace'}
          </button>
        </form>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            fontSize: '13px'
          }}
        >
          {hasUsers && (
            <a
              className="pointer"
              style={{ color: 'var(--color-secondary)', fontWeight: 600 }}
              onClick={() => {
                setIsRegisterMode(!isRegisterMode)
                clearError()
                setValidationError(null)
              }}
            >
              {isRegisterMode ? 'Back to Login' : 'Create Another Account'}
            </a>
          )}
          {!(window as any).electron && (
            <a
              className="pointer"
              style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
              onClick={() => setShowIpConfig(!showIpConfig)}
            >
              Configure Server IP
            </a>
          )}
        </div>

        {showIpConfig && (
          <div style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="input-label" style={{ fontSize: '11px' }}>CORE SERVER IP ADDRESS</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="input-field"
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                placeholder="e.g. 192.168.1.50"
                value={serverIpInput}
                onChange={(e) => setServerIpInput(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
                onClick={() => {
                  if ((window as any).apiServer) {
                    (window as any).apiServer.setIp(serverIpInput);
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Local-Only Offline Indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '12px',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-surface)',
          padding: '6px 12px',
          borderRadius: 20,
          border: '1px solid var(--border-color)'
        }}
      >
        <WifiOff size={14} className="text-muted" />
        <span>Local-Only Protection Mode (Zero Cloud Sync)</span>
      </div>
    </div>
  )
}
