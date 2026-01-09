interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

const tabs = [
  { id: 'predictions', label: 'Predictions', icon: '◈' },
  { id: 'models', label: 'Models', icon: '◇' },
  { id: 'data', label: 'Data', icon: '▤' },
];

export function Sidebar({ activeTab, onTabChange, theme, onThemeToggle }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="text-cyan">◉</span> PREDICTION TERMINAL
      </div>
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="theme-icon">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
      <style>{`
        .sidebar {
          width: 200px;
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
        }
        .sidebar-header {
          padding: 16px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
        }
        .sidebar-nav {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s ease;
        }
        .sidebar-item:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border: none;
        }
        .sidebar-item.active {
          background-color: var(--bg-tertiary);
          color: var(--cyan);
          border: none;
        }
        .sidebar-icon {
          font-size: 14px;
        }
        .sidebar-footer {
          margin-top: auto;
          padding: 8px;
          border-top: 1px solid var(--border-color);
        }
        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          font-size: 12px;
          transition: all 0.15s ease;
        }
        .theme-toggle:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border: none;
        }
        .theme-icon {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
