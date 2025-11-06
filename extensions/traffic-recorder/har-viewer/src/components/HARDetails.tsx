import {
  Button,
  Divider,
  makeStyles,
  Tab,
  TabList,
  Text
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import { HAREntryDisplay } from '../types';

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('css', css);

// Custom syntax highlighting theme using VS Code CSS variables
const vscodeTheme: Record<string, React.CSSProperties> = {
  'hljs': {
    display: 'block',
    overflowX: 'auto' as const,
    background: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
  },
  'hljs-comment': { color: 'var(--vscode-editor-foreground)', opacity: 0.6 },
  'hljs-quote': { color: 'var(--vscode-editor-foreground)', opacity: 0.6 },
  'hljs-keyword': { color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  'hljs-selector-tag': { color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  'hljs-literal': { color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  'hljs-number': { color: 'var(--vscode-symbolIcon-numberForeground, #b5cea8)' },
  'hljs-string': { color: 'var(--vscode-symbolIcon-stringForeground, #ce9178)' },
  'hljs-attr': { color: 'var(--vscode-symbolIcon-propertyForeground, #9cdcfe)' },
  'hljs-name': { color: 'var(--vscode-symbolIcon-functionForeground, #dcdcaa)' },
  'hljs-function': { color: 'var(--vscode-symbolIcon-functionForeground, #dcdcaa)' },
  'hljs-variable': { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  'hljs-built_in': { color: 'var(--vscode-symbolIcon-functionForeground, #dcdcaa)' },
  'hljs-tag': { color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  'hljs-title': { color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)' },
};

const useStyles = makeStyles({
  container: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-editor-background)',
  },
  header: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  tabs: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    backgroundColor: 'var(--vscode-editor-background)',
  },
  tab: {
    color: 'var(--vscode-foreground)',
    padding: '6px 12px',
    marginRight: '4px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    marginBottom: '8px',
    fontWeight: 'bold',
    color: 'var(--vscode-editor-foreground)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    backgroundColor: 'var(--vscode-editor-background)',
  },
  tableRow: {
    borderBottom: '1px solid var(--vscode-editorWidget-border)',
  },
  tableCell: {
    padding: '8px 4px',
    verticalAlign: 'top',
    color: 'var(--vscode-editor-foreground)',
  },
  tableCellName: {
    width: '30%',
    fontWeight: 'bold',
    color: 'var(--vscode-descriptionForeground)',
  },
  tableCellValue: {
    wordBreak: 'break-all',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    color: 'var(--vscode-editor-foreground)',
  },
  codeBlock: {
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--vscode-editor-font-size, 13px)',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowX: 'auto',
  },
  plainTextBlock: {
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--vscode-editor-font-size, 13px)',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowX: 'auto',
    margin: '0',
    border: '1px solid var(--vscode-panel-border)',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '500px',
    display: 'block',
    margin: '0 auto',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px',
  },
  imageContainer: {
    backgroundColor: 'var(--vscode-editor-background)',
    padding: '16px',
    borderRadius: '4px',
    textAlign: 'center',
    overflow: 'auto',
    maxHeight: '600px',
    border: '1px solid var(--vscode-panel-border)',
  },
  svgContainer: {
    backgroundColor: 'var(--vscode-editor-background)',
    padding: '16px',
    borderRadius: '4px',
    textAlign: 'center',
    overflow: 'auto',
    maxHeight: '600px',
    border: '1px solid var(--vscode-panel-border)',
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
    color: 'var(--vscode-button-foreground)',
    padding: '0 4px',
  },
});

interface HARDetailsProps {
  entry: HAREntryDisplay;
  onClose: () => void;
}

type TabValue = 'preview' | 'headers' | 'request' | 'response' | 'timings';

export function HARDetails({ entry, onClose }: HARDetailsProps) {
  const styles = useStyles();
  
  // Determine if content is previewable
  const mimeType = entry.response.content.mimeType || '';
  const isPreviewable = 
    mimeType.startsWith('image/') ||
    mimeType.includes('javascript') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('svg') ||
    mimeType.includes('html') ||
    mimeType.includes('css') ||
    mimeType.includes('text/');
  
  const [selectedTab, setSelectedTab] = useState<TabValue>(isPreviewable ? 'preview' : 'headers');

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

  const renderPreview = () => {
    const originalMimeType = entry.response.content.mimeType || '';
    const mimeType = originalMimeType.toLowerCase();
    const isBase64 = entry.response.content.encoding === 'base64';
    const content = entry.response.content.text || '';
    
    if (!content) {
      return (
        <div className={styles.section}>
          <Text>No content to preview</Text>
        </div>
      );
    }

    // Image preview (jpeg, png, webp, gif, etc.)
    if (mimeType.startsWith('image/') && !mimeType.includes('svg')) {
      if (!content) {
        console.error('Image has no content data');
        return (
          <div className={styles.section}>
            <Text>Image data not available</Text>
          </div>
        );
      }
      
      // Convert base64 to blob URL for better performance and reliability
      let imageUrl = '';
      try {
        console.log('Creating image preview:', { 
          originalMimeType, 
          isBase64, 
          encoding: entry.response.content.encoding,
          contentLength: content.length,
          contentPreview: content.substring(0, 100)
        });
        
        if (isBase64 && content.length > 0) {
          const binaryString = atob(content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: originalMimeType });
          imageUrl = URL.createObjectURL(blob);
          console.log('Created blob URL:', imageUrl);
        } else {
          console.error('Image is not base64 encoded or content is empty', { isBase64, contentLength: content.length });
          return (
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Image Preview</Text>
              <Text>Image content is not available (not base64 encoded)</Text>
            </div>
          );
        }
      } catch (error) {
        console.error('Failed to create image URL:', error);
        return (
          <div className={styles.section}>
            <Text>Failed to decode image data: {String(error)}</Text>
          </div>
        );
      }
      
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>Image Preview</Text>
          <div className={styles.imageContainer}>
            <img 
              src={imageUrl} 
              alt={entry.path}
              className={styles.imagePreview}
              onLoad={() => {
                console.log('Image loaded successfully:', originalMimeType, imageUrl);
              }}
              onError={(e) => {
                console.error('Failed to load image:', { 
                  originalMimeType, 
                  isBase64, 
                  contentLength: content.length,
                  imageUrl,
                  error: e 
                });
              }}
            />
            <Text size={200} style={{ marginTop: '8px', display: 'block', color: 'var(--vscode-descriptionForeground)' }}>
              {originalMimeType} • {entry.response.content.size} bytes
            </Text>
          </div>
        </div>
      );
    }

    // SVG preview (render as image and show code)
    if (mimeType.includes('svg')) {
      const svgContent = isBase64 ? atob(content) : content;
      const svgDataUrl = `data:image/svg+xml;base64,${isBase64 ? content : btoa(svgContent)}`;
      
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>SVG Preview</Text>
          <div className={styles.svgContainer}>
            <img 
              src={svgDataUrl} 
              alt={entry.path}
              className={styles.imagePreview}
              onError={(e) => {
                console.error('Failed to load SVG:', e);
              }}
            />
          </div>
          <Divider style={{ margin: '20px 0' }} />
          <Text className={styles.sectionTitle}>SVG Source</Text>
          <SyntaxHighlighter 
            language="xml" 
            style={vscodeTheme}
            customStyle={{
              borderRadius: '4px',
              fontSize: 'var(--vscode-editor-font-size, 13px)',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              lineHeight: '1.6',
              margin: 0,
              padding: '16px',
              border: '1px solid var(--vscode-panel-border)',
            }}
            showLineNumbers
            wrapLines
            lineNumberStyle={{ 
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--vscode-editorLineNumber-foreground)',
              userSelect: 'none',
            }}
          >
            {svgContent}
          </SyntaxHighlighter>
        </div>
      );
    }

    // JavaScript preview with syntax highlighting
    if (mimeType.includes('javascript') || mimeType.includes('ecmascript')) {
      const code = isBase64 ? atob(content) : content;
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>JavaScript Preview</Text>
          <SyntaxHighlighter 
            language="javascript" 
            style={vscodeTheme}
            customStyle={{
              borderRadius: '4px',
              fontSize: 'var(--vscode-editor-font-size, 13px)',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              lineHeight: '1.6',
              margin: 0,
              padding: '16px',
              border: '1px solid var(--vscode-panel-border)',
            }}
            showLineNumbers
            wrapLines
            lineNumberStyle={{ 
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--vscode-editorLineNumber-foreground)',
              userSelect: 'none',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    // JSON preview with syntax highlighting
    if (mimeType.includes('json')) {
      const code = isBase64 ? atob(content) : content;
      let formattedJson = code;
      try {
        formattedJson = JSON.stringify(JSON.parse(code), null, 2);
      } catch {
        // Use original if parsing fails
      }
      
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>JSON Preview</Text>
          <SyntaxHighlighter 
            language="json" 
            style={vscodeTheme}
            customStyle={{
              borderRadius: '4px',
              fontSize: 'var(--vscode-editor-font-size, 13px)',
              lineHeight: '1.6',
              margin: 0,
              padding: '16px',
              border: '1px solid var(--vscode-panel-border)',
            }}
            showLineNumbers
            wrapLines
            lineNumberStyle={{ 
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--vscode-editorLineNumber-foreground)',
              userSelect: 'none',
            }}
          >
            {formattedJson}
          </SyntaxHighlighter>
        </div>
      );
    }

    // HTML/XML preview with syntax highlighting
    if (mimeType.includes('html') || mimeType.includes('xml')) {
      const code = isBase64 ? atob(content) : content;
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>
            {mimeType.includes('html') ? 'HTML' : 'XML'} Preview
          </Text>
          <SyntaxHighlighter 
            language="xml" 
            style={vscodeTheme}
            customStyle={{
              borderRadius: '4px',
              fontSize: 'var(--vscode-editor-font-size, 13px)',
              lineHeight: '1.6',
              margin: 0,
              padding: '16px',
              border: '1px solid var(--vscode-panel-border)',
            }}
            showLineNumbers
            wrapLines
            lineNumberStyle={{ 
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--vscode-editorLineNumber-foreground)',
              userSelect: 'none',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    // CSS preview with syntax highlighting
    if (mimeType.includes('css')) {
      const code = isBase64 ? atob(content) : content;
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>CSS Preview</Text>
          <SyntaxHighlighter 
            language="css" 
            style={vscodeTheme}
            customStyle={{
              borderRadius: '4px',
              fontSize: 'var(--vscode-editor-font-size, 13px)',
              lineHeight: '1.6',
              margin: 0,
              padding: '16px',
              border: '1px solid var(--vscode-panel-border)',
            }}
            showLineNumbers
            wrapLines
            lineNumberStyle={{ 
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--vscode-editorLineNumber-foreground)',
              userSelect: 'none',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Plain text preview (for text/* types)
    if (mimeType.startsWith('text/')) {
      const text = isBase64 ? atob(content) : content;
      return (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>Text Preview</Text>
          <pre className={styles.plainTextBlock}>{text}</pre>
        </div>
      );
    }

    // Fallback for other types
    return (
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>Content Preview</Text>
        <Text>
          Preview not available for {mimeType}. View in Response tab.
        </Text>
      </div>
    );
  };

  const renderResponse = () => {
    const isImage = entry.response.content.mimeType?.startsWith('image/') ?? false;
    const isBase64 = entry.response.content.encoding === 'base64';
    let content = entry.response.content.text || 'No content';
    let imageUrl = '';
    
    // Handle image content with blob URL
    if (isImage && isBase64 && entry.response.content.text) {
      try {
        const binaryString = atob(entry.response.content.text);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: entry.response.content.mimeType || 'image/png' });
        imageUrl = URL.createObjectURL(blob);
      } catch (error) {
        console.error('Failed to create blob URL for image:', error);
      }
    }
    
    // Try to pretty-print JSON
    if ((entry.response.content.mimeType || '').includes('json')) {
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
        
        {isImage && imageUrl ? (
          <div className={styles.imageContainer}>
            <img 
              src={imageUrl} 
              alt={entry.path}
              className={styles.imagePreview}
              onError={(e) => {
                console.error('Failed to load image:', e);
                e.currentTarget.style.display = 'none';
              }}
            />
            <Text size={200} style={{ marginTop: '8px', display: 'block', color: 'var(--vscode-descriptionForeground)' }}>
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
      { name: 'Blocked', value: timings.blocked || 0, color: '#f48771' },
      { name: 'DNS', value: timings.dns || 0, color: '#ffd43b' },
      { name: 'Connect', value: timings.connect || 0, color: '#ff922b' },
      { name: 'Send', value: timings.send, color: '#51cf66' },
      { name: 'Wait', value: timings.wait, color: '#339af0' },
      { name: 'Receive', value: timings.receive, color: '#cc5de8' },
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
          {isPreviewable && <Tab value="preview" className={styles.tab}>Preview</Tab>}
          <Tab value="headers" className={styles.tab}>Headers</Tab>
          <Tab value="request" className={styles.tab}>Request</Tab>
          <Tab value="response" className={styles.tab}>Response</Tab>
          <Tab value="timings" className={styles.tab}>Timings</Tab>
        </TabList>
      </div>
      <div className={styles.content}>
        {selectedTab === 'preview' && renderPreview()}
        {selectedTab === 'headers' && renderHeaders()}
        {selectedTab === 'request' && renderRequest()}
        {selectedTab === 'response' && renderResponse()}
        {selectedTab === 'timings' && renderTimings()}
      </div>
    </div>
  );
}

