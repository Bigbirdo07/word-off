"use client";

import { useEffect } from "react";

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

interface AdBannerProps {
    slot: string;
    format?: "auto" | "rectangle" | "horizontal" | "vertical";
    className?: string;
}

export function AdBanner({ slot, format = "auto", className = "" }: AdBannerProps) {
    useEffect(() => {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.log("AdSense error:", err);
        }
    }, []);

    return (
        <div className={`ad-container ${className}`}>
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    );
}
