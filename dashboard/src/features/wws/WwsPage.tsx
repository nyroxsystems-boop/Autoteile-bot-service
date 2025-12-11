import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Badge from '../../ui/Badge';
import {
  type CreateWwsConnectionInput,
  type TestConnectionResponse,
  type WwsConnection,
  fetchConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  testInventory
} from './api';

const defaultForm: CreateWwsConnectionInput = {
  name: '',
  type: 'demo_wws',
  baseUrl: '',
  isActive: true,
  authConfig: {},
  config: {}
};

const typeLabels: Record<string, string> = {
  demo_wws: 'Demo-WWS',
  http_api: 'HTTP-API',
  scraper: 'Scraper'
};

const typeHints: Record<string, string> = {
  demo_wws: 'Nutze die Base-URL deines Demo-WWS, z.B. http://localhost:4000.',
  http_api:
    'Beispiel AuthConfig: {"authType":"api_key_header","headerName":"X-API-KEY","apiKey":"..."}\nBeispiel Config: {"oemEndpoint":"/inventory/by-oem/:oem","responseMapping":{"priceField":"price","quantityField":"stock"}}',
  scraper:
    'Scraper ist ein Stub. Du kannst Login-URL & Notizen in config/authConfig hinterlegen; echte Automatisierung folgt serverseitig.'
};

