import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '알 수 없는 오류가 발생했습니다.' };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[RI Portal] UI crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: 0 }}>화면 오류가 발생했습니다</h2>
        <p style={{ marginTop: 8, marginBottom: 16, color: '#555' }}>{this.state.message}</p>
        <button
          type='button'
          onClick={() => window.location.reload()}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          새로고침
        </button>
      </div>
    );
  }
}
