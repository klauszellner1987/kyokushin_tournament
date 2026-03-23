import { useState } from 'react';
import { Ticket, Check, Zap } from 'lucide-react';
import { useTokens } from '../../hooks/useTokens';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface Plan {
  id: string;
  name: string;
  price: string;
  priceId: string;
  features: string[];
  popular?: boolean;
  tokens: number;
}

const PLANS: Plan[] = [
  {
    id: 'single',
    name: '1 Turnier',
    price: '9,99 €',
    priceId: 'price_single',
    tokens: 1,
    features: [
      'Unbegrenzte Teilnehmer',
      'Alle Kategorien & Formate',
      'Live-Ansicht für Beamer',
      'CSV Import/Export',
    ],
  },
  {
    id: 'triple',
    name: '3 Turniere',
    price: '24,99 €',
    priceId: 'price_triple',
    tokens: 3,
    popular: true,
    features: [
      'Alles aus "1 Turnier"',
      '3 Turnier-Tokens',
      '17% Ersparnis',
    ],
  },
  {
    id: 'annual',
    name: '10 Turniere',
    price: '69,99 €',
    priceId: 'price_annual',
    tokens: 10,
    features: [
      'Alles aus "1 Turnier"',
      '10 Turnier-Tokens',
      '30% Ersparnis',
      'Ideal für Vereine',
    ],
  },
];

export default function PricingCard({ onClose }: { onClose: () => void }) {
  const { unusedTokenCount, freeTrialsUsed, freeTrialLimit, addToken } = useTokens();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const isStripeConfigured = !!STRIPE_PUBLISHABLE_KEY && !!API_BASE;

  const handlePurchase = async (plan: Plan) => {
    if (!isStripeConfigured) {
      // Demo mode: add tokens directly
      setPurchasing(plan.id);
      for (let i = 0; i < plan.tokens; i++) {
        addToken(`demo_${Date.now()}_${i}`);
      }
      setTimeout(() => {
        setPurchasing(null);
        onClose();
      }, 500);
      return;
    }

    setPurchasing(plan.id);
    try {
      const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          tokens: plan.tokens,
          successUrl: `${window.location.origin}/?payment=success`,
          cancelUrl: `${window.location.origin}/?payment=cancelled`,
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
