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
  truncated?: boolean;
  displayLimit?: number;
}

interface DashboardState {
  queryHistory: string[];
  selectedTable?: string;
}

// Main Dashboard Component
function VdataAnalyticsDashboard() {
  const [isReady, setIsReady] = useState(false);
  const toolOutput = useWidgetProps<QueryResult>();
  const [state, setState] = useWidgetState<DashboardState>({
    queryHistory: [],
  });
  const displayMode = useOpenAiGlobal('displayMode');
  const theme = useOpenAiGlobal('theme');

  // Initialize and verify window.openai is available
  useEffect(() => {
    console.log('[Vdata] Component mounted');
    console.log('[Vdata] window.openai exists:', !!window.openai);

    if (window.openai) {
      console.log('[Vdata] OpenAI SDK available');
      console.log('[Vdata] Theme:', window.openai.theme);
      console.log('[Vdata] Display mode:', window.openai.displayMode);
      console.log('[Vdata] Tool output:', window.openai.toolOutput);
      setIsReady(true);
    } else {
      console.warn('[Vdata] window.openai not available yet - will retry');

      // Retry after a short delay in case it's still loading
      const timeout = setTimeout(() => {
        if (window.openai) {
          console.log('[Vdata] OpenAI SDK now available after retry');
          setIsReady(true);
        } else {
          console.error('[Vdata] window.openai still not available - component may not work correctly');
          // Still set ready to show error state
          setIsReady(true);
        }
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, []);

  // Track query history
  useEffect(() => {
    if (toolOutput?.query && !state.queryHistory.includes(toolOutput.query)) {
      console.log('[Vdata] New query received:', toolOutput.query);
      setState((prev) => ({
        ...prev,
        queryHistory: [...prev.queryHistory, toolOutput.query!].slice(-10), // Keep last 10
      }));
    }
  }, [toolOutput?.query]);

  // Debug: Log whenever toolOutput changes
  useEffect(() => {
    if (toolOutput) {
      console.log('[Vdata] Tool output updated:', {
        status: toolOutput.status,
        query: toolOutput.query,
        rowCount: toolOutput.rowCount,
        hasResults: !!toolOutput.results,
        resultsLength: toolOutput.results?.length
      });
    }
  }, [toolOutput]);

  const isDark = theme === 'dark';
  const isFullscreen = displayMode === 'fullscreen';

  // VTION-forward palette rooted in the brand's neon teal + indigo spectrum
  const colors = {
    bg: isDark ? '#020c1a' : '#f2f6ff',
    cardBg: isDark ? '#0d1f39' : '#ffffff',
    subtleCardBg: isDark ? 'rgba(10, 22, 43, 0.8)' : '#f0f4ff',
    text: isDark ? '#f4f8ff' : '#0d1f39',
    textMuted: isDark ? '#92a7c6' : '#5d6f92',
    border: isDark ? '#1b345c' : '#cfd8ec',
    accent: '#00f5d4',
    accentSecondary: '#7a5cff',
    accentWarm: '#ff8a3c',
    success: '#34d399',
    error: '#ff6b6b',
    warning: '#ffd166',
  };

  const heroGradient = isDark
    ? 'linear-gradient(135deg, rgba(1,20,54,0.95) 0%, rgba(5,41,99,0.95) 45%, rgba(0,245,212,0.15) 100%)'
    : 'linear-gradient(135deg, #0a1f3f 0%, #4d2fcf 55%, #00f5d4 100%)';

  const totalRows = typeof toolOutput?.rowCount === 'number'
    ? toolOutput.rowCount
    : toolOutput?.results?.length || 0;

  const statusLabel = (() => {
    if (toolOutput?.status === 'running') return 'Running query';
    if (toolOutput?.status === 'success') return 'Query completed';
    if (toolOutput?.status === 'error') return 'Query failed';
    return 'Ready';
  })();

  const statusIcon = (() => {
    if (toolOutput?.status === 'running') return '⏳';
    if (toolOutput?.status === 'success') return '✅';
    if (toolOutput?.status === 'error') return '⚠️';
    return '🟢';
  })();

  const guidanceSections = [
    {
      title: 'Role & Panel',
      items: [
        'Role: eCom analyst for FMCG India',
        'Panel: consented Android users (India)',
        'Core static table: user_static (≈850 cells)',
      ],
    },
    {
      title: 'Weighting & Population math',
      items: [
        '1 weight unit = 1,000 individuals',
        'Population metric = SUM(metric × weight × 1000)',
        'Always return weighted people-level outputs',
      ],
    },
    {
      title: 'Time rules',
      items: [
        'Default base period: last month',
        'Trend period: trailing 3 months',
        'Drop / flag data older than 2 years (event_date filter)',
      ],
    },
    {
      title: 'NCCS merge logic',
      items: [
        'A/A1 → A',
        'B → B',
        'C/D/E → CDE',
      ],
    },
  ];

  const outputExpectations = [
    'Markdown tables with quantified metrics',
    'Report statistical significance (p < 0.05)',
    'Low-verbosity, high-signal commentary',
    'Always clarify filters: TG + time + NCCS merge + event_date >= NOW()-2yr',
  ];

  const dataUsageRules = [
    'Cuts: age, gender, merged NCCS, townclass, state, zone',
    'Funnel: ads → search → pdp_visit / category_visit → add_to_cart',
    'Event-level work must leverage event types for funnel behavior',
  ];

  const intendedUsers = ['CMI teams', 'Brand managers', 'Ecom teams (FMCG focus)'];
  const jobsToBeDone = [
    'Plan and measure campaigns',
    'Understand time spent & engagement by app, time, and segments',
    'Track competition and share of voice',
    'Identify gaps, white spaces, and TG plays',
  ];

  const systemSteps = [
    'Apply TG filters + NCCS merge + event_date >= NOW() - 2 years',
    'Use weighted expressions: SUM(metric × weight × 1000)',
    'Return tables + p-values + crisp commentary',
  ];

  const metricCards = [
    {
      label: 'Status',
      value: `${statusIcon} ${statusLabel}`,
      subLabel:
        toolOutput?.status === 'error'
          ? 'Check SQL or database connectivity'
          : 'Pipeline via MCP + PostgreSQL',
      accent: colors.accent,
    },
    {
      label: 'Rows surfaced',
      value: totalRows.toLocaleString(),
      subLabel: toolOutput?.truncated
        ? `showing first ${toolOutput.displayLimit ?? 5} rows`
        : 'complete payload',
      accent: colors.accentSecondary,
    },
    {
      label: 'Execution time',
      value: toolOutput?.executionTime ? `${toolOutput.executionTime} ms` : '—',
      subLabel: toolOutput?.executionTime ? 'wall-clock for last query' : 'awaiting run',
      accent: colors.accentWarm,
    },
  ];

  // Show loading state if not ready yet
  if (!isReady) {
    return (
      <div style={{
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div>Loading Vdata Analytics...</div>
      </div>
    );
  }

  // Show error state if window.openai is not available
  if (!window.openai) {
    return (
      <div style={{
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#fff5f5',
        border: '1px solid #f56565',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#c53030' }}>
          OpenAI SDK Not Available
        </div>
        <div style={{ fontSize: '14px', color: '#742a2a' }}>
          The window.openai bridge is not available. This component needs to run in the ChatGPT environment.
        </div>
        <div style={{ fontSize: '12px', color: '#742a2a', marginTop: '12px', fontFamily: 'monospace' }}>
          Debug: Check browser console for more information
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: isFullscreen ? '32px 48px' : '24px',
        fontFamily: "'Inter', 'Space Grotesk', system-ui, -apple-system, sans-serif",
        maxWidth: isFullscreen ? '1280px' : '100%',
        margin: '0 auto',
        background: colors.bg,
        color: colors.text,
        minHeight: isFullscreen ? '100vh' : 'auto',
      }}
    >
      {/* Hero */}
      <div
        style={{
          background: heroGradient,
          padding: '28px',
          borderRadius: '24px',
          marginBottom: '24px',
          color: '#f4f8ff',
          boxShadow: '0 25px 60px rgba(3, 8, 26, 0.55)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                opacity: 0.8,
                fontWeight: 600,
              }}
            >
              VTION ANALYST OPS
            </div>
            <h1 style={{ margin: '10px 0 12px', fontSize: '28px', fontWeight: 700 }}>
              FMCG ecommerce intelligence cockpit
            </h1>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, opacity: 0.9 }}>
              You are the ecommerce analyst for India FMCG brands. Blend panel truth from consented Android users with weighted
              outputs to answer CMI, brand, and ecommerce team questions.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
              {['Panel: Android users, India', 'Base period: last month', 'Trend: trailing 3 months'].map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'rgba(0, 0, 0, 0.25)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 260px',
              background: 'rgba(1, 7, 18, 0.35)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>System guardrails</div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {systemSteps.map((step, idx) => (
                <li
                  key={step}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', lineHeight: 1.4 }}
                >
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.15)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ flex: 1 }}>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {metricCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '18px',
              padding: '20px',
              boxShadow: '0 15px 35px rgba(3, 8, 26, 0.25)',
            }}
          >
            <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
              {card.label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, margin: '6px 0' }}>{card.value}</div>
            <div style={{ fontSize: '13px', color: colors.textMuted }}>{card.subLabel}</div>
            <div
              style={{
                marginTop: '14px',
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ width: '65%', height: '100%', borderRadius: '2px', background: card.accent }} />
            </div>
          </div>
        ))}
      </div>

      {/* Business context */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {guidanceSections.map((section) => (
          <div
            key={section.title}
            style={{
              background: colors.cardBg,
              borderRadius: '20px',
              padding: '20px',
              border: `1px solid ${colors.border}`,
              minHeight: '210px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>{section.title}</div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              {section.items.map((item) => (
                <li key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ color: colors.accent }}>●</span>
                  <span style={{ color: colors.text }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div
          style={{
            background: colors.cardBg,
            borderRadius: '20px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>
            Business logic & output guardrails
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            {outputExpectations.map((item) => (
              <li key={item} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: colors.accentSecondary }}>◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            background: colors.cardBg,
            borderRadius: '20px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>Data usage & funnel</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            {dataUsageRules.map((rule) => (
              <li key={rule} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: colors.accent }}>↳</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: '12px',
              background: colors.subtleCardBg,
              fontSize: '12px',
              color: colors.textMuted,
            }}
          >
            Event funnel order: ads → search → pdp_visit / category_visit → add_to_cart
          </div>
        </div>
        <div
          style={{
            background: colors.cardBg,
            borderRadius: '20px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>Teams & JTBD</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {intendedUsers.map((team) => (
              <span
                key={team}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${colors.border}`,
                  background: colors.subtleCardBg,
                }}
              >
                {team}
              </span>
            ))}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            {jobsToBeDone.map((job) => (
              <li key={job} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: colors.accentWarm }}>▹</span>
                <span>{job}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Message Display */}
      {toolOutput?.message && !toolOutput?.error && (
        <div
          style={{
            background: colors.cardBg,
            padding: '18px',
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          {toolOutput.message}
        </div>
      )}

      {/* Error Display */}
      {toolOutput?.error && (
        <div
          style={{
            background: isDark ? 'rgba(255, 107, 107, 0.12)' : '#fff5f5',
            padding: '18px',
            borderRadius: '16px',
            border: `1px solid ${colors.error}`,
            marginBottom: '24px',
            color: colors.error,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Query error</div>
          <div style={{ fontSize: '14px', color: isDark ? '#ffd8d8' : colors.error }}>{toolOutput.error}</div>
        </div>
      )}

      {/* Current Query */}
      {toolOutput?.query && (
        <div
          style={{
            background: colors.cardBg,
            padding: '18px',
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
            Current query
          </div>
          <pre
            style={{
              margin: '12px 0 0',
              padding: '14px',
              background: isDark ? '#030915' : '#f7f8ff',
              borderRadius: '12px',
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

      {/* Results Table */}
      {toolOutput?.results && toolOutput.results.length > 0 && (
        <div
          style={{
            background: colors.cardBg,
            borderRadius: '20px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
            marginBottom: '24px',
            boxShadow: '0 18px 45px rgba(3, 8, 26, 0.35)',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Result table</h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: colors.textMuted }}>
                Weighted outputs expected · include p-values and TG filters in narrative
              </p>
              {toolOutput?.truncated && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: colors.warning }}>
                  Showing first {toolOutput.displayLimit ?? 5} rows (total {totalRows}).
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: colors.text,
                background: colors.subtleCardBg,
                padding: '6px 14px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              {totalRows} rows
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: isFullscreen ? '600px' : '420px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                background: isDark ? '#040d1f' : '#fff',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: colors.subtleCardBg,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {toolOutput.columns?.map((col, idx) => (
                    <th
                      key={idx}
                      style={{
                        textAlign: 'left',
                        padding: '14px 18px',
                        fontWeight: 600,
                        borderBottom: `2px solid ${colors.border}`,
                        color: colors.text,
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
                          padding: '12px 18px',
                          maxWidth: '320px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          borderRight:
                            colIdx === (toolOutput.columns?.length ?? 0) - 1
                              ? 'none'
                              : `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}`,
                        }}
                      >
                        {row[col] === null || row[col] === undefined ? (
                          <span style={{ color: colors.textMuted, fontStyle: 'italic' }}>null</span>
                        ) : typeof row[col] === 'object' ? (
                          JSON.stringify(row[col])
                        ) : (
                          String(row[col])
                        )}
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
            padding: '18px',
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
            Recent queries
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {state.queryHistory
              .slice()
              .reverse()
              .map((query, idx) => (
                <div
                  key={`${query}-${idx}`}
                  style={{
                    padding: '10px 14px',
                    background: colors.subtleCardBg,
                    borderRadius: '10px',
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
