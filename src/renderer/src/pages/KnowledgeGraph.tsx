import React, { useEffect, useRef, useState } from 'react'
import { useKnowledgeGraphStore, GraphNode } from '../stores/knowledgeGraphStore'
import { useModalStore } from '../stores/modalStore'
import ForceGraph2D from 'react-force-graph-2d'
import { ZoomIn, ZoomOut, Maximize2, Search, Network, Info, Link, Tag } from 'lucide-react'

export default function KnowledgeGraph(): React.JSX.Element {
  const { nodes, links, selectedNode, searchQuery, loadGraph, setSelectedNode, setSearchQuery } =
    useKnowledgeGraphStore()

  const { openModal } = useModalStore()

  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 })

  // Update canvas dimensions dynamically to match browser window size
  useEffect(() => {
    loadGraph()

    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      })
    }

    const handleResize = (): void => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleZoomIn = (): void => {
    if (graphRef.current) {
      const zoom = graphRef.current.zoom()
      graphRef.current.zoom(zoom * 1.3, 300)
    }
  }

  const handleZoomOut = (): void => {
    if (graphRef.current) {
      const zoom = graphRef.current.zoom()
      graphRef.current.zoom(zoom * 0.7, 300)
    }
  }

  const handleZoomReset = (): void => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400)
    }
  }

  const handleNodeClick = (node: any): void => {
    setSelectedNode(node as GraphNode)
    // Center viewport on clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 400)
    }
  }

  // Filter nodes by search query
  const filteredNodes = nodes.filter((node) =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Compute graph data
  const graphData = {
    nodes: filteredNodes,
    links: links.filter((link) => {
      // Only draw links if both endpoints are in the filtered nodes list
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target
      return (
        filteredNodes.some((n) => n.id === sourceId) && filteredNodes.some((n) => n.id === targetId)
      )
    })
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        margin: '-24px',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-app)'
      }}
    >
      {/* Search Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          zIndex: 10,
          display: 'flex',
          gap: 8,
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          padding: '6px 12px',
          width: 260
        }}
      >
        <Search size={16} className="text-muted" style={{ marginTop: 2 }} />
        <input
          type="text"
          placeholder="Filter nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-main)',
            outline: 'none',
            fontSize: '13px',
            width: '100%'
          }}
        />
      </div>

      {/* Floating Graph Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          padding: 6
        }}
      >
        <button
          className="btn btn-ghost"
          style={{ padding: 6, borderRadius: 6 }}
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: 6, borderRadius: 6 }}
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: 6, borderRadius: 6 }}
          onClick={handleZoomReset}
          title="Recenter Graph"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* 2D Force Graph Canvas */}
      <div style={{ width: '100%', height: '100%' }}>
        {nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="label"
            nodeColor={(node: any) => node.color || '#3498db'}
            nodeVal={(node: any) => node.val || 8}
            onNodeClick={handleNodeClick}
            linkColor={() => 'var(--border-color)'}
            linkWidth={1.5}
            // Draw labels directly on the canvas for premium UI styling
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px var(--font-sans)`

              // Draw node circle
              const radius = Math.sqrt(node.val || 8) * 2.5
              ctx.beginPath()
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
              ctx.fillStyle = node.color || '#3498db'
              ctx.fill()

              // Node border
              ctx.lineWidth = 1.5 / globalScale
              ctx.strokeStyle =
                selectedNode?.id === node.id ? 'var(--color-accent)' : 'var(--bg-app)'
              ctx.stroke()

              // Draw label text
              if (globalScale > 0.8) {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = 'var(--text-main)'
                ctx.fillText(label, node.x, node.y + radius + 8)
              }
            }}
          />
        )}
      </div>

      {/* Right Drawer: Node Info Panel */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          bottom: 24,
          width: 320,
          zIndex: 10,
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {selectedNode ? (
          <div className="flex flex-col gap-4" style={{ height: '100%' }}>
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    color: 'var(--color-secondary)'
                  }}
                >
                  {selectedNode.type} Node
                </span>
              </div>
              <h4 className="font-semibold text-lg" style={{ marginBottom: 6 }}>
                {selectedNode.label}
              </h4>
            </div>

            <div style={{ flex: 1, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                CONNECTIONS
              </span>

              <div
                className="flex flex-col gap-2"
                style={{ fontSize: '12px', maxHeight: '280px', overflowY: 'auto' }}
              >
                {(() => {
                  const adjacent = links.filter((link) => {
                    const sourceId =
                      typeof link.source === 'object' ? (link.source as any).id : link.source
                    const targetId =
                      typeof link.target === 'object' ? (link.target as any).id : link.target
                    return sourceId === selectedNode.id || targetId === selectedNode.id
                  })

                  if (adjacent.length === 0) {
                    return <span className="text-muted">No links for this node</span>
                  }

                  return adjacent.slice(0, 10).map((link, idx) => {
                    const sourceId =
                      typeof link.source === 'object' ? (link.source as any).id : link.source
                    const targetId =
                      typeof link.target === 'object' ? (link.target as any).id : link.target
                    const neighborId = sourceId === selectedNode.id ? targetId : sourceId
                    const neighbor = nodes.find((n) => n.id === neighborId)

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 8,
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 140
                          }}
                        >
                          {neighbor?.label || neighborId}
                        </span>
                        <span className="font-mono text-muted" style={{ fontSize: '10px' }}>
                          {link.type}
                        </span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            <div
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}
              className="flex flex-col gap-2"
            >
              <button
                className="btn btn-primary w-full"
                onClick={() => openModal('aiQuery', selectedNode.details)}
              >
                🤖 Query Copilot
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setSelectedNode(null)}>
                Clear Selection
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <Network size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <span className="text-sm">
              Click on any node in the knowledge network to inspect connections
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
