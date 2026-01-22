# Meshtastic-Victron Bridge

A Node.js application that bridges Victron solar charge controller data to a Meshtastic mesh network. It reads battery and solar metrics via BLE from a Victron device and broadcasts them over LoRa using the Meshtastic protocol.

## Features

- 📡 **Meshtastic Integration** - Connects to a Meshtastic node via TCP and sends telemetry data
- 🔋 **Victron BLE Support** - Reads real-time data from Victron solar charge controllers via Bluetooth
- 📊 **Telemetry Broadcasting** - Sends DeviceMetrics and PowerMetrics as Meshtastic Telemetry packets
- ⚙️ **Remote Configuration** - Configure the script remotely via Meshtastic messages
- 🧪 **Mock Mode** - Test without a physical Victron device using simulated data

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

Edit `config.json` to customize the behavior:

```json
{
  "sendInterval": 300000,    // Telemetry send interval in ms (default: 5 min)
  "useMockVictron": false,   // Use simulated Victron data for testing
  "sendData": true,          // Enable/disable automatic data sending
  "meshChannel": 1           // Meshtastic channel index for messages
}
```

### Victron Setup

Update the Victron BLE address and encryption key in `index.js`:

```javascript
const victronArgs = ["read", "<MAC_ADDRESS>@<ENCRYPTION_KEY>"];
```

### Meshtastic Setup

Update the IP address of your Meshtastic node:

```javascript
const transport = await TransportNode.create("192.168.178.123");
```

## Usage

```bash
node index.js
```

The script will:
1. Connect to the Meshtastic node via TCP
2. Start reading Victron data (or mock data)
3. Periodically send telemetry to the mesh network

## Telemetry Data

The script sends two types of Meshtastic telemetry packets:

### DeviceMetrics
- `voltage` - Battery voltage
- `batteryLevel` - State of Charge (0-100%) calculated for a 4S Li-Ion pack

### PowerMetrics
| Channel | Description | Voltage | Current |
|---------|-------------|---------|---------|
| ch1 | Battery | Battery voltage | Charging current |
| ch2 | Solar | Calculated solar voltage | Solar current |
| ch3 | Load | Battery voltage | Device load current |

## Remote Commands

Send messages on the configured mesh channel to control the script:

| Command | Description |
|---------|-------------|
| `cfg sendInterval <ms>` | Set telemetry interval (min: 10000ms) |
| `cfg sendData true/false` | Enable/disable automatic sending |
| `cfg sendTelemetry` | Trigger immediate telemetry send |

## Battery SOC Calculation

The State of Charge is calculated for a **4S Li-Ion battery pack**:
- 100% = 16.8V (4 × 4.2V)
- 0% = 12.0V (4 × 3.0V)

Linear interpolation is used between these values.

## Dependencies

- `@meshtastic/core` - Meshtastic protocol implementation
- `@meshtastic/transport-node` - TCP transport for Node.js
- `@meshtastic/protobufs` - Protobuf definitions for Meshtastic
- `@bufbuild/protobuf` - Protobuf serialization

## License

ISC
