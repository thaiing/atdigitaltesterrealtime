"""
Thermal Camera API - Hikvision ISAPI Integration
Provides temperature data from thermal camera zones
"""
from flask import Flask, jsonify
from flask_cors import CORS
import requests
from requests.auth import HTTPDigestAuth
import xml.etree.ElementTree as ET
import os

app = Flask(__name__)
CORS(app)

# Camera configuration from environment variables
CAMERA_IP = os.getenv('THERMAL_CAMERA_IP', '192.168.127.7')
CAMERA_USER = os.getenv('THERMAL_CAMERA_USER', 'admin')
CAMERA_PASSWORD = os.getenv('THERMAL_CAMERA_PASSWORD', 'admin123')
CAMERA_PORT = os.getenv('THERMAL_CAMERA_PORT', '80')

# Zone configurations (channel, preset_id, rule_id)
ZONES_CONFIG = [
    {"zone_id": 1, "zone_name": "Zone 1", "channel": 2, "preset_id": 1, "rule_id": 1},
    {"zone_id": 2, "zone_name": "Zone 2", "channel": 2, "preset_id": 1, "rule_id": 2},
    {"zone_id": 3, "zone_name": "Zone 3", "channel": 2, "preset_id": 1, "rule_id": 3},
    {"zone_id": 4, "zone_name": "Zone 4", "channel": 2, "preset_id": 1, "rule_id": 4},
]

def get_isapi_url(channel, preset_id, rule_id, meter_type=0):
    """Build ISAPI URL for radiometry data"""
    return (
        f"http://{CAMERA_IP}:{CAMERA_PORT}/ISAPI/Thermal/channels/{channel}"
        f"/thermometry/{preset_id}/rules/{rule_id}/currentTemperature?format=json&meterType={meter_type}"
    )

def fetch_zone_temperature(zone_config):
    """Fetch temperature data for a single zone"""
    try:
        url = get_isapi_url(
            zone_config['channel'],
            zone_config['preset_id'],
            zone_config['rule_id']
        )
        
        response = requests.get(
            url,
            auth=HTTPDigestAuth(CAMERA_USER, CAMERA_PASSWORD),
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            temp_info = data.get('ThermometryCurrentTemperature', {})
            
            return {
                "zone_id": zone_config['zone_id'],
                "zone_name": zone_config['zone_name'],
                "avg_c": temp_info.get('avgTemperature', 0) / 10.0,  # Convert to Celsius
                "max_c": temp_info.get('maxTemperature', 0) / 10.0,
                "min_c": temp_info.get('minTemperature', 0) / 10.0,
            }
        else:
            print(f"[Zone {zone_config['zone_id']}] HTTP Error: {response.status_code}")
            return {
                "zone_id": zone_config['zone_id'],
                "zone_name": zone_config['zone_name'],
                "avg_c": 0,
                "max_c": 0,
                "min_c": 0,
                "error": f"HTTP {response.status_code}"
            }
            
    except requests.exceptions.Timeout:
        print(f"[Zone {zone_config['zone_id']}] Timeout connecting to camera")
        return {
            "zone_id": zone_config['zone_id'],
            "zone_name": zone_config['zone_name'],
            "avg_c": 0,
            "max_c": 0,
            "min_c": 0,
            "error": "Timeout"
        }
    except Exception as e:
        print(f"[Zone {zone_config['zone_id']}] Error: {str(e)}")
        return {
            "zone_id": zone_config['zone_id'],
            "zone_name": zone_config['zone_name'],
            "avg_c": 0,
            "max_c": 0,
            "min_c": 0,
            "error": str(e)
        }

@app.route('/')
@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "camera_ip": CAMERA_IP})

@app.route('/api/thermal-camera/radiometry/zones')
def get_all_zones():
    """Get temperature data for all configured zones"""
    zones_data = []
    
    for zone_config in ZONES_CONFIG:
        zone_temp = fetch_zone_temperature(zone_config)
        zones_data.append(zone_temp)
    
    return jsonify({"zones": zones_data})

@app.route('/api/thermal-camera/radiometry/zone/<int:zone_id>')
def get_zone(zone_id):
    """Get temperature data for a specific zone"""
    zone_config = next((z for z in ZONES_CONFIG if z['zone_id'] == zone_id), None)
    
    if not zone_config:
        return jsonify({"error": f"Zone {zone_id} not found"}), 404
    
    zone_temp = fetch_zone_temperature(zone_config)
    return jsonify(zone_temp)

@app.route('/api/thermal-camera/config')
def get_config():
    """Get thermal camera configuration"""
    return jsonify({
        "camera_ip": CAMERA_IP,
        "zones": ZONES_CONFIG
    })

if __name__ == '__main__':
    print(f"Starting Thermal Camera API...")
    print(f"Camera IP: {CAMERA_IP}")
    print(f"Camera User: {CAMERA_USER}")
    print(f"Zones configured: {len(ZONES_CONFIG)}")
    app.run(host='0.0.0.0', port=5001)
