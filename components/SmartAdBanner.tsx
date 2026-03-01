'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const DEFAULT_ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-8938853828038526';

type SmartAdBannerProps = {
  width?: number;
  height?: number;
  adsenseSlot?: string;
  adsenseClient?: string;
};

export default function SmartAdBanner({
  width = 300,
  height = 250,
  adsenseSlot = '0000000001',
  adsenseClient = DEFAULT_ADSENSE_CLIENT,
}: SmartAdBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [showAdsterra, setShowAdsterra] = useState(false);

  const activeKey = width >= 728
    ? (process.env.NEXT_PUBLIC_ADSTERRA_KEY_728 ?? '')
    : (process.env.NEXT_PUBLIC_ADSTERRA_KEY_300 ?? '');

  useEffect(() => {
    const fetchConfig = async () => {
      if (!supabase) {
        setShowAdsterra(true);
        return;
      }
      try {
        const { data } = await supabase.from('ad_settings').select('enable_adsterra').limit(1).single();
        if (data?.enable_adsterra) setShowAdsterra(true);
      } catch (error) {
        console.error('Supabase config fetch failed, defaulting to show ad', error);
        setShowAdsterra(true);
      }
    };
    fetchConfig();
  }, []);

  // AdSense: always render <ins> and push so Google Bot can verify
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Script may not be loaded yet (e.g. before approval)
      }
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Adsterra: DOM injection when enabled
  useEffect(() => {
    if (!showAdsterra || !bannerRef.current || !activeKey) return;

    bannerRef.current.innerHTML = '';

    const confScript = document.createElement('script');
    confScript.type = 'text/javascript';
    confScript.textContent = `
      atOptions = {
        'key' : '${activeKey.replace(/'/g, "\\'")}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    bannerRef.current.appendChild(confScript);

    const adScript = document.createElement('script');
    adScript.type = 'text/javascript';
    adScript.src = `https://www.highperformanceformat.com/${activeKey}/invoke.js`;
    bannerRef.current.appendChild(adScript);

    return () => {
      if (bannerRef.current) bannerRef.current.innerHTML = '';
    };
  }, [showAdsterra, activeKey, width, height]);

  return (
    <div className="flex flex-col gap-4 justify-center w-full my-4 overflow-hidden" style={{ minWidth: width, minHeight: height }}>
      {/* Google AdSense: always rendered for verification */}
      <div className="flex justify-center">
        <ins
          className="adsbygoogle"
          style={{ display: 'inline-block', width: width, height: height }}
          data-ad-client={adsenseClient}
          data-ad-slot={adsenseSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
      {/* Adsterra: when enabled via Supabase */}
      {showAdsterra && activeKey && (
        <div className="flex justify-center">
          <div ref={bannerRef} style={{ width: `${width}px`, height: `${height}px` }} />
        </div>
      )}
    </div>
  );
}
