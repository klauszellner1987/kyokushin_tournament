import { useState } from 'react';
import { Ticket, Check, Zap } from 'lucide-react';
import { useTokens } from '../../hooks/useTokens';
import { useAuth } from '../../contexts/AuthContext';



interface Plan {
  id: string;
  name: string;
  price: string;
  priceId: string;
  features: string[];
  popular?: boolean;
  tokens: number;
  paymentLink: string;
}

const PLANS: Plan[] = [
  {
    id: 'single',
    name: '1 Turnier',
    price: '24,00 €',
    priceId: 'price_1TYkh5J1YHEKjVEshf965p3t',
    tokens: 1,
    paymentLink: 'https://buy.stripe.com/test_8x26oI3jigsL8Xq5FJcfK00',
    features: [
      '1 Turnier-Freischaltung',
      'Unbegrenzte Teilnehmer',
      'Live-Ansicht für Beamer',
      'Kein Zeitlimit',
    ],
  },
  {
    id: 'annual',
    name: 'Jahreslizenz',
    price: '99,00 €',
    priceId: 'price_1TYkhtJ1YHEKjVEs8Q6T2gJW',
    tokens: 999, // Unbegrenzt symbolisch
    popular: true,
    paymentLink: 'https://buy.stripe.com/test_aFacN68DCgsL6Pi5FJcfK01',
    features: [
      'Unbegrenzte Turniere',
      'Alle Funktionen inklusive',
      'Premium-Support',
      'Einmal jährlich kündbar',
    ],
  },
];

export default function PricingCard({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { unusedTokenCount, freeTrialsUsed, freeTrialLimit, addToken } = useTokens();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const isStripeConfigured = PLANS.every(p => p.paymentLink && !p.paymentLink.includes('placeholder'));

  const handlePurchase = async (plan: Plan) => {
    if (!isStripeConfigured) {
      // Demo mode: add tokens directly
      setPurchasing(plan.id);
      const now = new Date().getTime();
      for (let i = 0; i < plan.tokens; i++) {
        addToken(`demo_${now}_${i}`);
      }
      setTimeout(() => {
        setPurchasing(null);
        onClose();
      }, 500);
      return;
    }

    setPurchasing(plan.id);
    try {
      const uid = user ? ('uid' in user ? user.uid : '') : '';
      // We pass the firebase user ID as a query parameter so Stripe associates it with the purchase
      const checkoutUrl = `${plan.paymentLink}?client_reference_id=${encodeURIComponent(uid)}`;
      window.location.assign(checkoutUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Fehler beim Starten des Bezahlvorgangs. Bitte versuche es erneut.');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-kyokushin-card border border-kyokushin-border rounded-2xl max-w-3xl w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-kyokushin-text-muted hover:text-white text-2xl leading-none"
        >
          &times;
        </button>

        <div className="text-center mb-8">
          <Ticket size={32} className="mx-auto text-kyokushin-gold mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2">Turnier-Tokens kaufen</h2>
          <p className="text-kyokushin-text-muted">
            Jeder Token schaltet ein Turnier frei. Daten bleiben lokal auf deinem Gerät.
          </p>
          <div className="flex items-center justify-center gap-4 mt-3 text-sm">
            <span className="text-kyokushin-text-muted">
              Gratis-Test: {freeTrialsUsed}/{freeTrialLimit} genutzt
            </span>
            {unusedTokenCount > 0 && (
              <span className="text-kyokushin-gold">
                {unusedTokenCount} Token{unusedTokenCount !== 1 ? 's' : ''} verfügbar
              </span>
            )}
          </div>
          {!isStripeConfigured && (
            <p className="text-xs text-kyokushin-gold mt-3 bg-kyokushin-gold/10 border border-kyokushin-gold/20 rounded-lg px-3 py-1.5 inline-block">
              Demo-Modus -- Tokens werden direkt hinzugefügt
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl p-5 border transition-all ${
                plan.popular
                  ? 'border-kyokushin-red bg-kyokushin-red/5 ring-1 ring-kyokushin-red/20'
                  : 'border-kyokushin-border bg-kyokushin-bg hover:border-kyokushin-red/50'
              }`}
            >
              {plan.popular && (
                <div className="flex items-center gap-1 text-xs text-kyokushin-red font-medium mb-3">
                  <Zap size={12} />
                  Beliebteste Wahl
                </div>
              )}
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <div className="text-2xl font-bold text-white mt-1 mb-4">{plan.price}</div>
              <ul className="space-y-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-kyokushin-text-muted">
                    <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handlePurchase(plan)}
                disabled={purchasing !== null}
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  plan.popular
                    ? 'bg-kyokushin-red hover:bg-kyokushin-red-dark text-white'
                    : 'bg-kyokushin-border hover:bg-kyokushin-card-hover text-white'
                }`}
              >
                {purchasing === plan.id ? 'Laden...' : 'Kaufen'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
