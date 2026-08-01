/// <reference types="astro/client" />

interface Window {
    ntTrack?: (esemeny: string, parameterek?: Record<string, unknown>, opciok?: Record<string, unknown>) => void;
    ntAdvancedMatch?: (adatok: Record<string, string>) => void;
    ntConsentReopen?: () => void;
}
