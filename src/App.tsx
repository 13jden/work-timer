/**
 * Salary Timer — Root Component
 * TASK-001 占位组件,后续任务将逐步替换为完整布局。
 */
export function App() {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: '"Figtree", system-ui, sans-serif',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontWeight: 400,
          fontSize: 32,
          margin: '0 0 8px 0',
        }}
      >
        Salary Timer
      </h1>
      <p style={{ color: '#6B6B6B', fontSize: 14, margin: '0 0 24px 0' }}>
        React 重写脚手架已就绪。详见 <code>docs/plans/tauri-migration/ROADMAP.md</code>。
      </p>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: '#F5F2EA',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <strong>当前阶段:</strong> 阶段 1 / TASK-001 ✅
        <br />
        <strong>下一任务:</strong> TASK-002 — 迁移 compute.ts 纯函数 + 单测
      </div>
    </div>
  );
}