import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useWidgetProps } from './use-widget-props';
import { useWidgetState } from './use-widget-state';
import { useOpenAiGlobal } from './use-openai-global';

interface QueryResult {
  query?: string;
  results?: any[];
  columns?: string[];
  rowCount?: number;
  status?: 'success' | 'error' | 'running';
  error?: string;
  message?: string;
  executionTime?: number;
  truncated?: boolean;
  displayLimit?: number;
}

interface DashboardState {
  queryHistory: string[];
}

function VdataAnalyticsDashboard() {
  const [isReady, setIsReady] = useState(false);
  const toolOutput = useWidgetProps<QueryResult>();
  const [state, setState] = useWidgetState<DashboardState>({ queryHistory: [] });
  const theme = useOpenAiGlobal('theme');
  const displayMode = useOpenAiGlobal('displayMode');

  useEffect(() => {
    if (window.openai) {
      setIsReady(true);
      return;
    }

    const timeout = setTimeout(() => setIsReady(true), 120);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (toolOutput?.query && !state.queryHistory.includes(toolOutput.query)) {
      setState((prev) => ({
        ...prev,
        queryHistory: [...prev.queryHistory, toolOutput.query!].slice(-10),
      }));
    }
  }, [toolOutput?.query]);

  useEffect(() => {
    if (toolOutput) {
      console.log('[Vdata] tool output updated', toolOutput);
    }
  }, [toolOutput]);

  const isDark = theme === 'dark';
  const isFullscreen = displayMode === 'fullscreen';

  const colors = {
    background: isDark ? '#030b16' : '#f5f7fb',
    surface: isDark ? '#0f2034' : '#ffffff',
    card: isDark ? '#132843' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
    muted: isDark ? '#9fb2cc' : '#526079',
    text: isDark ? '#f4f8ff' : '#0f172a',
  };

  const totalRows = typeof toolOutput?.rowCount === 'number'
    ? toolOutput.rowCount
    : toolOutput?.results?.length || 0;

  const statusLabel = (() => {
    if (toolOutput?.status === 'running') return 'Running query';
    if (toolOutput?.status === 'success') return 'Ready';
    if (toolOutput?.status === 'error') return 'Needs attention';
    return 'Idle';
  })();

  const statusIcon = (() => {
    if (toolOutput?.status === 'running') return '⏳';
    if (toolOutput?.status === 'success') return '✅';
    if (toolOutput?.status === 'error') return '⚠️';
    return '🟢';
  })();

  const highlightBanner = (() => {
    if (toolOutput?.status === 'error') {
      return {
        tone: '#fef2f2',
        border: '#fecaca',
        text: toolOutput.error || 'Query failed. Inspect SQL and retry.',
        icon: '⚠️',
      };
    }

    if (toolOutput?.status === 'running') {
      return {
        tone: isDark ? 'rgba(255,255,255,0.04)' : '#edf2ff',
        border: isDark ? 'rgba(255,255,255,0.12)' : '#c7d2fe',
        text: 'Running query and waiting for results...',
        icon: '⏳',
      };
    }

    if (toolOutput?.message) {
      return {
        tone: isDark ? 'rgba(3, 218, 198, 0.08)' : '#e6fffb',
        border: isDark ? 'rgba(3, 218, 198, 0.25)' : '#99f6e4',
        text: toolOutput.message,
        icon: '💡',
      };
    }

    if (toolOutput?.query) {
      return {
        tone: isDark ? 'rgba(255,255,255,0.03)' : '#eef2ff',
        border: isDark ? 'rgba(255,255,255,0.12)' : '#cdd4ff',
        text: 'Query completed. Results are available below.',
        icon: 'ℹ️',
      };
    }

    return null;
  })();

  const cardData = [
    {
      label: 'Status',
      value: `${statusIcon} ${statusLabel}`,
      detail: toolOutput?.status === 'success'
        ? 'Query finished'
        : toolOutput?.status === 'running'
        ? 'Working in the background'
        : toolOutput?.status === 'error'
        ? 'Check SQL and filters'
        : 'Awaiting input',
    },
    {
      label: 'Rows returned',
      value: totalRows ? totalRows.toLocaleString() : '—',
      detail: toolOutput?.truncated && toolOutput?.displayLimit
        ? `showing first ${toolOutput.displayLimit}`
        : 'matches current query',
    },
    {
      label: 'Execution time',
      value: toolOutput?.executionTime ? `${toolOutput.executionTime} ms` : '—',
      detail: toolOutput?.executionTime ? 'last run duration' : 'run a query to measure',
    },
  ];

  if (!isReady) {
    return (
      <div
        style={{
          padding: '32px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          color: '#0f172a',
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '12px' }}>⏳</div>
        Loading VTION dashboard...
      </div>
    );
  }

  if (!window.openai) {
    return (
      <div
        style={{
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fff5f5',
          border: '1px solid #fecaca',
          borderRadius: '12px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#b91c1c' }}>OpenAI SDK unavailable</div>
        <div style={{ fontSize: '14px', color: '#7f1d1d' }}>
          This dashboard must be opened from ChatGPT so the window.openai bridge is available.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: colors.background,
        color: colors.text,
        minHeight: isFullscreen ? '100vh' : 'auto',
        padding: isFullscreen ? '32px 40px' : '20px',
      }}
    >
      <div
        style={{
          background: isDark ? 'linear-gradient(120deg,#041027,#103056)' : 'linear-gradient(120deg,#052047,#0a3c67)',
          borderRadius: '20px',
          padding: '24px',
          color: '#f5f8ff',
          boxShadow: '0 20px 45px rgba(3,12,30,0.4)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.2em', opacity: 0.8 }}>VTION INSIGHTS</div>
            <h1 style={{ margin: '10px 0 6px', fontSize: '26px', fontWeight: 600 }}>FMCG ecommerce pulse</h1>
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.5, fontSize: '14px' }}>
              Lightweight cockpit for monitoring live panel queries, execution status, and recent SQL runs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {['Panel coverage live', 'Auto-detect light/dark', 'Optimized for ChatGPT'].map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(0,0,0,0.18)',
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {cardData.map((card) => (
          <div
            key={card.label}
            style={{
              background: colors.surface,
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              padding: '18px',
              boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 12px 28px rgba(15,23,42,0.08)',
            }}
          >
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.08em' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, margin: '6px 0 4px' }}>{card.value}</div>
            <div style={{ fontSize: '13px', color: colors.muted }}>{card.detail}</div>
          </div>
        ))}
      </div>

      {highlightBanner && (
        <div
          style={{
            borderRadius: '14px',
            border: `1px solid ${highlightBanner.border}`,
            background: highlightBanner.tone,
            padding: '14px 16px',
            marginBottom: '20px',
            color: isDark ? '#f5f5f5' : '#0f172a',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <span>{highlightBanner.icon}</span>
          <span style={{ fontSize: '14px' }}>{highlightBanner.text}</span>
        </div>
      )}

      <div
        style={{
          background: colors.surface,
          borderRadius: '18px',
          border: `1px solid ${colors.border}`,
          padding: '20px',
          marginBottom: '20px',
          boxShadow: isDark ? '0 14px 30px rgba(0,0,0,0.35)' : '0 18px 40px rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.1em' }}>
                Current query
              </div>
              <div
                style={{
                  fontFamily: 'SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: '13px',
                  marginTop: '6px',
                  color: colors.text,
                }}
              >
                {toolOutput?.query ? toolOutput.query : 'No query has been executed yet.'}
              </div>
            </div>
            {toolOutput?.executionTime && (
              <div style={{ fontSize: '13px', color: colors.muted }}>runtime: {toolOutput.executionTime} ms</div>
            )}
          </div>

          {toolOutput?.status === 'error' && (
            <div style={{ color: '#b91c1c', fontSize: '13px' }}>{toolOutput.error}</div>
          )}

          <div
            style={{
              borderRadius: '12px',
              border: `1px dashed ${colors.border}`,
              padding: '16px',
              background: isDark ? 'rgba(4,7,15,0.55)' : '#f8fafc',
            }}
          >
            {toolOutput?.columns && toolOutput?.results && toolOutput.results.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      {toolOutput.columns.map((col) => (
                        <th
                          key={col}
                          style={{
                            textAlign: 'left',
                            padding: '10px 14px',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: colors.muted,
                            borderBottom: `1px solid ${colors.border}`,
                            background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                            position: 'sticky',
                            top: 0,
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
                          background: rowIdx % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                        }}
                      >
                        {toolOutput.columns?.map((col, colIdx) => (
                          <td
                            key={`${rowIdx}-${colIdx}`}
                            style={{
                              padding: '10px 14px',
                              fontSize: '14px',
                              color: colors.text,
                              borderRight:
                                colIdx === (toolOutput.columns?.length ?? 0) - 1
                                  ? 'none'
                                  : `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)'}`,
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              maxWidth: '280px',
                            }}
                          >
                            {row[col] === null || row[col] === undefined
                              ? <span style={{ color: colors.muted }}>null</span>
                              : typeof row[col] === 'object'
                              ? JSON.stringify(row[col])
                              : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {toolOutput?.truncated && toolOutput?.displayLimit && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: colors.muted }}>
                    Showing first {toolOutput.displayLimit} rows.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: colors.muted }}>
                Results will appear here after a successful query.
              </div>
            )}
          </div>
        </div>
      </div>

      {state.queryHistory.length > 0 && (
        <div
          style={{
            background: colors.card,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            padding: '18px',
          }}
        >
          <div style={{ fontSize: '12px', letterSpacing: '0.08em', color: colors.muted, textTransform: 'uppercase' }}>
            Recent queries
          </div>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {state.queryHistory
              .slice()
              .reverse()
              .map((query, idx) => (
                <div
                  key={`${query}-${idx}`}
                  style={{
                    fontFamily: 'SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: '12px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(3,4,7,0.6)' : '#f1f5f9',
                    border: `1px solid ${colors.border}`,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {query}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('vdata-root');
if (root) {
  createRoot(root).render(<VdataAnalyticsDashboard />);
}
