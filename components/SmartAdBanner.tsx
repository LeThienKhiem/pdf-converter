'use client';

import { useEffect } from 'react';

export default function SmartAdBanner({ width = 300, height = 250 }: { width?: number; height?: number }) {
  const adsterraKey = width >= 728
    ? (process.env.NEXT_PUBLIC_ADSTERRA_KEY_728 ?? '')
    : (process.env.NEXT_PUBLIC_ADSTERRA_KEY_300 ?? '');

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

  useEffect(() => {
    try {
      (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || [];
      ((window as Window & { adsbygoogle: unknown[] }).adsbygoogle as unknown[]).push({});
    } catch (err: unknown) {
      const message = err instanceof Error ? (err as Error).message : String(err);
      if (message && typeof message === 'string' && message.includes('already have ads')) return;
      console.error('AdSense push error:', err);
    }
  }, []);

  if (!adsterraKey) return null;

  return (
    <div className="w-full flex justify-center my-6">
      {/* Container restricted to exact ad dimensions to prevent layout shift */}
      <div
        className="relative flex-shrink-0"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* AdSense: underneath for Google Bot verification, hidden from view */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 0, visibility: 'hidden', overflow: 'hidden' }}
          aria-hidden="true"
        >
          <ins
            className="adsbygoogle"
            style={{ display: 'inline-block', width: width, height: height }}
            data-ad-client="ca-pub-8938853828038526"
          />
        </div>
        {/* Adsterra: on top, visible — single slot footprint */}
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
      </div>
    </div>
  );
}
