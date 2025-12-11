import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

type Supplier = {
  id: string;
  name: string;
  country: string;
  actor_variant?: string | null;
};

type DealerSupplierItem = {
  supplier: Supplier;
  enabled: boolean;
  priority: number;
  is_default: boolean;
};

type UpdatePayload = {
  items: {
    supplier_id: string;
    enabled: boolean;
    priority: number;
    is_default: boolean;
  }[];
};

type Props = {
  dealerId: string;
};

const sortByPriority = (a: DealerSupplierItem, b: DealerSupplierItem) => a.priority - b.priority;

const normalizePriorities = (items: DealerSupplierItem[]): DealerSupplierItem[] =>
  items
    .slice()
    .sort(sortByPriority)
    .map((item, index) => ({ ...item, priority: (index + 1) * 10 }));

const DealerSuppliersPage: React.FC<Props> = ({ dealerId }) => {
  const [items, setItems] = useState<DealerSupplierItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/dealers/${dealerId}/suppliers`);
        if (!res.ok) {
          throw new Error(`Laden fehlgeschlagen (${res.status})`);
        }
        const data: DealerSupplierItem[] = await res.json();
        setItems(normalizePriorities(data ?? []));
      } catch (err) {
        console.error('[DealerSuppliersPage] Fehler beim Laden', err);
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setIsLoading(false);
      }
    };

    if (dealerId) {
      fetchData();
    }
  }, [dealerId]);

  const ensureDefaultExists = (list: DealerSupplierItem[]) => {
    const hasDefault = list.some((item) => item.is_default && item.enabled);
    if (hasDefault) return list;

    const firstEnabledIndex = list.findIndex((item) => item.enabled);
    if (firstEnabledIndex === -1) return list;

    return list.map((item, idx) => ({
      ...item,
      is_default: idx === firstEnabledIndex
    }));
  };

  const toggleEnabled = (supplierId: string) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.supplier.id === supplierId
          ? { ...item, enabled: !item.enabled, is_default: item.is_default && !item.enabled }
          : item
      );
      return ensureDefaultExists(updated);
    });
  };

  const setDefaultSupplier = (supplierId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.supplier.id === supplierId) {
          return { ...item, is_default: true, enabled: true };
        }
        return { ...item, is_default: false };
      })
    );
  };

  const moveUp = (supplierId: string) => {
    setItems((prev) => {
      const sorted = [...prev].sort(sortByPriority);
      const idx = sorted.findIndex((item) => item.supplier.id === supplierId);
      if (idx <= 0) return prev;
      [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
      return normalizePriorities(sorted);
    });
  };

  const moveDown = (supplierId: string) => {
    setItems((prev) => {
      const sorted = [...prev].sort(sortByPriority);
      const idx = sorted.findIndex((item) => item.supplier.id === supplierId);
      if (idx === -1 || idx === sorted.length - 1) return prev;
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
      return normalizePriorities(sorted);
    });
  };

  const sortedItems = useMemo(() => normalizePriorities(items), [items]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: UpdatePayload = {
        items: sortedItems.map((item) => ({
          supplier_id: item.supplier.id,
          enabled: item.enabled,
          priority: item.priority,
          is_default: item.is_default
        }))
      };

      const res = await fetch(`/api/dealers/${dealerId}/suppliers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Speichern fehlgeschlagen (${res.status})`);
      }

      setSuccess('Änderungen gespeichert.');
    } catch (err) {
      console.error('[DealerSuppliersPage] Fehler beim Speichern', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <Card
        title="Lieferanten verwalten"
        subtitle="Supplier-Konfiguration pro Händler. Hinweis: 1 = höchste Priorität."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {isLoading ? <span className="pill">Lädt…</span> : null}
            {isSaving ? <span className="pill">Speichern…</span> : null}
            {!isLoading ? <span className="pill">{sortedItems.length} Lieferanten</span> : null}
          </div>
        }
      >
        {error ? (
          <div className="error-box" role="status" aria-live="polite">
            <strong>Fehler:</strong> {error}
          </div>
        ) : null}

        {success ? <div className="success-box" role="status" aria-live="polite">{success}</div> : null}

        <div style={styles.tableWrapper}>
          <table className="table">
            <thead>
              <tr>
                <th>Aktiv</th>
                <th>Default</th>
                <th>Supplier</th>
                <th>Priorität</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    <div className="skeleton-row">
                      <div className="skeleton-block" />
                      <div className="skeleton-block" />
                      <div className="skeleton-block" />
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    Du hast noch keine Lieferanten hinterlegt.
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                sortedItems.map((item, index) => (
                  <tr key={item.supplier.id} className="table-row">
                    <td>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => toggleEnabled(item.supplier.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="radio"
                        name="defaultSupplier"
                        checked={item.is_default}
                        onChange={() => setDefaultSupplier(item.supplier.id)}
                      />
                    </td>
                    <td>
                      <div style={styles.cellStack}>
                        <div style={styles.supplierName}>{item.supplier.name}</div>
                        {item.supplier.actor_variant ? (
                          <div style={styles.muted}>Variant: {item.supplier.actor_variant}</div>
                        ) : null}
                        <div style={styles.muted}>#{item.supplier.id}</div>
                        <Badge variant="neutral">Land: {item.supplier.country}</Badge>
                      </div>
                    </td>
                    <td>{item.priority}</td>
                    <td style={styles.tdAction}>
                      <div style={styles.actionButtons}>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={index === 0}
                          onClick={() => moveUp(item.supplier.id)}
                        >
                          ↑ Hoch
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={index === sortedItems.length - 1}
                          onClick={() => moveDown(item.supplier.id)}
                        >
                          ↓ Runter
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={styles.footer}>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || isLoading}>
            Speichern
          </Button>
        </div>
      </Card>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: 14
  },
  title: {
    margin: '4px 0 0',
    fontSize: 22,
    color: '#0f172a'
  },
  meta: {
    display: 'flex',
    gap: 8,
    alignItems: 'center'
  },
  pill: {
    padding: '6px 10px',
    background: '#e2e8f0',
    borderRadius: 999,
    fontSize: 12,
    color: '#0f172a'
  },
  tableWrapper: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    background: '#f8fafc',
    padding: '12px 14px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 13,
    color: '#475569',
    fontWeight: 700
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'middle'
  },
  tdAction: {
    padding: '12px 14px',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'right',
    whiteSpace: 'nowrap'
  },
  tr: {
    backgroundColor: '#ffffff'
  },
  cellStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  muted: {
    color: '#94a3b8',
    fontSize: 12
  },
  supplierName: {
    fontWeight: 700,
    color: '#0f172a'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 8,
    background: '#eef2ff',
    color: '#312e81',
    fontSize: 12,
    border: '1px solid #c7d2fe',
    width: 'fit-content'
  },
  actionButtons: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end'
  },
  smallButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: 13
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  saveButton: {
    padding: '12px 18px',
    borderRadius: 10,
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.25)'
  },
  errorBox: {
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecdd3',
    borderRadius: 10,
    padding: '10px 12px'
  },
  successBox: {
    background: '#ecfdf3',
    color: '#166534',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    padding: '10px 12px'
  }
};

export default DealerSuppliersPage;
