interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'predictions', label: 'Predictions', icon: '◈' },
  { id: 'models', label: 'Models', icon: '◇' },
  { id: 'data', label: 'Data', icon: '▤' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
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
      `}</style>
    </div>
  );
}
