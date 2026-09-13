'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../hostinger/supabase';

type Metrics = { totalVisitors: number; uniqueVisitors: number; registeredUsers: number; activeAdopters: number };
const format = (value: number) => new Intl.NumberFormat('en-IN').format(value);

export function PublicAdoptionCounter() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    let visitorId = localStorage.getItem('mylekhpal_public_visitor');
    if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem('mylekhpal_public_visitor', visitorId); }
    void supabase.functions.invoke('track-public-visit', { body: { visitorId, path: window.location.pathname } });
    void supabase.functions.invoke('public-adoption-metrics').then(({ data, error }) => {
      if (!error && data && typeof data.totalVisitors === 'number') setMetrics(data as Metrics);
    });
  }, []);
  if (!metrics) return null;
  return <section className="adoption-counter" aria-label="MyLekhapal public adoption metrics">
    <div><small>PEOPLE WHO VISITED</small><strong>{format(metrics.totalVisitors)}</strong><span>Genuine sessions</span></div>
    <div><small>UNIQUE VISITORS</small><strong>{format(metrics.uniqueVisitors)}</strong><span>Privacy-preserving count</span></div>
    <div><small>REGISTERED USERS</small><strong>{format(metrics.registeredUsers)}</strong><span>Verified MyLekhapal accounts</span></div>
    <div><small>ACTIVE ADOPTERS</small><strong>{format(metrics.activeAdopters)}</strong><span>Verified live subscriptions</span></div>
  </section>;
}
