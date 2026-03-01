'use client';

import { useEffect } from 'react';

export default function SmartAdBanner({ width = 300, height = 250 }: { width?: number; height?: number }) {
  const key728 = process.env.NEXT_PUBLIC_ADSTERRA_KEY_728;
  const key300 = process.env.NEXT_PUBLIC_ADSTERRA_KEY_300;

  const adsterraKey = width >= 728 ? key728 : key300;

  console.log(`[DEBUG ADS] Size: ${width}x${height} | Key728: ${key728} | Key300: ${key300} | ActiveKey: ${adsterraKey}`);

  const adsterraSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff0f0; }</style>
      </head>
      <body>
        <div style="color: red; font-family: sans-serif; font-size: 12px;">
          ADSTERRA IFRAME LOADED. Key: ${adsterraKey ?? 'MISSING'}
        </div>
        <script type="text/javascript">
          atOptions = {
            'key' : '${(adsterraKey ?? '').toString().replace(/'/g, "\\'")}',
            'format' : 'iframe',
            'height' : ${height},
            'width' : ${width},
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highperformanceformat.com/${adsterraKey ?? ''}/invoke.js"><\/script>
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

  return (
    <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 w-full my-6 p-4 border-2 border-dashed border-blue-500 bg-blue-50">
      {/* Debug Info Header */}
      <div className="absolute -top-3 left-4 bg-blue-500 text-white text-xs px-2 py-1 rounded z-10">
        AD SLOT: {width}x{height} | KEY: {adsterraKey ? 'FOUND' : 'UNDEFINED'}
      </div>

      {/* Adsterra Money Slot (Iframe Sandbox) forced to render */}
      <iframe
        title="Advertisement"
        srcDoc={adsterraSrcDoc}
        width={width}
        height={height}
        frameBorder={0}
        scrolling="no"
        className="flex-shrink-0 bg-white border border-gray-300"
        style={{ overflow: 'hidden' }}
      />

      {/* AdSense Pending Slot */}
      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className="flex-shrink-0 hidden sm:flex items-center justify-center border border-green-400 bg-green-50"
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
          data-ad-client="ca-pub-8938853828038526"
        />
      </div>
    </div>
  );
}
