// src/app/interfaces/thermal-camera.interface.ts

/**
 * Request body for thermal camera API
 */
export interface ThermalCameraRequest {
    channel: number;
    preset_id: number;
    rule_id: number;
    meter_type: number;
    name: string | null;
}

/**
 * Response from thermal camera API (single zone)
 */
export interface ThermalCameraData {
    channel: number;
    preset_id: number;
    rule_id: number;
    meter_type: number;
    name: string | null;
    avg_c: number;   // Average temperature in Celsius
    max_c: number;   // Maximum temperature in Celsius
    min_c: number;   // Minimum temperature in Celsius
}

/**
 * Zone temperature data
 */
export interface ZoneTemperature {
    zone_id: number;
    zone_name: string;
    avg_c: number;
    max_c: number;
    min_c: number;
}

/**
 * Response from zones API
 */
export interface ThermalZonesResponse {
    zones: ZoneTemperature[];
}
