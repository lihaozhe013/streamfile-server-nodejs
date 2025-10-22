import React from 'react';

interface DevToolsPanelProps {
  onLoadTest: () => void;
  onLoadShort: () => void;
}

const DevToolsPanel: React.FC<DevToolsPanelProps> = ({ onLoadTest, onLoadShort }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-2xl z-50 border border-gray-700">
      <h3 className="text-sm font-bold mb-2 text-green-400">🛠️ Dev Tools</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={onLoadTest}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-xs transition-colors"
        >
          Load Full Test
        </button>
        <button
          onClick={onLoadShort}
          className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded text-xs transition-colors"
        >
          Load Short Test
        </button>
        <button
          onClick={() => {
            const custom = prompt('Enter custom markdown:');
            if (custom) (window as any).devTools?.loadCustomContent(custom);
          }}
          className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-xs transition-colors"
        >
          Custom Content
        </button>
      </div>
    </div>
  );
};

export default DevToolsPanel;
