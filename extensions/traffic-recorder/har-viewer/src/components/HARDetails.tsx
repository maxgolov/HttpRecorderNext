import {
    Button,
    Divider,
    makeStyles,
    Tab,
    TabList,
    Text,
    tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { HAREntryDisplay } from '../types';

const useStyles = makeStyles({
  container: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  tabs: {
    padding: '8px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    marginBottom: '8px',
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  tableRow: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tableCell: {
    padding: '8px 4px',
    verticalAlign: 'top',
  },
  tableCellName: {
    width: '30%',
    fontWeight: 'bold',
    color: tokens.colorNeutralForeground2,
  },
  tableCellValue: {
    wordBreak: 'break-all',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
  },
  codeBlock: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowX: 'auto',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '500px',
    display: 'block',
    margin: '0 auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
  },
  imageContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: '16px',
    borderRadius: '4px',
    textAlign: 'center',
    overflow: 'auto',
    maxHeight: '600px',
  },
  timingsBar: {
    display: 'flex',
    height: '24px',
    marginTop: '8px',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  timingSegment: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: tokens.colorNeutralForegroundInverted,
    padding: '0 4px',
  },
});

interface HARDetailsProps {
  entry: HAREntryDisplay;
  onClose: () => void;
}

type TabValue = 'headers' | 'request' | 'response' | 'timings';

