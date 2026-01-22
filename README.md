# Meshtastic-Victron Bridge

A Node.js application that bridges Victron solar charge controller data to a Meshtastic mesh network. It reads battery and solar metrics via BLE from a Victron device and broadcasts them over LoRa using the Meshtastic protocol.

## Features

- 📡 **Meshtastic Integration** - Connects to a Meshtastic node via TCP and sends telemetry data
- 🔋 **Victron BLE Support** - Reads real-time data from Victron solar charge controllers via Bluetooth
- 📊 **Telemetry Broadcasting** - Sends DeviceMetrics as Meshtastic Telemetry packets
- ⚙️ **Remote Configuration** - Configure the script remotely via Meshtastic messages
- 🧪 **Mock Mode** - Test without a physical Victron device using simulated data
- 💾 **Persistent Config** - All settings stored in `config.json`

## Requirements

- Node.js 18+ (ESM support required)
- A Meshtastic device with TCP API enabled (e.g., via WiFi)
- [victron-ble](https://github.com/keshavdv/victron-ble) CLI tool (for Victron data)
- Victron solar charge controller with BLE support

## Installation

```bash
git clone <repo-url>
cd meshtastic-victron
npm install
```

## Configuration

All settings are managed via `config.json`:

```json
{
  "sendInterval": 300000,              // Telemetry send interval in ms (default: 5 min)
  "useMockVictron": false,             // Use simulated Victron data for testing
  "sendData": true,                    // Enable/disable automatic data sending
  "meshChannel": 1,                    // Meshtastic channel for text messages
  "telemetryMeshChannel": 0,           // Meshtastic channel for telemetry (-1 to disable)
  "batteryBatteryLevelHigh": 16.8,     // Voltage at 100% SOC
  "batteryBatteryLevelLow": 12.8,      // Voltage at 0% SOC
  "victronCliPath": "victron-ble",     // Path to victron-ble CLI
  "victronMacAddr": "C8:6E:AB:50:70:9A",  // Victron device MAC address
  "victronPasskey": "your-passkey-here",  // Victron BLE encryption key
  "meshtasticIp": "192.168.178.123"    // IP address of Meshtastic node
}
```

### Getting Victron BLE Credentials

1. Install the VictronConnect app on your phone
2. Connect to your Victron device
3. Go to Settings → Product Info → Show to find the encryption key
4. The MAC address can be found via Bluetooth scanning or in VictronConnect

## Usage

```bash
node index.js
```

The script will:
1. Connect to the Meshtastic node via TCP
2. Start reading Victron data (or mock data if `useMockVictron: true`)
3. Periodically send telemetry to the mesh network
4. Listen for remote configuration commands

## Telemetry Data

The script sends **DeviceMetrics** telemetry packets containing:

| Field | Description |
|-------|-------------|
| `voltage` | Battery voltage (V) |
| `batteryLevel` | State of Charge (0-100%) |

## Remote Commands

Send messages on the configured `meshChannel` to control the script:

| Command | Description |
|---------|-------------|
| `cfg sendInterval <ms>` | Set telemetry interval (min: 10000ms) |
| `cfg sendData true/false` | Enable/disable automatic sending |
| `cfg sendTelemetry` | Trigger immediate telemetry send |

## Battery SOC Calculation

The State of Charge is calculated using configurable voltage thresholds:

- **100%** = `batteryBatteryLevelHigh` (default: 16.8V for 4S Li-Ion)
- **0%** = `batteryBatteryLevelLow` (default: 12.8V for 4S Li-Ion)

Linear interpolation:
$$SOC = \frac{V_{current} - V_{low}}{V_{high} - V_{low}} \times 100$$

## Victron Data Fields

The script reads the following data from Victron devices:

- `battery_voltage` - Current battery voltage
- `battery_charging_current` - Charging current from solar
- `external_device_load` - Current draw from connected loads
- `solar_power` - Solar panel power output (W)
- `yield_today` - Total energy harvested today (Wh)
- `charge_state` - Charging state (bulk, absorption, float, etc.)
- `charger_error` - Error codes if any

## Dependencies

- `@meshtastic/core` - Meshtastic protocol implementation
- `@meshtastic/transport-node` - TCP transport for Node.js
- `@meshtastic/protobufs` - Protobuf definitions for Meshtastic
- `@bufbuild/protobuf` - Protobuf serialization

## License

ISC
