'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const WIDTH_728 = 728;
const DEFAULT_ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-8938853828038526';

function getAdsterraKey(width: number): string {
  if (typeof window === 'undefined') {
    return width >= WIDTH_728
      ? (process.env.NEXT_PUBLIC_ADSTERRA_KEY_728 ?? '')
      : (process.env.NEXT_PUBLIC_ADSTERRA_KEY_300 ?? '');
  }
  return width >= WIDTH_728
    ? (process.env.NEXT_PUBLIC_ADSTERRA_KEY_728 ?? '')
    : (process.env.NEXT_PUBLIC_ADSTERRA_KEY_300 ?? '');
}

function getSupabaseBrowser() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anon ? createClient(url, anon) : null;
}

type AdSettings = {
  enable_adsterra: boolean;
  enable_adsense: boolean;
};

type SmartAdBannerProps = {
  width?: number;
  height?: number;
  className?: string;
  adsenseSlot?: string;
  adsenseClient?: string;
};

export default function SmartAdBanner({
  width = 300,
  height = 250,
  className = '',
  adsenseSlot = '0000000001',
  adsenseClient = DEFAULT_ADSENSE_CLIENT,
}: SmartAdBannerProps) {
  const adsterraContainerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<AdSettings | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const adsterraKey = getAdsterraKey(width);

  // Fetch ad_settings from Supabase (enable_adsterra, enable_adsense)
  useEffect(() => {
    const fetchAdSettings = async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        setConfig({ enable_adsterra: true, enable_adsense: true });
        setConfigLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('ad_settings')
          .select('enable_adsterra, enable_adsense')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setConfig({ enable_adsterra: true, enable_adsense: true });
          setConfigLoading(false);
          return;
        }
        setConfig({
          enable_adsterra: Boolean(data.enable_adsterra),
          enable_adsense: Boolean(data.enable_adsense),
        });
      } catch {
        setConfig({ enable_adsterra: true, enable_adsense: true });
      } finally {
        setConfigLoading(false);
      }
    };
    fetchAdSettings();
  }, []);

  // AdSense: when enabled, push slot so the global script fills the <ins>
  useEffect(() => {
    if (configLoading || !config?.enable_adsense || typeof window === 'undefined') return;
    const t = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense script may not be loaded yet (e.g. before approval)
      }
    }, 100);
    return () => clearTimeout(t);
  }, [configLoading, config?.enable_adsense]);

  // Adsterra: when enabled, inject script (key by width)
  useEffect(() => {
    if (!config?.enable_adsterra || !adsterraKey || !adsterraContainerRef.current) return;

    const container = adsterraContainerRef.current;
    container.innerHTML = '';

    const inlineScript = document.createElement('script');
    inlineScript.type = 'text/javascript';
    inlineScript.textContent = [
      'window.atOptions = window.atOptions || {};',
      `window.atOptions = { key: "${adsterraKey.replace(/"/g, '\\"')}", format: "iframe", width: ${width}, height: ${height}, params: {} };`,
    ].join('\n');
    container.appendChild(inlineScript);

    const externalScript = document.createElement('script');
    externalScript.src = `https://www.highperformanceformat.com/${adsterraKey}/invoke.js`;
    externalScript.async = true;
    container.appendChild(externalScript);

    return () => {
      container.innerHTML = '';
    };
  }, [config?.enable_adsterra, adsterraKey, width, height]);

  if (configLoading) {
    return <div className={className} style={{ minWidth: width, minHeight: height }} />;
  }

  const showAdsense = config?.enable_adsense ?? true;
  const showAdsterra = config?.enable_adsterra ?? true;

  if (!showAdsense && !showAdsterra) return null;

  return (
    <div
      className={`flex flex-col gap-4 ${className}`}
      style={{ minWidth: width, minHeight: height }}
    >
      {showAdsense && (
        <div className="min-w-[320px] w-full" style={{ minHeight: 50 }}>
          <ins
            className="adsbygoogle"
            data-ad-client={adsenseClient}
            data-ad-slot={adsenseSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
            style={{ display: 'block', minWidth: 320, width, height }}
          />
        </div>
      )}
      {showAdsterra && adsterraKey && (
        <div
          ref={adsterraContainerRef}
          style={{ minWidth: width, minHeight: height }}
        />
      )}
    </div>
  );
}
