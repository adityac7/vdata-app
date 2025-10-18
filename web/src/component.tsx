import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useWidgetProps } from './use-widget-props';
import { useWidgetState } from './use-widget-state';
import { useOpenAiGlobal } from './use-openai-global';

// Types for tool outputs
interface QueryResult {
  query?: string;
  results?: any[];
  columns?: string[];
  rowCount?: number;
  status?: 'success' | 'error' | 'running';
  error?: string;
  message?: string;
  executionTime?: number;
}

interface DashboardState {
  queryHistory: string[];
  selectedTable?: string;
}

// Main Dashboard Component
function VdataAnalyticsDashboard() {
  const toolOutput = useWidgetProps<QueryResult>();
  const [state, setState] = useWidgetState<DashboardState>({
    queryHistory: [],
  });
  const displayMode = useOpenAiGlobal('displayMode');
  const theme = useOpenAiGlobal('theme');

  // Track query history
  useEffect(() => {
    if (toolOutput?.query && !state.queryHistory.includes(toolOutput.query)) {
      setState((prev) => ({
        ...prev,
        queryHistory: [...prev.queryHistory, toolOutput.query!].slice(-10), // Keep last 10
      }));
    }
  }, [toolOutput?.query]);

  const isDark = theme === 'dark';
  const isFullscreen = displayMode === 'fullscreen';

  // Color scheme based on theme
  const colors = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    cardBg: isDark ? '#2d2d2d' : '#f7fafc',
    text: isDark ? '#ffffff' : '#2d3748',
    textMuted: isDark ? '#a0aec0' : '#718096',
    border: isDark ? '#4a5568' : '#e2e8f0',
    accent: '#667eea',
    success: '#48bb78',
    error: '#f56565',
    warning: '#ed8936',
  };

  return (
    <div
      style={{
        padding: isFullscreen ? '32px' : '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: isFullscreen ? '1200px' : '100%',
        margin: '0 auto',
        background: colors.bg,
        color: colors.text,
        minHeight: isFullscreen ? '100vh' : 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
          padding: '24px',
          borderRadius: '12px',
          color: 'white',
          marginBottom: '24px',
        }}
      >
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 600 }}>
          📊 Vdata Analytics
        </h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
          Your PostgreSQL data analytics companion
        </p>
      </div>

      {/* Status Indicator */}
      <div
        style={{
          background: colors.cardBg,
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: toolOutput?.status === 'error' ? colors.error : colors.success,
              animation: toolOutput?.status === 'running' ? 'pulse 2s infinite' : 'none',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: '14px' }}>
              {toolOutput?.status === 'running' && '⏳ Running query...'}
              {toolOutput?.status === 'success' && '✅ Query completed'}
              {toolOutput?.status === 'error' && '❌ Query failed'}
              {!toolOutput?.status && '🟢 Ready to query'}
            </div>
            {toolOutput?.executionTime && (
              <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '4px' }}>
                Execution time: {toolOutput.executionTime}ms
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Query */}
      {toolOutput?.query && (
        <div
          style={{
            background: colors.cardBg,
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Current Query
          </h3>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              background: isDark ? '#1a1a1a' : '#fff',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'Monaco, Consolas, monospace',
              overflow: 'auto',
              border: `1px solid ${colors.border}`,
            }}
          >
            {toolOutput.query}
          </pre>
        </div>
      )}

      {/* Error Display */}
      {toolOutput?.error && (
        <div
          style={{
            background: isDark ? '#3d2020' : '#fff5f5',
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${colors.error}`,
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>❌</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px', color: colors.error }}>
                Error
              </div>
              <div style={{ fontSize: '14px', color: colors.text }}>{toolOutput.error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {toolOutput?.message && !toolOutput?.error && (
        <div
          style={{
            background: colors.cardBg,
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '14px', color: colors.text }}>{toolOutput.message}</div>
        </div>
      )}

      {/* Results Table */}
      {toolOutput?.results && toolOutput.results.length > 0 && (
        <div
          style={{
            background: colors.cardBg,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              Results
            </h3>
            <span
              style={{
                fontSize: '12px',
                color: colors.textMuted,
                background: isDark ? '#1a1a1a' : '#fff',
                padding: '4px 12px',
                borderRadius: '12px',
              }}
            >
              {toolOutput.rowCount || toolOutput.results.length} rows
            </span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: isFullscreen ? '600px' : '400px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: isDark ? '#1a1a1a' : '#edf2f7',
                    position: 'sticky',
                    top: 0,
                  }}
                >
                  {toolOutput.columns?.map((col, idx) => (
                    <th
                      key={idx}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontWeight: 600,
                        borderBottom: `2px solid ${colors.border}`,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {toolOutput.results.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background:
                        rowIdx % 2 === 0
                          ? 'transparent'
                          : isDark
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    {toolOutput.columns?.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        style={{
                          padding: '12px 16px',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row[col] === null || row[col] === undefined
                          ? <span style={{ color: colors.textMuted, fontStyle: 'italic' }}>null</span>
                          : typeof row[col] === 'object'
                          ? JSON.stringify(row[col])
                          : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Query History */}
      {state.queryHistory.length > 0 && (
        <div
          style={{
            background: colors.cardBg,
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Recent Queries
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {state.queryHistory.slice().reverse().map((query, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  background: isDark ? '#1a1a1a' : '#fff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'Monaco, Consolas, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${colors.border}`,
                }}
              >
                {query}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Mount the component
const root = document.getElementById('vdata-root');
if (root) {
  createRoot(root).render(<VdataAnalyticsDashboard />);
}
