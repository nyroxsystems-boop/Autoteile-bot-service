import { useEffect, useMemo, useState } from 'react';
import { listOrders } from '../api/orders';
import { fetchOverviewStats, type OverviewStats } from '../api/stats';
import type { Order } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { fetchMerchantSettings, saveMerchantSettings, type MerchantSettings } from '../api/merchant';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';

const OverviewPage = () => {
  const [timeRange, setTimeRange] = useState<'Heute' | 'Diese Woche' | 'Dieser Monat'>('Heute');
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [defaultMargin, setDefaultMargin] = useState<number | null>(null);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [step, setStep] = useState<number>(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const auth = useAuth();

  // a small default list of known shops (can be replaced by a real backend list later)
  const KNOWN_SHOPS = ['Autodoc', 'Stahlgruber', 'Mister Auto'];
  const [error, setError] = useState<string | null>(null);

  const isStatsLoading = !stats && !error;

  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await fetchOverviewStats(timeRange);
        setStats(result);
      } catch (err) {
        console.error('[OverviewPage] Fehler beim Laden der Statistiken', err);
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    loadStats();
  }, [timeRange]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await listOrders();
        setOrders(data);
      } catch (err) {
        console.error('[OverviewPage] Fehler beim Laden der Bestellungen', err);
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    loadOrders();
  }, []);

  // load merchant settings when session is available
  useEffect(() => {
    const loadSettings = async () => {
      if (!auth?.session?.merchantId) return;
      try {
        const s = await fetchMerchantSettings(auth.session.merchantId);
        if (s) {
          setSelectedShops(s.selectedShops ?? []);
          setDefaultMargin(s.marginPercent ?? null);
          setShowSettings(false);
        }
      } catch (err) {
        console.error('[OverviewPage] Fehler beim Laden der Merchant-Settings', err);
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, [auth?.session?.merchantId]);

  const oemIssuesCount = useMemo(
    () =>
      orders.filter(
        (o) => o?.part?.oemStatus === 'not_found' || o?.part?.oemStatus === 'multiple_matches'
      ).length,
    [orders]
  );

  const handleRangeChange = (value: 'Heute' | 'Diese Woche' | 'Dieser Monat') => {
    console.log('[OverviewPage] Zeitraum geändert:', value);
    setTimeRange(value);
  };

  const handleMarginChange = (value: string) => {
    const parsed = value === '' ? null : Number(value);
    console.log('[OverviewPage] Standard-Marge geändert:', parsed);
    setDefaultMargin(Number.isNaN(parsed) ? null : parsed);
  };

  const handleMarginSave = () => {
    // legacy single-field save (keeps behavior but delegates to stepper save below)
    console.log('[OverviewPage] Standard-Marge speichern angeklickt', defaultMargin);
    handleSaveSettings();
  };

  const handleToggleShop = (shop: string) => {
    setSelectedShops((prev) => (prev.includes(shop) ? prev.filter((s) => s !== shop) : [...prev, shop]));
  };

  const handleSaveSettings = async () => {
    if (!auth?.session?.merchantId) {
      setError('Bitte zuerst anmelden, um Einstellungen zu speichern.');
      return;
    }
    setIsSavingSettings(true);
    setError(null);
    try {
      await saveMerchantSettings(auth.session.merchantId, {
        selectedShops,
        marginPercent: defaultMargin ?? 0
      });
      setError(null);
      setStep(0);
      setShowSettings(false);
      console.log('[OverviewPage] Merchant settings saved');
    } catch (err) {
      console.error('[OverviewPage] Fehler beim Speichern der Merchant-Settings', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        title="Übersicht"
        subtitle="Schnellüberblick über Anfragen, Bestellungen und Marge."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={timeRange === 'Heute' ? 'primary' : 'secondary'}
              onClick={() => handleRangeChange('Heute')}
              size="sm"
            >
              Heute
            </Button>
            <Button
              variant={timeRange === 'Diese Woche' ? 'primary' : 'secondary'}
              onClick={() => handleRangeChange('Diese Woche')}
              size="sm"
            >
              Diese Woche
            </Button>
            <Button
              variant={timeRange === 'Dieser Monat' ? 'primary' : 'secondary'}
              onClick={() => handleRangeChange('Dieser Monat')}
              size="sm"
            >
              Dieser Monat
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="error-box">
            <strong>Fehler:</strong> {error}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12
          }}
        >
          {isStatsLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx}>
                  <div className="skeleton-row" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="skeleton-block" style={{ height: 14 }} />
                    <div className="skeleton-block" style={{ height: 20, width: '60%' }} />
                    <div className="skeleton-block" style={{ height: 12, width: '80%' }} />
                  </div>
                </Card>
              ))
            : (
              <>
                <KpiCard
                  title="Bestellungen im Zeitraum"
                  value={stats?.ordersInPeriod ?? '–'}
                  description="Alle neu gestarteten Bestellungen im gewählten Zeitraum."
                />
                <KpiCard
                  title="Offene Bestellungen (OEM)"
                  value={oemIssuesCount}
                  description="Bestellungen mit offener oder problematischer OEM-Ermittlung."
                />
                <KpiCard
                  title="Empfangene Nachrichten"
                  value={stats?.incomingMessages ?? '–'}
                  description="Eingehende WhatsApp-Nachrichten im Zeitraum."
                />
                <KpiCard
                  title="Abgebrochene Bestellungen"
                  value={stats?.abortedOrders ?? '–'}
                  description="Begonnene, aber nicht abgeschlossene Vorgänge."
                />
                <KpiCard
                  title="Konversionsrate"
                  value={`${stats?.conversionRate ?? '–'}%`}
                  description="Abschlussrate gegenüber gestarteten Anfragen."
                />
                <KpiCard
                  title="Ø Marge"
                  value={`${stats?.averageMargin ?? '–'}%`}
                  description="Mittelwert der angewendeten Marge pro Bestellung."
                />
                <KpiCard
                  title="Ø Warenkorb"
                  value={stats?.averageBasket ? `€ ${stats.averageBasket}` : '–'}
                  description="Durchschnittlicher Endpreis pro Bestellung."
                />
              </>
            )}
        </div>
      </Card>

      <Card
        title="Onboarding & Grundeinstellungen"
        subtitle="Shops auswählen und Standard-Marge festlegen."
      >
        {!showSettings && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: 'var(--muted)' }}>
              Einstellungen hinterlegt. Shops: {selectedShops.join(', ') || '–'} · Standard-Marge: {defaultMargin ?? '–'}%
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowSettings(true)}>
              Einstellungen bearbeiten
            </Button>
          </div>
        )}
        {showSettings && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Badge variant={step === 0 ? 'success' : 'neutral'}>Schritt 1</Badge>
              <Badge variant={step === 1 ? 'success' : 'neutral'}>Schritt 2</Badge>
            </div>
            {step === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ color: 'var(--muted)' }}>Wähle die Shops aus, die bei der Angebotssuche berücksichtigt werden sollen.</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {KNOWN_SHOPS.map((s) => (
                    <label key={s} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={selectedShops.includes(s)} onChange={() => handleToggleShop(s)} />
                      <div style={{ fontWeight: 700 }}>{s}</div>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={() => setStep(1)} disabled={selectedShops.length === 0}>
                    Weiter
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedShops([])}>
                    Zurücksetzen
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ color: 'var(--muted)' }}>Diese Marge wird prozentual auf den Teilepreis aufgeschlagen.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 200px)', gap: 12 }}>
                  <Input
                    label="Standard-Marge (%)"
                    type="number"
                    value={defaultMargin ?? ''}
                    placeholder="z.B. 20"
                    onChange={(e) => handleMarginChange(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={handleSaveSettings} disabled={isSavingSettings}>
                    {isSavingSettings ? 'Speichert…' : 'Speichern & Abschließen'}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Zurück
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Hinweise & Status">
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Empfangene Nachrichten heute: {stats?.incomingMessages ?? '–'}</li>
          <li>Abgebrochene Bestellungen heute: {stats?.abortedOrders ?? '–'}</li>
          <li>Bestellungen, die auf OEM-Klärung warten: {oemIssuesCount}</li>
        </ul>
      </Card>
    </div>
  );
};

type KpiCardProps = {
  title: string;
  value: string | number;
  description: string;
};

const KpiCard = ({ title, value, description }: KpiCardProps) => {
  return (
    <Card>
      <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{description}</div>
    </Card>
  );
};
export default OverviewPage;
