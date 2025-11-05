import {
    makeStyles,
    MessageBar,
    MessageBarBody,
    MessageBarTitle,
    Spinner,
    Text,
    tokens,
} from '@fluentui/react-components';
import { ErrorCircle20Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { HARDetails } from './components/HARDetails';
import { HARTable } from './components/HARTable';
import { HAREntryDisplay, HARFile } from './types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  header: {
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: '12px',
  },
});

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

function App() {
  const styles = useStyles();
  const [harData, setHarData] = useState<HARFile | null>(null);
  const [entries, setEntries] = useState<HAREntryDisplay[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HAREntryDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'harData':
          try {
            const harFile: HARFile = typeof message.data === 'string' 
              ? JSON.parse(message.data) 
              : message.data;
            
            setHarData(harFile);
            
            // Transform entries for display
            const displayEntries: HAREntryDisplay[] = harFile.log.entries.map((entry, index) => {
              const url = new URL(entry.request.url);
              const contentType = entry.response.content.mimeType || 'unknown';
              
              return {
                ...entry,
                id: `entry-${index}`,
                path: url.pathname + url.search,
                method: entry.request.method,
                status: entry.response.status,
                statusText: entry.response.statusText,
                size: entry.response.content.size,
                time: entry.time,
                type: contentType.split(';')[0].split('/').pop() || 'unknown',
              };
            });
            
            setEntries(displayEntries);
            setLoading(false);
          } catch (err) {
            setError(`Failed to parse HAR file: ${err}`);
            setLoading(false);
          }
          break;
          
        case 'error':
          setError(message.message);
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Request HAR data from extension
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>
          <Spinner size="large" label="Loading HAR file..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>
          <MessageBar intent="error" icon={<ErrorCircle20Regular />}>
            <MessageBarBody>
              <MessageBarTitle>Error Loading HAR File</MessageBarTitle>
              {error}
            </MessageBarBody>
          </MessageBar>
        </div>
      </div>
    );
  }

  if (!harData) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>
          <Text>No HAR data available</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text weight="semibold" size={400}>
          {harData.log.creator.name} - {entries.length} requests
        </Text>
      </div>
      <div className={styles.content}>
        <HARTable 
          entries={entries} 
          selectedEntry={selectedEntry}
          onSelectEntry={setSelectedEntry}
        />
        {selectedEntry && (
          <HARDetails 
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
