"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    adsbygoogle: unknown[];
    atOptions?: Record<string, unknown>;
  }
}

type AdSettings = {
  enable_adsterra: boolean;
  enable_adsense: boolean;
  primary_network: "adsterra" | "adsense";
};

type SmartAdBannerProps = {
  adsterraKey?: string;
  width?: number;
  height?: number;
  adsenseClient?: string;
  adsenseSlot?: string;
  className?: string;
};

const DEFAULT_ADSENSE_CLIENT = "ca-pub-8938853828038526";

function getSupabaseBrowser() {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anon ? createClient(url, anon) : null;
}

export default function SmartAdBanner({
  adsterraKey = "",
  width = 320,
  height = 50,
  adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? DEFAULT_ADSENSE_CLIENT,
  adsenseSlot = "0000000000",
  className = "",
}: SmartAdBannerProps) {
  const adsterraContainerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<AdSettings | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [currentNetwork, setCurrentNetwork] = useState<"adsterra" | "adsense">("adsense");
  const [showAd, setShowAd] = useState(false);

  // Fetch ad_settings from Supabase
  useEffect(() => {
    const fetchAdSettings = async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        setConfigLoading(false);
        setConfig({
          enable_adsterra: false,
          enable_adsense: true,
          primary_network: "adsense",
        });
        return;
      }
      try {
        const { data, error } = await supabase
          .from("ad_settings")
          .select("enable_adsterra, enable_adsense, primary_network")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setConfig({
            enable_adsterra: false,
            enable_adsense: true,
            primary_network: "adsense",
          });
          setConfigLoading(false);
          return;
        }
        const primary = (data.primary_network === "adsterra" ? "adsterra" : "adsense") as "adsterra" | "adsense";
        setConfig({
          enable_adsterra: Boolean(data.enable_adsterra),
          enable_adsense: Boolean(data.enable_adsense),
          primary_network: primary,
        });
        setCurrentNetwork(primary);
        setShowAd(Boolean(data.enable_adsterra) || Boolean(data.enable_adsense));
      } catch {
        setConfig({
          enable_adsterra: false,
          enable_adsense: true,
          primary_network: "adsense",
        });
        setShowAd(true);
      } finally {
        setConfigLoading(false);
      }
    };
    fetchAdSettings();
  }, []);

  // Adsterra: atOptions injected via dangerouslySetInnerHTML in JSX; here we inject external invoke.js and ensure atOptions runs (scripts in innerHTML don't execute)
  useEffect(() => {
    if (!showAd || configLoading || currentNetwork !== "adsterra" || !adsterraKey || !adsterraContainerRef.current || !config?.enable_adsterra) return;

    console.log("SmartAdBanner: Injecting Adsterra", adsterraKey);

    const container = adsterraContainerRef.current;
    const scriptContainer = container.querySelector("[data-adsterra-scripts]");
    if (!scriptContainer) return;

    // Ensure atOptions is set (script in dangerouslySetInnerHTML does not execute)
    (window as Window).atOptions = {
      key: adsterraKey,
      format: "iframe",
      width,
      height,
    };

    const externalScript = document.createElement("script");
    externalScript.src = `https://www.highperformanceformat.com/${adsterraKey}/invoke.js`;
    externalScript.async = true;
    externalScript.onerror = () => {
      if (config?.enable_adsense) setCurrentNetwork("adsense");
    };
    scriptContainer.appendChild(externalScript);

    return () => {
      externalScript.remove();
    };
  }, [showAd, configLoading, currentNetwork, adsterraKey, width, height, config?.enable_adsterra, config?.enable_adsense]);

  // AdSense: inject script only when showing AdSense (no global script), then push. This is the ONLY place AdSense loads.
  useEffect(() => {
    if (!showAd || configLoading || currentNetwork !== "adsense" || !config?.enable_adsense || typeof window === "undefined") return;

    const client = adsenseClient;
    const pushSlot = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        if (config?.enable_adsterra && adsterraKey) setCurrentNetwork("adsterra");
      }
    };

    const scriptId = "adsbygoogle-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = pushSlot;
      script.onerror = () => {
        if (config?.enable_adsterra && adsterraKey) setCurrentNetwork("adsterra");
      };
      document.head.appendChild(script);
    } else {
      const t = setTimeout(pushSlot, 100);
      return () => clearTimeout(t);
    }
  }, [showAd, configLoading, currentNetwork, config?.enable_adsense, config?.enable_adsterra, adsterraKey, adsenseClient]);

  if (configLoading) {
    return <div className={className} style={{ minWidth: width, minHeight: height }} />;
  }

  if (!showAd || !config) return null;
  if (!config.enable_adsterra && !config.enable_adsense) return null;

  const renderAdsterra = currentNetwork === "adsterra" && config.enable_adsterra && adsterraKey;
  const renderAdsense = currentNetwork === "adsense" && config.enable_adsense;

  if (renderAdsterra) {
    const containerId = `adsterra-${adsterraKey.replace(/[^a-zA-Z0-9-_]/g, "-")}`;
    const atOptionsScript = [
      "window.atOptions = window.atOptions || {};",
      `window.atOptions = { key: "${adsterraKey.replace(/"/g, '\\"')}", format: "iframe", width: ${width}, height: ${height} };`,
    ].join("\n");
    return (
      <div
        id={containerId}
        className={className}
        style={{ minWidth: width, minHeight: height }}
        ref={adsterraContainerRef}
      >
        <div
          data-adsterra-scripts
          dangerouslySetInnerHTML={{
            __html: `<script type="text/javascript">${atOptionsScript}</script>`,
          }}
        />
      </div>
    );
  }

  if (renderAdsense) {
    return (
      <div className={className} style={{ minWidth: width, minHeight: height }}>
        <ins
          className="adsbygoogle"
          data-ad-client={adsenseClient}
          data-ad-slot={adsenseSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          style={{ display: "block", width, height }}
        />
      </div>
    );
  }

  return null;
}
