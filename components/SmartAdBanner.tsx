'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type SmartAdBannerProps = { width?: number; height?: number };

export default function SmartAdBanner({ width = 300, height = 250 }: SmartAdBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [showAdsterra, setShowAdsterra] = useState(false);
  const adsterraKey = width >= 728
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

  useEffect(() => {
    if (!showAdsterra || !bannerRef.current || !adsterraKey) return;

    bannerRef.current.innerHTML = '';

    const confScript = document.createElement('script');
    confScript.type = 'text/javascript';
    confScript.textContent = `
      atOptions = {
        'key' : '${adsterraKey.replace(/'/g, "\\'")}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    bannerRef.current.appendChild(confScript);

    const adScript = document.createElement('script');
    adScript.type = 'text/javascript';
    adScript.src = `https://www.highperformanceformat.com/${adsterraKey}/invoke.js`;
    bannerRef.current.appendChild(adScript);
  }, [showAdsterra, adsterraKey, width, height]);

  if (!showAdsterra) return null;

  return (
    <div className="flex justify-center w-full my-4 overflow-hidden">
      <div ref={bannerRef} style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
}
