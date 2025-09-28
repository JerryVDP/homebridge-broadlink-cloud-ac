# Changelog

## [3.0.0] - 2024-09-26

### 🚀 Major Changes
- **Complete rewrite**: Replaced local Broadlink API with AUX Cloud API
- **Cloud-based control**: Now works with any AUX AC unit connected to AUX Cloud service
- **Modern implementation**: Rebuilt with modern TypeScript and async/await patterns

### ✨ New Features
- **Cloud connectivity**: Control your AC from anywhere via AUX Cloud
- **Device discovery**: Built-in script to discover your device IDs
- **Automatic reconnection**: Handles session expiry and network issues
- **Enhanced logging**: Better error messages and debugging information
- **Region support**: Support for EU, USA, and China regions

### 🔧 Configuration Changes
**BREAKING**: Configuration format has completely changed

**Old format (no longer supported):**
```json
{
    "ip": "192.168.1.100",
    "mac": "aa:bb:cc:dd:ee:ff"
}
```

**New format:**
```json
{
    "email": "your@email.com",
    "password": "your_password",
    "region": "eu",
    "deviceId": "your_device_id"
}
```

### 🔨 Technical Changes
- **Node.js**: Minimum version bumped to 18.0.0
- **Homebridge**: Minimum version bumped to 1.6.0
- **Dependencies**: Replaced `broadlink-aircon-api` with `axios` and `crypto-js`
- **TypeScript**: Updated to ES2020 target

### 📦 New Tools
- `npm run discover`: Device discovery script
- `config-sample.json`: Sample configuration file

### 🎯 Supported Features
- Power control (On/Off)
- Temperature control (16-32°C)
- Mode selection (Auto, Cool, Heat, Dry, Fan)
- Fan speed control (Auto, Low, Medium, High, Turbo, Mute)
- Swing control (Horizontal, Vertical, Both)
- Optional features: Display, Health, Clean, Mildew, Sleep

### 📋 Requirements
- AUX AC unit connected to AUX Cloud (AC Freedom app)
- Valid AUX Cloud account credentials
- Internet connection for cloud API access

### 🔗 Credits
Based on the excellent [AUX Cloud integration for Home Assistant](https://github.com/maeek/ha-aux-cloud) by [@maeek](https://github.com/maeek).

---

## [2.2.3] - Previous Version
- Local Broadlink API implementation (deprecated)
- Required IP and MAC address configuration
- Limited device compatibility