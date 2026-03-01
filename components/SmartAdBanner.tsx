'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabaseBrowser() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anon ? createClient(url, anon) : null;
}

export default function SmartAdBanner({ width = 300, height = 250 }: { width?: number; height?: number }) {
  const [adConfig, setAdConfig] = useState({ adsterra: false, adsense: false, loading: true });

  const adsterraKey = width >= 728
    ? (process.env.NEXT_PUBLIC_ADSTERRA_KEY_728 ?? '')
    : (process.env.NEXT_PUBLIC_ADSTERRA_KEY_300 ?? '');

  useEffect(() => {
    async function fetchAdSettings() {
      try {
        const supabase = getSupabaseBrowser();
        if (!supabase) {
          setAdConfig({ adsterra: false, adsense: false, loading: false });
          return;
        }
        const { data, error } = await supabase
          .from('ad_settings')
          .select('enable_adsterra, enable_adsense')
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          setAdConfig({ adsterra: false, adsense: false, loading: false });
          return;
        }
        setAdConfig({
          adsterra: data.enable_adsterra === true,
          adsense: data.enable_adsense === true,
          loading: false,
        });
      } catch {
        setAdConfig({ adsterra: false, adsense: false, loading: false });
      }
    }
    fetchAdSettings();
  }, []);

  useEffect(() => {
    if (!adConfig.adsense) return;
    try {
      (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || [];
      ((window as Window & { adsbygoogle: unknown[] }).adsbygoogle as unknown[]).push({});
    } catch (err: unknown) {
      const message = err instanceof Error ? (err as Error).message : String(err);
      if (message && typeof message === 'string' && message.includes('already have ads')) return;
      console.error('AdSense push error:', err);
    }
  }, [adConfig.adsense]);

  if (adConfig.loading) return null;
  if (!adConfig.adsterra && !adConfig.adsense) return null;

  const adsterraSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }</style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '${(adsterraKey as string).replace(/'/g, "\\'")}',
            'format' : 'iframe',
            'height' : ${height},
            'width' : ${width},
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highperformanceformat.com/${adsterraKey}/invoke.js"><\/script>
      </body>
    </html>
  `;

  return (
    <div className="w-full flex justify-center my-6">
      <div
        className="relative flex-shrink-0"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {adConfig.adsense && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              zIndex: adConfig.adsterra ? 0 : 1,
              visibility: adConfig.adsterra ? 'hidden' : 'visible',
              overflow: 'hidden',
            }}
            aria-hidden={adConfig.adsterra}
          >
            <ins
              className="adsbygoogle"
              style={{ display: 'inline-block', width: width, height: height }}
              data-ad-client="ca-pub-8938853828038526"
            />
          </div>
        )}
        {adConfig.adsterra && adsterraKey && (
          <iframe
            title="Advertisement"
            srcDoc={adsterraSrcDoc}
            width={width}
            height={height}
            frameBorder={0}
            scrolling="no"
            className="absolute inset-0 bg-transparent"
            style={{ zIndex: 1, overflow: 'hidden' }}
          />
        )}
      </div>
    </div>
  );
}
