import React from 'react';
import { createRoot } from 'react-dom/client';

// Simple component for initial testing
function VdataApp() {
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    // Get data from window.openai if available
    if (typeof window !== 'undefined' && (window as any).openai) {
      const toolOutput = (window as any).openai.toolOutput;
      if (toolOutput) {
        setData(toolOutput);
      }
    }
  }, []);

  return (
    <div style={{
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>
          🎉 Vdata App
        </h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Your data analytics companion
        </p>
      </div>

      <div style={{
        background: '#f7fafc',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#2d3748' }}>
          Status
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'white',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#48bb78',
            display: 'inline-block'
          }}></span>
          <span style={{ color: '#2d3748', fontWeight: 500 }}>
            Connected and Ready
          </span>
        </div>

        {data && (
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '6px',
            marginTop: '12px'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#718096' }}>
              Received Data:
            </h3>
            <pre style={{
              margin: 0,
              fontSize: '12px',
              color: '#2d3748',
              overflow: 'auto'
            }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#edf2f7',
          borderRadius: '6px'
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#4a5568',
            lineHeight: '1.6'
          }}>
            ✅ This is a minimal test app to verify the MCP server and UI integration works correctly.
            Once this is working in ChatGPT, we'll add the full database query functionality!
          </p>
        </div>
      </div>
    </div>
  );
}

// Mount the component
const root = document.getElementById('vdata-root');
if (root) {
  createRoot(root).render(<VdataApp />);
}

