# homebridge-broadlink-cloud-ac

Control your Broadlink AC unit through Homebridge.

## Overview

This plugin has been completely rewritten to use the AUX Cloud API instead of the local Broadlink API, making it compatible with a wider range of AUX AC units that are supported by the AC Freedom mobile app.

## Features

- **Auto-discovery**: Automatically finds and adds all AUX AC units in your account
- **Cloud-based control**: Works with any AUX AC unit that's connected to the AUX Cloud service
- **Full HomeKit integration**: Control power, temperature, mode, fan speed, and swing
- **Device management**: Hide specific devices using device IDs or friendly names
- **Automatic reconnection**: Handles session expiry and network issues
- **Flexible configuration**: Choose between platform (auto-discovery) or accessory (manual) setup

## Requirements

- Node.js 18.0.0 or later
- Homebridge 1.6.0 or later
- An AUX AC unit connected to the AUX Cloud service
- AUX Cloud account (AC Freedom app account)

## Installation

```bash
npm install -g homebridge-broadlink-cloud-ac
```

Or install through the Homebridge UI.

## Configuration

### Platform Configuration (Auto-Discovery)

**Recommended**: Use the platform configuration to automatically discover all your AUX Cloud devices:

```json
{
    "platform": "AuxCloudPlatform",
    "name": "AUX Cloud",
    "email": "your@email.com",
    "password": "your_password",
    "region": "eu"
}
```

### Accessory Configuration (Manual)

You can still configure individual devices manually if preferred:

```json
{
    "accessory": "AirCondionerAccessory",
    "name": "Living Room AC",
    "email": "your@email.com",
    "password": "your_password",
    "region": "eu",
    "deviceId": "your_device_endpoint_id"
}
```

### Finding Your Device ID

#### Method 1: Use the discovery script
```bash
# From the plugin directory
npm run discover your@email.com your_password eu

# Or directly
node discover-devices.js your@email.com your_password eu
```

This will show all your devices with their endpoint IDs and friendly names.

#### Method 2: Check plugin logs
1. Configure the plugin with a placeholder deviceId
2. Check the Homebridge logs during startup
3. The available devices will be logged

#### Method 3: Use the AC Freedom app
You can use the device's friendly name from the AC Freedom app as the deviceId.

### Platform Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | string | Yes | "AUX Cloud" | Name for the platform |
| `email` | string | Yes | - | Your AUX Cloud account email |
| `password` | string | Yes | - | Your AUX Cloud account password |
| `region` | string | No | "eu" | Your AUX Cloud region ("eu", "usa", or "cn") |
| `autoDiscover` | boolean | No | true | Automatically discover and add all devices |
| `hiddenDevices` | string[] | No | [] | List of device IDs to hide from HomeKit |
| `discoveryInterval` | number | No | 0 | Re-discovery interval in minutes (0 = disabled) |
| `increments` | number | No | 0.5 | Temperature increment (0.5 or 1) |
| `swing` | number | No | 3 | Swing mode (1=horizontal, 2=vertical, 3=both) |
| `display` | boolean | No | false | Show display control switch |
| `health` | boolean | No | false | Show health mode control switch |
| `clean` | boolean | No | false | Show clean mode control switch |
| `mildew` | boolean | No | false | Show mildew proof control switch |
| `sleep` | boolean | No | false | Show sleep mode control switch |

### Accessory Configuration Options (Manual Mode)

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | string | Yes | - | Name for your AC in HomeKit |
| `email` | string | Yes | - | Your AUX Cloud account email |
| `password` | string | Yes | - | Your AUX Cloud account password |
| `region` | string | No | "eu" | Your AUX Cloud region ("eu", "usa", or "cn") |
| `deviceId` | string | Yes | - | Device endpoint ID or friendly name |
| `increments` | number | No | 0.5 | Temperature increment (0.5 or 1) |
| `swing` | number | No | 3 | Swing mode (1=horizontal, 2=vertical, 3=both) |
| `display` | boolean | No | false | Show display control switch |
| `health` | boolean | No | false | Show health mode control switch |
| `clean` | boolean | No | false | Show clean mode control switch |
| `mildew` | boolean | No | false | Show mildew proof control switch |
| `sleep` | boolean | No | false | Show sleep mode control switch |

### Hiding Devices

With the platform configuration, you can hide specific devices from HomeKit by adding their device IDs to the `hiddenDevices` array:

```json
{
    "platform": "AuxCloudPlatform",
    "name": "AUX Cloud",
    "email": "your@email.com",
    "password": "your_password",
    "region": "eu",
    "hiddenDevices": [
        "device_endpoint_id_1",
        "Bedroom AC",
        "device_endpoint_id_3"
    ]
}
```

You can use either:
- **Device endpoint ID**: The unique identifier (e.g., "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p")
- **Friendly name**: The device name as shown in the AC Freedom app (e.g., "Bedroom AC")

### Region Selection

- **eu**: Europe - `https://app-service-deu-f0e9ebbb.smarthomecs.de`
- **usa**: United States - `https://app-service-usa-fd7cc04c.smarthomecs.com`  
- **cn**: China - `https://app-service-chn-31a93883.ibroadlink.com`

## Supported Features

### Main Controls
- **Power**: On/Off control
- **Mode**: Auto, Cool, Heat, Dry, Fan
- **Temperature**: 16-32°C with configurable increments
- **Fan Speed**: Auto, Low, Medium, High, Turbo, Mute
- **Swing**: Horizontal, Vertical, or Both (configurable)

### Optional Controls (configurable)
- **Display**: Screen display on/off
- **Health**: Health/ionizer mode
- **Clean**: Self-cleaning mode
- **Mildew**: Mildew proof mode
- **Sleep**: Sleep mode

## Troubleshooting

### Login Issues
- Ensure your email and password are correct
- Make sure you're using the correct region
- Try logging out and back in to the AC Freedom app

### Device Not Found
- Check that your `deviceId` is correct
- Ensure the device is online in the AC Freedom app
- Try using the device's friendly name instead of endpoint ID

### Connection Issues
- The plugin will automatically attempt to reconnect on errors
- Check your internet connection
- Verify the AUX Cloud service is accessible