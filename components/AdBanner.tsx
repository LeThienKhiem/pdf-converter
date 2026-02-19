"use client";

import { useEffect } from "react";

const DEFAULT_CLIENT = "ca-pub-8938853828038526";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

type AdBannerProps = {
  dataAdSlot: string;
  dataAdFormat?: string;
  dataAdClient?: string;
  className?: string;
};

export default function AdBanner({
  dataAdSlot,
  dataAdFormat = "auto",
  dataAdClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? DEFAULT_CLIENT,
  className = "",
}: AdBannerProps) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // Prevent hydration or route-change crashes; AdSense may not be loaded yet
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      data-ad-client={dataAdClient}
      data-ad-slot={dataAdSlot}
      data-ad-format={dataAdFormat}
      data-full-width-responsive="true"
      style={{ display: "block" }}
    />
  );
}
