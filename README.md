# homebridge-broadlink-cloud-ac

Control your Broadlink AC unit through Homebridge.

## Support This Project

If you find this plugin helpful, consider supporting its development:

[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?hosted_button_id=HY8QDRPTKS2WA)

## Features

- **Auto-discovery**: Automatically finds and adds all AUX AC units in your account
- **Cloud-based control**: Works with any AUX AC unit that's connected to the AUX Cloud service
- **Full HomeKit integration**: Control power, temperature, mode, fan speed, and swing
- **Device management**: Hide specific devices using device IDs or friendly names
- **Automatic reconnection**: Handles session expiry and network issues

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

#### Check plugin logs
1. Configure the plugin with a placeholder deviceId
2. Check the Homebridge logs during startup
3. The available devices will be logged

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
- **Mode**: Auto, Cool, Heat
- **Temperature**: 16-32°C
- **Fan Speed**: HomeKit's native AC Fan speed control
- **Swing**: HomeKit's native fan oscilation control

## Troubleshooting

### Login Issues
- Ensure your email and password are correct
- Make sure you're using the correct region
- Try logging out and back in to the AC Freedom app

### Connection Issues
- The plugin will automatically attempt to reconnect on errors
- Check your internet connection
- Verify the AUX Cloud service is accessible