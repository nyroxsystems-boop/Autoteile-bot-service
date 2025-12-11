import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOrders } from '../api/orders';
import type { Order } from '../api/types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';

const statusLabelMap: Record<string, string> = {
  collect_vehicle: 'Fahrzeugdaten sammeln',
  collect_part: 'Teiledaten sammeln',
  oem_lookup: 'OEM-Ermittlung',
  show_offers: 'Angebote anzeigen',
  done: 'Abgeschlossen',
  choose_language: 'Sprache wählen'
};

const OrdersListPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done' | 'failed'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listOrders();
        setOrders(data);
      } catch (err) {
        console.error('[OrdersListPage] Fehler beim Laden der Bestellungen', err);
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (statusFilter === 'done') return String(o.status).includes('done');
        if (statusFilter === 'failed') return String(o.status).includes('fail') || String(o.status).includes('error');
        if (statusFilter === 'open')
          return ['collect_vehicle', 'collect_part', 'oem_lookup', 'choose_language'].includes(String(o.status));
        return true;
      })
      .filter((o) => {
        if (!term) return true;
        const customer = `${o.customerId ?? ''} ${o.customerPhone ?? ''}`.toLowerCase();
        const id = String(o.id ?? '').toLowerCase();
        const part = String((o as any)?.part?.partText ?? '').toLowerCase();
        return customer.includes(term) || id.includes(term) || part.includes(term);
      });
  }, [orders, search, statusFilter]);

  const renderDate = (date?: string) => {
    if (!date) return '–';
    return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const statusVariant = (status: string): 'success' | 'danger' | 'neutral' => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('completed') || s.includes('show_offers')) return 'success';
    if (s.includes('fail') || s.includes('error') || s.includes('aborted')) return 'danger';
    return 'neutral';
  };

  const renderStatus = (status: string) => statusLabelMap[status] ?? status ?? '–';

  const renderVehicle = (order: Order) => {
    const vehicle = order.vehicle ?? null;
    if (!vehicle) return '–';
    const ident = vehicle.vin || [vehicle.hsn, vehicle.tsn].filter(Boolean).join('/') || '–';
    return (
      <div style={styles.cellStack}>
        <div>
          {vehicle.make ?? '-'} {vehicle.model ?? ''}
        </div>
        <div style={styles.muted}>
          Bj. {vehicle.year ?? '-'} · Identifikation: {ident}
        </div>
      </div>
    );
  };

  const renderPart = (order: Order) => {
    const part = order.part ?? null;
    if (!part) return '–';
    return (
      <div style={styles.cellStack}>
        <div>{part.partCategory ?? '-'}</div>
        <div style={styles.muted}>{part.partText ?? '-'}</div>
      </div>
    );
  };

  const renderSelectedBadge = (order: Order) => {
    const selectedId =
      (order as any)?.order_data?.selectedOfferId ??
      (order as any)?.orderData?.selectedOfferId ??
      null;
    if (!selectedId) return null;
    return <span style={styles.selectedBadge}>Produkt gewählt</span>;
  };

  const renderPrice = (order: Order) => {
    const value = order.totalPrice ?? order.total_price ?? null;
    if (value === null || value === undefined) return '–';
    return `€ ${value.toFixed(2)}`;
  };

  const renderCustomer = (order: Order) => {
    return (
      <div style={styles.cellStack}>
        <div>Kunden-ID: {order.customerId ?? '-'}</div>
        <div style={styles.muted}>Telefon: {order.customerPhone ?? '-'}</div>
      </div>
    );
  };

  const handleRowNavigate = (orderId: string) => navigate(`/orders/${orderId}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        title="Bestellungen"
        subtitle="Alle Bestellungen aus dem WhatsApp-Bot"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button size="sm" variant={statusFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('all')}>
              Alle
            </Button>
            <Button size="sm" variant={statusFilter === 'open' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('open')}>
              Offen
            </Button>
            <Button size="sm" variant={statusFilter === 'done' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('done')}>
              Abgeschlossen
            </Button>
            <Button size="sm" variant={statusFilter === 'failed' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('failed')}>
              Fehlgeschlagen
            </Button>
            {isLoading ? <span className="pill">Lädt…</span> : <span className="pill">{rows.length} sichtbar</span>}
          </div>
        }
      >
        {error ? (
          <div className="error-box" role="status" aria-live="polite">
            <strong>Fehler:</strong> {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          <Input
            label="Suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID oder Kundenname"
            helperText="Filtert nach ID oder Kundenname."
            style={{ maxWidth: 320 }}
          />
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Bestellung</th>
                <th>Kunde</th>
                <th>Fahrzeug</th>
                <th>Teil</th>
                <th>Preis</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={8}>
                        <div className="skeleton-row">
                          <div className="skeleton-block" />
                          <div className="skeleton-block" />
                          <div className="skeleton-block" />
                        </div>
                      </td>
                    </tr>
                  ))
                : null}

              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 14 }}>Es liegen noch keine Bestellungen vor.</td>
                </tr>
              ) : null}

              {!isLoading &&
                rows.map((order) => (
                  <tr
                    key={order.id}
                    className="table-row table-row-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowNavigate(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowNavigate(order.id);
                      }
                    }}
                  >
                    <td>{order.id}</td>
                    <td>{renderCustomer(order)}</td>
                    <td>{renderVehicle(order)}</td>
                    <td>
                      {renderPart(order)}
                      {renderSelectedBadge(order)}
                    </td>
                    <td>{renderPrice(order)}</td>
                    <td>
                      <Badge variant={statusVariant(String(order.status)) as any}>{renderStatus(String(order.status))}</Badge>
                    </td>
                    <td>{renderDate(order.created_at ?? order.createdAt ?? undefined)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowNavigate(order.id);
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default OrdersListPage;

const styles = {
  muted: { color: 'var(--muted)', fontSize: 13 },
  cellStack: { display: 'flex', flexDirection: 'column', gap: 4 },
  selectedBadge: {
    marginTop: 6,
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 9999,
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,0.4)',
    fontSize: 12,
    fontWeight: 700
  }
} as const;
