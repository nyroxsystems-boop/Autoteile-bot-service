import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';

const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!merchantId) return setError('Bitte gib deine Merchant-ID ein.');
    if (!password) return setError('Bitte gib dein Passwort ein.');
    let ok = false;
    try {
      if (isRegister) ok = await auth.register(merchantId.trim(), password);
      else ok = await auth.login(merchantId.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
      return;
    }
    if (!ok)
      return setError(
        isRegister
          ? 'Registrierung fehlgeschlagen. Existiert der Account bereits?'
          : 'Login fehlgeschlagen. Bitte prüfe deine Eingaben.'
      );
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <Card
          title="Anmelden im PartsBot-Dashboard"
          subtitle="Verwalte deine Anfragen, Bestellungen und Händler an einem Ort."
          className="ui-card-padded"
        >
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="button"
                variant={!isRegister ? 'primary' : 'ghost'}
                fullWidth
                onClick={() => setIsRegister(false)}
              >
                Einloggen
              </Button>
              <Button
                type="button"
                variant={isRegister ? 'primary' : 'ghost'}
                fullWidth
                onClick={() => setIsRegister(true)}
              >
                Account erstellen
              </Button>
            </div>

            <Input
              label="Merchant-ID"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="z.B. demo-haendler"
            />
            <Input
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••"
            />

            {error ? <div className="error-box">{error}</div> : null}

            <Button type="submit" variant="primary" fullWidth>
              {isRegister ? 'Account erstellen' : 'Einloggen'}
            </Button>

            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {isRegister ? 'Schon einen Account?' : 'Noch keinen Account?'}{' '}
              <button
                type="button"
                onClick={() => setIsRegister((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isRegister ? 'Zum Login' : 'Jetzt registrieren'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