export function HARDetails({ entry, onClose }: HARDetailsProps) {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<TabValue>('headers');

  const renderHeaders = () => (
    <div className={styles.section}>
      <Text className={styles.sectionTitle}>Request Headers</Text>
      <table className={styles.table}>
        <tbody>
          {entry.request.headers.map((header, index) => (
            <tr key={index} className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}>{header.name}</td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{header.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Divider style={{ margin: '20px 0' }} />

      <Text className={styles.sectionTitle}>Response Headers</Text>
      <table className={styles.table}>
        <tbody>
          {entry.response.headers.map((header, index) => (
            <tr key={index} className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}>{header.name}</td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{header.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRequest = () => (
    <div className={styles.section}>
      <Text className={styles.sectionTitle}>General</Text>
      <table className={styles.table}>
        <tbody>
          <tr className={styles.tableRow}>
            <td className={`${styles.tableCell} ${styles.tableCellName}`}>URL</td>
            <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{entry.request.url}</td>
          </tr>
          <tr className={styles.tableRow}>
            <td className={`${styles.tableCell} ${styles.tableCellName}`}>Method</td>
            <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{entry.request.method}</td>
          </tr>
          <tr className={styles.tableRow}>
            <td className={`${styles.tableCell} ${styles.tableCellName}`}>HTTP Version</td>
            <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{entry.request.httpVersion}</td>
          </tr>
        </tbody>
      </table>

      {entry.request.queryString.length > 0 && (
        <>
          <Divider style={{ margin: '20px 0' }} />
          <Text className={styles.sectionTitle}>Query Parameters</Text>
          <table className={styles.table}>
            <tbody>
              {entry.request.queryString.map((param, index) => (
                <tr key={index} className={styles.tableRow}>
                  <td className={`${styles.tableCell} ${styles.tableCellName}`}>{param.name}</td>
                  <td className={`${styles.tableCell} ${styles.tableCellValue}`}>{param.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {entry.request.postData && (
        <>
          <Divider style={{ margin: '20px 0' }} />
          <Text className={styles.sectionTitle}>Request Body</Text>
          <div className={styles.codeBlock}>
            {entry.request.postData.text || 'No body'}
          </div>
        </>
      )}
    </div>
  );

  const renderResponse = () => {
    const isImage = entry.response.content.mimeType.startsWith('image/');
    const isBase64 = entry.response.content.encoding === 'base64';
    let content = entry.response.content.text || 'No content';
    let imageDataUrl = '';
    
    // Handle image content
    if (isImage && isBase64 && entry.response.content.text) {
      imageDataUrl = `data:${entry.response.content.mimeType};base64,${entry.response.content.text}`;
    }
    
    // Try to pretty-print JSON
    if (entry.response.content.mimeType.includes('json')) {
      try {
        const parsed = JSON.parse(content);
        content = JSON.stringify(parsed, null, 2);
      } catch {
        // Keep original if parsing fails
      }
    }

    return (
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>Response Details</Text>
        <table className={styles.table}>
          <tbody>
            <tr className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}>Status</td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>
                {entry.response.status} {entry.response.statusText}
              </td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}>Content-Type</td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>
                {entry.response.content.mimeType}
              </td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}>Size</td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>
                {entry.response.content.size} bytes
              </td>
            </tr>
          </tbody>
        </table>

        <Divider style={{ margin: '20px 0' }} />
        <Text className={styles.sectionTitle}>Response Body</Text>
        
        {isImage && imageDataUrl ? (
          <div className={styles.imageContainer}>
            <img 
              src={imageDataUrl} 
              alt={entry.path}
              className={styles.imagePreview}
              onError={(e) => {
                console.error('Failed to load image:', e);
                e.currentTarget.style.display = 'none';
              }}
            />
            <Text size={200} style={{ marginTop: '8px', display: 'block', color: tokens.colorNeutralForeground2 }}>
              {entry.response.content.mimeType} • {entry.response.content.size} bytes
            </Text>
          </div>
        ) : (
          <div className={styles.codeBlock}>
            {content}
          </div>
        )}
      </div>
    );
  };

  const renderTimings = () => {
    const { timings } = entry;
    const total = entry.time;

    const segments = [
      { name: 'Blocked', value: timings.blocked || 0, color: tokens.colorPaletteRedBackground2 },
      { name: 'DNS', value: timings.dns || 0, color: tokens.colorPaletteYellowBackground2 },
      { name: 'Connect', value: timings.connect || 0, color: tokens.colorPaletteDarkOrangeBackground2 },
      { name: 'Send', value: timings.send, color: tokens.colorPaletteGreenBackground2 },
      { name: 'Wait', value: timings.wait, color: tokens.colorPaletteBlueForeground2 },
      { name: 'Receive', value: timings.receive, color: tokens.colorPalettePurpleBackground2 },
    ].filter(s => s.value > 0);

    return (
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>Timing Breakdown</Text>
        <table className={styles.table}>
          <tbody>
            {segments.map((segment, index) => (
              <tr key={index} className={styles.tableRow}>
                <td className={`${styles.tableCell} ${styles.tableCellName}`}>{segment.name}</td>
                <td className={`${styles.tableCell} ${styles.tableCellValue}`}>
                  {segment.value.toFixed(2)} ms
                </td>
              </tr>
            ))}
            <tr className={styles.tableRow}>
              <td className={`${styles.tableCell} ${styles.tableCellName}`}><strong>Total</strong></td>
              <td className={`${styles.tableCell} ${styles.tableCellValue}`}>
                <strong>{total.toFixed(2)} ms</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className={styles.timingsBar}>
          {segments.map((segment, index) => (
            <div
              key={index}
              className={styles.timingSegment}
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: segment.color,
              }}
              title={`${segment.name}: ${segment.value.toFixed(2)} ms`}
            >
              {segment.value / total > 0.1 && segment.name}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text weight="semibold">{entry.request.method} {entry.path}</Text>
        <Button
          appearance="subtle"
          icon={<Dismiss24Regular />}
          onClick={onClose}
        />
      </div>
      <div className={styles.tabs}>
        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value as TabValue)}
        >
          <Tab value="headers">Headers</Tab>
          <Tab value="request">Request</Tab>
          <Tab value="response">Response</Tab>
          <Tab value="timings">Timings</Tab>
        </TabList>
      </div>
      <div className={styles.content}>
        {selectedTab === 'headers' && renderHeaders()}
        {selectedTab === 'request' && renderRequest()}
        {selectedTab === 'response' && renderResponse()}
        {selectedTab === 'timings' && renderTimings()}
      </div>
    </div>
  );
}