const WwsPage: React.FC = () => {
  const [connections, setConnections] = useState<WwsConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<WwsConnection | null>(null);
  const [form, setForm] = useState<CreateWwsConnectionInput>(defaultForm);
  const [authConfigJson, setAuthConfigJson] = useState('{}');
  const [configJson, setConfigJson] = useState('{}');

  const [testTarget, setTestTarget] = useState<WwsConnection | null>(null);
  const [testOem, setTestOem] = useState('11428507683');
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  const [inventoryOem, setInventoryOem] = useState('11428507683');
  const [inventoryResult, setInventoryResult] = useState<any | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const sortedConnections = useMemo(
    () => [...connections].sort((a, b) => a.name.localeCompare(b.name)),
    [connections]
  );

  async function loadConnections() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnections();
      setConnections(data);
    } catch (e: any) {
      setError(e?.message || 'Fehler beim Laden der Verbindungen');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditing(null);
    setForm(defaultForm);
    setAuthConfigJson('{}');
    setConfigJson('{}');
  }

  function handleEdit(conn: WwsConnection) {
    setEditing(conn);
    setForm({
      name: conn.name,
      type: conn.type,
      baseUrl: conn.baseUrl,
      isActive: conn.isActive,
      authConfig: conn.authConfig ?? {},
      config: conn.config ?? {}
    });
    setAuthConfigJson(JSON.stringify(conn.authConfig ?? {}, null, 2));
    setConfigJson(JSON.stringify(conn.config ?? {}, null, 2));
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Verbindung wirklich löschen?')) return;
    try {
      await deleteConnection(id);
      await loadConnections();
      if (editing?.id === id) resetForm();
    } catch (e: any) {
      setError(e?.message || 'Löschen fehlgeschlagen');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let parsedAuth = {};
    let parsedConfig = {};
    try {
      parsedAuth = authConfigJson ? JSON.parse(authConfigJson) : {};
    } catch (err: any) {
      setError('AuthConfig ist kein gültiges JSON');
      return;
    }
    try {
      parsedConfig = configJson ? JSON.parse(configJson) : {};
    } catch (err: any) {
      setError('Config ist kein gültiges JSON');
      return;
    }

    const payload = { ...form, authConfig: parsedAuth, config: parsedConfig };

    try {
      if (editing) {
        await updateConnection(editing.id, payload);
      } else {
        await createConnection(payload);
      }
      await loadConnections();
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Speichern fehlgeschlagen');
    }
  }

  async function handleTest(connection: WwsConnection) {
    setTestTarget(connection);
    setTestResult(null);
    try {
      const result = await testConnection(connection.id, testOem || '11428507683');
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message || 'Test fehlgeschlagen' });
    }
  }

  async function handleInventoryTest() {
    if (!inventoryOem) return;
    setInventoryLoading(true);
    setInventoryResult(null);
    try {
      const res = await testInventory(inventoryOem);
      setInventoryResult(res);
    } catch (e: any) {
      setInventoryResult({ error: e?.message || 'Fehler bei Inventar-Test' });
    } finally {
      setInventoryLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card
          title="Verbundene Warenwirtschaftssysteme"
          subtitle="Verwalte angebundene ERP/WWS-Systeme. Diese Endpoints sollten nur im Dashboard verfügbar sein."
        >
          {loading ? <div className="skeleton-block" style={{ height: 12, width: '40%' }} /> : null}
          {error ? (
            <div className="error-box">
              <strong>Fehler:</strong> {error}
            </div>
          ) : null}
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Typ</th>
                  <th>Base-URL</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sortedConnections.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      <Badge variant="secondary">{typeLabels[c.type] || c.type}</Badge>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{c.baseUrl}</td>
                    <td>
                      <Badge variant={c.isActive ? 'success' : 'secondary'}>
                        {c.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}>
                        Bearbeiten
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                        Löschen
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => handleTest(c)}>
                        Testen
                      </Button>
                    </td>
                  </tr>
                ))}
                {!sortedConnections.length && !loading ? (
                  <tr>
                    <td colSpan={5}>Keine Verbindungen vorhanden.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={testOem}
                onChange={(e) => setTestOem(e.target.value)}
                placeholder="Test-OEM"
                className="ui-input"
                style={{ maxWidth: 220 }}
              />
              <span className="ui-input-helper">Wird für „Verbindung testen“ genutzt.</span>
            </div>
            {testTarget ? (
              <div style={{ marginTop: 8, fontSize: 14 }}>
                Zuletzt getestet: <strong>{testTarget.name}</strong>
                {testResult ? (
                  testResult.ok ? (
                    <span style={{ color: 'var(--success)' }}>
                      {' '}
                      ✓ Erfolg ({testResult.sampleResultsCount ?? 0} Ergebnisse)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--danger)' }}>
                      {' '}
                      ✕ Fehler: {testResult.error}
                    </span>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card
          title="Orchestrator-Test"
          subtitle="Ruft /api/bot/inventory/by-oem auf und zeigt das zusammengeführte Ergebnis."
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Input
              label="OEM"
              value={inventoryOem}
              onChange={(e) => setInventoryOem(e.target.value)}
              placeholder="11428507683"
              style={{ maxWidth: 240 }}
            />
            <Button onClick={handleInventoryTest} disabled={inventoryLoading}>
              {inventoryLoading ? 'Lade...' : 'Gesamtes Inventar testen'}
            </Button>
          </div>
          {inventoryResult ? (
            <div style={{ marginTop: 12 }}>
              {inventoryResult.error ? (
                <div className="error-box">{inventoryResult.error}</div>
              ) : (
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>System</th>
                        <th>Typ</th>
                        <th>Titel</th>
                        <th>Preis</th>
                        <th>Menge</th>
                        <th>Lieferzeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventoryResult.results ?? []).map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td>{r.systemName}</td>
                          <td>{typeLabels[r.providerType] || r.providerType}</td>
                          <td>{r.title || '–'}</td>
                          <td>
                            {r.price ?? '–'} {r.currency || ''}
                          </td>
                          <td>{r.availableQuantity ?? '–'}</td>
                          <td>{r.deliveryTime || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>

      <Card
        title={editing ? 'Verbindung bearbeiten' : 'Neue Verbindung'}
        subtitle="Fülle die Basis-Infos aus. Auth- und Mapping-Daten kannst du als JSON angeben."
      >
        <form onSubmit={handleSubmit} className="form-grid">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="ui-input-group">
            <label className="ui-input-label">Typ</label>
            <select
              className="ui-input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CreateWwsConnectionInput['type'] })}
            >
              <option value="demo_wws">Demo-WWS</option>
              <option value="http_api">HTTP-API</option>
              <option value="scraper">Scraper</option>
            </select>
          </div>
          <Input
            label="Base-URL"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="http://localhost:4000"
            required
          />
          <div className="ui-input-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <label htmlFor="isActive" className="ui-input-label" style={{ margin: 0 }}>
              Aktiv
            </label>
          </div>

          <div className="ui-input-group">
            <label className="ui-input-label">AuthConfig (JSON)</label>
            <textarea
              className="ui-textarea"
              value={authConfigJson}
              onChange={(e) => setAuthConfigJson(e.target.value)}
              rows={6}
            />
          </div>

          <div className="ui-input-group">
            <label className="ui-input-label">Config / Mapping (JSON)</label>
            <textarea
              className="ui-textarea"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={6}
            />
          </div>

          <div className="hint-box">{typeHints[form.type]}</div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit">{editing ? 'Aktualisieren' : 'Anlegen'}</Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Abbrechen
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default WwsPage;
