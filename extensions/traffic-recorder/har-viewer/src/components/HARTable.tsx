import {
    Input,
    Table,
    TableBody,
    TableCell,
    TableCellLayout,
    TableColumnDefinition,
    TableHeader,
    TableHeaderCell,
    TableRow,
    createTableColumn,
    makeStyles,
    tokens,
    useTableFeatures,
    useTableSort
} from '@fluentui/react-components';
import {
    Image20Regular,
    Search20Regular
} from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { HAREntryDisplay } from '../types';

const useStyles = makeStyles({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  searchBar: {
    padding: '8px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  tableContainer: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
  },
  methodBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: '50px',
  },
  methodGet: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground2,
  },
  methodPost: {
    backgroundColor: tokens.colorPaletteBlueForeground2,
    color: tokens.colorNeutralForegroundInverted,
  },
  methodPut: {
    backgroundColor: tokens.colorPaletteDarkOrangeForeground2,
    color: tokens.colorNeutralForegroundInverted,
  },
  methodDelete: {
    backgroundColor: tokens.colorPaletteRedForeground2,
    color: tokens.colorNeutralForegroundInverted,
  },
  methodOther: {
    backgroundColor: tokens.colorNeutralBackground5,
    color: tokens.colorNeutralForeground1,
  },
  statusSuccess: {
    color: tokens.colorPaletteGreenForeground2,
  },
  statusRedirect: {
    color: tokens.colorPaletteBlueForeground2,
  },
  statusError: {
    color: tokens.colorPaletteRedForeground2,
  },
});

interface HARTableProps {
  entries: HAREntryDisplay[];
  selectedEntry: HAREntryDisplay | null;
  onSelectEntry: (entry: HAREntryDisplay) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export function HARTable({ entries, selectedEntry, onSelectEntry }: HARTableProps) {
  const styles = useStyles();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    
    const query = searchQuery.toLowerCase();
    return entries.filter(entry => 
      entry.path.toLowerCase().includes(query) ||
      entry.method.toLowerCase().includes(query) ||
      entry.status.toString().includes(query) ||
      entry.type.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  // Define table columns
  const columns: TableColumnDefinition<HAREntryDisplay>[] = [
    createTableColumn<HAREntryDisplay>({
      columnId: 'method',
      compare: (a, b) => a.method.localeCompare(b.method),
      renderHeaderCell: () => 'Method',
      renderCell: (entry) => {
        const methodClass = 
          entry.method === 'GET' ? styles.methodGet :
          entry.method === 'POST' ? styles.methodPost :
          entry.method === 'PUT' ? styles.methodPut :
          entry.method === 'DELETE' ? styles.methodDelete :
          styles.methodOther;
        
        return (
          <TableCellLayout>
            <span className={`${styles.methodBadge} ${methodClass}`}>
              {entry.method}
            </span>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<HAREntryDisplay>({
      columnId: 'path',
      compare: (a, b) => a.path.localeCompare(b.path),
      renderHeaderCell: () => 'Path',
      renderCell: (entry) => {
        const isImage = entry.response.content.mimeType.startsWith('image/');
        return (
          <TableCellLayout 
            truncate 
            title={entry.path}
            media={isImage ? <Image20Regular /> : undefined}
          >
            {entry.path}
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<HAREntryDisplay>({
      columnId: 'status',
      compare: (a, b) => a.status - b.status,
      renderHeaderCell: () => 'Status',
      renderCell: (entry) => {
        const statusClass = 
          entry.status >= 200 && entry.status < 300 ? styles.statusSuccess :
          entry.status >= 300 && entry.status < 400 ? styles.statusRedirect :
          styles.statusError;
        
        return (
          <TableCellLayout>
            <span className={statusClass}>{entry.status}</span>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<HAREntryDisplay>({
      columnId: 'type',
      compare: (a, b) => a.type.localeCompare(b.type),
      renderHeaderCell: () => 'Type',
      renderCell: (entry) => (
        <TableCellLayout>
          {entry.type}
        </TableCellLayout>
      ),
    }),
    createTableColumn<HAREntryDisplay>({
      columnId: 'size',
      compare: (a, b) => a.size - b.size,
      renderHeaderCell: () => 'Size',
      renderCell: (entry) => (
        <TableCellLayout>
          {formatSize(entry.size)}
        </TableCellLayout>
      ),
    }),
    createTableColumn<HAREntryDisplay>({
      columnId: 'time',
      compare: (a, b) => a.time - b.time,
      renderHeaderCell: () => 'Time',
      renderCell: (entry) => (
        <TableCellLayout>
          {formatTime(entry.time)}
        </TableCellLayout>
      ),
    }),
  ];

  const {
    getRows,
    sort: { getSortDirection, toggleColumnSort, sort },
  } = useTableFeatures(
    {
      columns,
      items: filteredEntries,
    },
    [
      useTableSort({
        defaultSortState: { sortColumn: 'time', sortDirection: 'ascending' },
      }),
    ]
  );

  const rows = sort(getRows());

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <Input
          contentBefore={<Search20Regular />}
          placeholder="Search requests..."
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
        />
      </div>
      <div className={styles.tableContainer}>
        <Table
          className={styles.table}
          sortable
          size="small"
        >
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHeaderCell
                  key={column.columnId}
                  onClick={(e) => toggleColumnSort(e, column.columnId)}
                  sortDirection={getSortDirection(column.columnId)}
                >
                  {column.renderHeaderCell()}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ item }) => (
              <TableRow
                key={item.id}
                onClick={() => onSelectEntry(item)}
                aria-selected={selectedEntry?.id === item.id}
                style={{
                  backgroundColor: selectedEntry?.id === item.id 
                    ? tokens.colorNeutralBackground1Selected 
                    : undefined,
                  cursor: 'pointer',
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.columnId}>
                    {column.renderCell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
