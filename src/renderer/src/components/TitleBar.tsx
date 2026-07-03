import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar(): React.JSX.Element {
  const handleMinimize = (): void => window.api.window.minimize()
  const handleMaximize = (): void => window.api.window.maximize()
  const handleClose = (): void => window.api.window.close()

  return (
    <div className="custom-titlebar">
      <div className="titlebar-logo">
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: 'var(--color-secondary)',
            boxShadow: '0 0 8px var(--color-secondary)'
          }}
        />
        <span>CogniTwin</span>
      </div>
      <div className="titlebar-center">The Personal Digital Twin Workbench</div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title="Maximize">
          <Square size={12} />
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
