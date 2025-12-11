import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, getOrderOffers } from '../api/orders';
import type { Order, OrderData, SelectedOfferSummary, ShopOffer } from '../api/types';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type OfferRow = ShopOffer & { priceValue: number; currencyValue: string };

const OrderDetailPage = () => {
  const { id: orderId } = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);

  const [orderError, setOrderError] = useState<string | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);

  const [isOrderLoading, setIsOrderLoading] = useState<boolean>(false);
  const [isOffersLoading, setIsOffersLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!orderId) return;
    const fetchOrderData = async () => {
      setIsOrderLoading(true);
      setOrderError(null);
      try {
        const data = await getOrder(orderId);
        setOrder(data);
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsOrderLoading(false);
      }
    };

    const fetchOffersData = async () => {
      setIsOffersLoading(true);
      setOffersError(null);
      try {
        const data = await getOrderOffers(orderId);
        setOffers(
          (data ?? []).map((offer) => ({
            ...offer,
            priceValue: offer.basePrice ?? offer.finalPrice ?? 0,
            currencyValue: offer.currency ?? 'EUR'
          }))
        );
      } catch (error) {
        setOffersError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsOffersLoading(false);
      }
    };

    fetchOrderData();
    fetchOffersData();
  }, [orderId]);

  const orderData: OrderData =
    (order as any)?.order_data ||
    (order as any)?.orderData || {
      conversationStatus: null,
      vehicleDescription: null,
      partDescription: null
    };

  const selectedOfferId = orderData?.selectedOfferId ?? null;
  const selectedOfferSummary: SelectedOfferSummary | null = orderData?.selectedOfferSummary ?? null;

  const selectedOffer = useMemo(
    () => (selectedOfferId ? offers.find((o) => o.id === selectedOfferId) ?? null : null),
    [offers, selectedOfferId]
  );

  const selectedCardOffer: any = selectedOffer ?? (selectedOfferSummary
    ? {
        shopName: selectedOfferSummary.shopName ?? '—',
        brand: selectedOfferSummary.brand ?? '—',
        priceValue: selectedOfferSummary.price ?? NaN,
        currencyValue: selectedOfferSummary.currency ?? 'EUR',
        deliveryTimeDays: selectedOfferSummary.deliveryTimeDays ?? null,
        productUrl: (selectedOfferSummary as any)?.productUrl ?? null,
        id: selectedOfferId ?? undefined
      }
    : null);

  if (!orderId) {
    return <div style={styles.wrapper}>Keine Bestell-ID übergeben.</div>;
  }

  const statusVariant = (status?: string | null): 'success' | 'danger' | 'neutral' => {
    const s = (status ?? '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('show_offers')) return 'success';
    if (s.includes('fail') || s.includes('error') || s.includes('abort')) return 'danger';
    return 'neutral';
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.breadcrumbs}>
        <Link to="/orders">← Zurück zur Bestellübersicht</Link>
        <span style={styles.routeInfo}>/orders/{orderId}</span>
      </div>

      {orderError ? (
        <div className="error-box">
          <strong>Fehler beim Laden der Bestellung:</strong> {orderError}
        </div>
      ) : null}

      <Card
        title={`Bestellung #${orderId}`}
        subtitle="Status und Metadaten"
        actions={<Badge variant="neutral">{order?.language ?? 'n/a'}</Badge>}
      >
        <div style={styles.rowGrid}>
          <div>
            <div style={styles.label}>Erstellt am</div>
            <div style={styles.value}>
              {order?.created_at
                ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </div>
          </div>
          <div>
            <div style={styles.label}>Aktualisiert am</div>
            <div style={styles.value}>
              {order?.updated_at
                ? new Date(order.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </div>
          </div>
          <div>
            <div style={styles.label}>Status</div>
            <Badge variant={statusVariant(order?.status) as any}>{order?.status ?? '—'}</Badge>
          </div>
          <div>
            <div style={styles.label}>Dialog-Status</div>
            <div style={styles.value}>{orderData?.conversationStatus ?? '—'}</div>
          </div>
        </div>
      </Card>

      <Card title="Bestellübersicht">
        <div style={styles.rowGrid}>
          <div>
            <div style={styles.label}>Kunde</div>
            <div style={styles.value}>{(order as any)?.customerName ?? '—'}</div>
          </div>
          <div>
            <div style={styles.label}>Kontakt</div>
            <div style={styles.value}>{(order as any)?.customerPhone ?? (order as any)?.customerContact ?? '—'}</div>
          </div>
          <div>
            <div style={styles.label}>Angefragtes Teil</div>
            <div style={styles.value}>{(order as any)?.requestedPartName ?? orderData?.partDescription ?? '—'}</div>
          </div>
          <div>
            <div style={styles.label}>Sprache</div>
            <div style={styles.value}>{order?.language ?? '—'}</div>
          </div>
        </div>
        <div style={styles.detailBox}>
          <div style={styles.label}>Fahrzeug (Beschreibung)</div>
          <div style={styles.value}>{orderData?.vehicleDescription ?? '—'}</div>
        </div>
      </Card>

      <Card
        title="Gewähltes Produkt"
        actions={selectedOfferId ? <Badge variant="success">Ausgewählt</Badge> : null}
      >
        {selectedCardOffer ? (
          <div style={styles.selectedGrid}>
            <div>
              <div style={styles.label}>Marke</div>
              <div style={styles.value}>{(selectedCardOffer as any).brand ?? '—'}</div>
            </div>
            <div>
              <div style={styles.label}>Shop</div>
              <div style={styles.value}>{(selectedCardOffer as any).shopName ?? '—'}</div>
            </div>
            <div>
              <div style={styles.label}>Preis</div>
              <div style={styles.value}>
                {Number.isFinite((selectedCardOffer as any).priceValue)
                  ? `${(selectedCardOffer as any).priceValue.toFixed(2)} ${(selectedCardOffer as any).currencyValue ?? 'EUR'}`
                  : '—'}
              </div>
            </div>
            <div>
              <div style={styles.label}>Lieferzeit</div>
              <div style={styles.value}>
                {(selectedCardOffer as any).deliveryTimeDays ?? 'k.A.'}
              </div>
            </div>
            <div>
              <div style={styles.label}>Rating</div>
              <div style={styles.value}>
                {(selectedCardOffer as any).rating
                  ? `${(selectedCardOffer as any).rating}/5`
                  : 'k.A.'}
              </div>
            </div>
            {(selectedCardOffer as any).productUrl ? (
              <div style={styles.linkRow}>
                <a
                  href={(selectedCardOffer as any).productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-btn ui-btn-primary ui-btn-sm"
                >
                  Zum Produkt
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">
            Der Kunde hat noch kein Angebot ausgewählt.
          </div>
        )}
      </Card>

      <Card title="Alle Angebote zu dieser Bestellung">
        {offersError ? (
          <div className="error-box">
            <strong>Fehler beim Laden der Angebote:</strong> {offersError}
          </div>
        ) : null}

        {isOffersLoading ? (
          <div style={styles.tableWrapper}>
            <table className="table">
              <tbody>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={7}>
                      <div className="skeleton-row">
                        <div className="skeleton-block" />
                        <div className="skeleton-block" />
                        <div className="skeleton-block" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : offers.length === 0 ? (
          <div className="empty-state">
            {order?.language === 'en'
              ? 'No offers have been found for this order yet.'
              : 'Es wurden noch keine Angebote zu dieser Bestellung gefunden.'}
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table className="table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Brand</th>
                  <th>Preis</th>
                  <th>Verfügbarkeit</th>
                  <th>Lieferzeit</th>
                  <th>Rating</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const isSelected = selectedOfferId && offer.id === selectedOfferId;
                  const priceLabel = `${(offer.priceValue ?? offer.basePrice ?? 0).toFixed(2)} ${
                    offer.currencyValue ?? 'EUR'
                  }`;
                  return (
                    <tr
                      key={offer.id}
                      className="table-row"
                      style={isSelected ? { background: 'rgba(37,99,235,0.08)' } : undefined}
                    >
                      <td>
                        <div style={styles.cellStack}>
                          <div style={styles.value}>{offer.shopName ?? '—'}</div>
                          {isSelected ? <Badge variant="success">{order?.language === 'en' ? 'Selected' : 'Ausgewählt'}</Badge> : null}
                        </div>
                      </td>
                      <td>{offer.brand ?? '—'}</td>
                      <td>{priceLabel}</td>
                      <td>{offer.availability ?? '—'}</td>
                      <td>
                        {offer.deliveryTimeDays !== null && offer.deliveryTimeDays !== undefined
                          ? `${offer.deliveryTimeDays} Tage`
                          : '—'}
                      </td>
                      <td>{offer.rating !== null && offer.rating !== undefined ? `${offer.rating}/5` : '—'}</td>
                      <td>
                        {offer.productUrl ? (
                          <a href={offer.productUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                            {order?.language === 'en' ? 'Open product' : 'Zum Produkt'}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#475569'
  },
  routeInfo: {
    fontSize: 12,
    color: '#94a3b8'
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecdd3'
  },
  emptyBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0'
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: 14
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: '#0f172a'
  },
  badge: {
    padding: '6px 10px',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    fontWeight: 700
  },
  selectedBadge: {
    padding: '6px 10px',
    backgroundColor: '#ecfdf3',
    color: '#166534',
    borderRadius: 8,
    border: '1px solid #bbf7d0',
    fontWeight: 700
  },
  selectedBadgeSmall: {
    display: 'inline-block',
    marginTop: 4,
    padding: '4px 8px',
    backgroundColor: '#ecfdf3',
    color: '#166534',
    borderRadius: 9999,
    border: '1px solid #bbf7d0',
    fontSize: 12,
    fontWeight: 700
  },
  selectedRow: {
    backgroundColor: '#f8fafc'
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12
  },
  label: {
    color: '#475569',
    fontSize: 13
  },
  value: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 600
  },
  detailBox: {
    marginTop: 8
  },
  selectedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 10,
    border: '1px solid #e2e8f0'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#475569'
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 14,
    verticalAlign: 'middle'
  },
  tr: {
    backgroundColor: '#ffffff'
  },
  loading: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    color: '#075985',
    fontWeight: 600
  },
  link: {
    color: '#1d4ed8',
    fontWeight: 700
  },
  linkButton: {
    display: 'inline-block',
    padding: '10px 12px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 700
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  }
};

export default OrderDetailPage;
