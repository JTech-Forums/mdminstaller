# JTech MDM Installer

A web-based tool for installing Mobile Device Management (MDM) applications on Android devices directly from your browser using WebUSB API.

## Features

- 🔌 Direct USB connection to Android devices
- 📱 Pre-configured MDM application profiles (Workspace ONE, Intune, Meraki)
- 📦 Custom APK installation support
- 🚀 Batch APK installation
- 📊 Real-time installation progress tracking
- 🌐 No software installation required - runs entirely in the browser
- 🔒 Secure WebUSB implementation

## Live Demo

Visit: [https://your-username.github.io/jtechmdminstaller](https://your-username.github.io/jtechmdminstaller)

## Requirements

### Browser Requirements
- Chrome or Edge browser (version 61+)
- WebUSB API support enabled

### Device Requirements
- Android device with Developer Options enabled
- USB Debugging enabled
- USB cable for connection

## Setup Instructions

### Enable Developer Options on Android

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times
3. You'll see "You are now a developer!" message

### Enable USB Debugging

1. Go to **Settings** → **Developer Options**
2. Enable **USB Debugging**
3. When prompted on device, allow USB debugging for your computer

## Usage

1. **Connect Device**
   - Connect your Android device via USB
   - Click "Connect Device" button
   - Select your device from the browser prompt
   - Authorize the connection on your device

2. **Select MDM Applications**
   - Choose from pre-configured MDM apps:
     - VMware Workspace ONE
     - Microsoft Intune
     - Cisco Meraki SM
   - Or upload custom APK files

3. **Install Applications**
   - Review installation queue
   - Click "Install All" to begin
   - Monitor progress in real-time

## Development

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/your-username/jtechmdminstaller.git
cd jtechmdminstaller
```

2. Serve the files locally (requires HTTPS for WebUSB):
```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx http-server -S -C cert.pem
```

3. Access via `https://localhost:8000`

### Project Structure

```
jtechmdminstaller/
├── index.html           # Main HTML file
├── css/
│   └── styles.css      # Styling
├── js/
│   ├── app.js          # Main application logic
│   ├── adb-connection.js   # WebUSB/ADB connection handling
│   ├── apk-installer.js    # APK installation logic
│   └── ui-manager.js       # UI updates and notifications
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages deployment
```

## Deployment

The site automatically deploys to GitHub Pages when changes are pushed to the main branch.

### Manual Deployment

1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Select "Deploy from a branch" → "main" → "/ (root)"
4. Your site will be available at `https://[username].github.io/jtechmdminstaller`

## Security Considerations

- WebUSB requires HTTPS for security
- Users must manually enable USB debugging
- Browser shows permission prompts for device access
- Cannot bypass Android security features
- No sensitive data is stored or transmitted

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome Desktop | ✅ Full Support (v61+) |
| Edge | ✅ Full Support (v79+) |
| Chrome Android | ✅ Full Support |
| Firefox | ❌ No WebUSB Support |
| Safari | ❌ No WebUSB Support |

## Troubleshooting

### Device Not Detected
- Ensure USB Debugging is enabled
- Try different USB cable/port
- Restart ADB: `adb kill-server && adb start-server`
- Check device authorization

### Installation Fails
- Check available storage space
- Verify APK compatibility with device
- Ensure no conflicting app versions
- Check device logs: `adb logcat`

### USB Transfer Errors
- Ensure your device is properly connected via USB
- Check that USB debugging is enabled on your Android device
- Try using a different USB cable or port
- Make sure your device is not in sleep mode during the connection process
- Verify that you're using Chrome or Edge browser (Firefox and Safari do not support WebUSB)
- Check that you're accessing the application via HTTPS (required for WebUSB)
- Try restarting your device's ADB service: `adb kill-server && adb start-server`
- On your Android device, go to Settings → Developer Options → Revoke USB debugging authorizations, then reconnect

### Browser Issues
- Use Chrome or Edge browser
- Enable WebUSB flag if disabled
- Clear browser cache
- Try incognito/private mode

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- WebUSB API documentation and examples
- Android Debug Bridge (ADB) protocol
- MDM vendors for their Android management solutions

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

© 2025 JTech Solutions. Built with WebUSB technology.
