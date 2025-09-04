import { Adb, AdbDaemonTransport } from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb@2.1.0/+esm';
import { AdbDaemonWebUsbDeviceManager } from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb-daemon-webusb@2.1.0/+esm';

const STATIC_PRIVATE_KEY_B64 = 'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCjKztWbYwjKI6qa1eOr10yYSMoMMJvGRp40zWeD7SncxN3piurZiFngF+I+NdEikEvLGfXg1uRSgxrIpwYbrU9b1KQUxkTYSR7mdSG7sn5BbpSZuoXSAztwxhM3EpPZfd3xkFTtr8RmHv/jjfNJda/aM5SxwYBSU3wIb/T0SJokskC33CZzxC7AL1XuXOMoXntus6L9xM+QEZBvDypItME/iLV+Cwu1ZcPJQBRfuB1JRR5hRMX41nfpbXHxHaDNQKUaEsFpSyu/YE+2/hkKQqMapjTFX4cTiJohIAyPu4kJdEY+4o34m6I0njKHb+9wV+ORMO0HIw9pZ7h2D9AKfbAgMBAAECggEAB5UbOU127S1Vz+KUG4vXq18rOJNnfa0vdzztaW52aS+mUHGW5uykkcA78EwMCOHZ3JzWKIQwraRAxpn1hvprqbjPtpMpPyIBDp0DDSQ/wr9NN0MV6jGFrRGNEDlJQW7cz1EuQvpin8WPiI0KTIkPnYla2+87G3yluZ0HSPcAitq+P3kuhUCI4DR6CWA3LU1LEaApf2uKnt0r7wvRxmBJIVLNP+GESpZzo2BV/oEsuIr71JEEAza+z36cEOMi31HnVshV1ebiJAotrZpqU/oy6K8ub2kwv8oProVAP+OOpe6peLiANwmykHcPRDlXA3cLOn7JGTD8o81O3qfa0exxqQKBgQDlKc6uCgWDVx62Fk7upd1ZVzPbLNWc9jOnx/GFJ9ISF6ig6xQbSSZwJ5PCG70BQJ0azqZ6IWjJyDT2OrBh6WUWcrG3FY06PJbUQ+knbsHUb1tgxkEXTMV8BPqIVXInKVX3HEL4HXouKZZs2tEQtdmro/p8+8sucTyFcp7E/6mCuQKBgQC2RvJgz4kCSLLtejaLOZv2T8R96N4secx4BZPxrlI95HGDsweHXFbjHCiZgb5V8bjkrth/dcEXPX4IYaiU60CWZ8ff0B6C8S4GE0XRDW5dKwFmRQYwFpEtJk3zZy8cDVUndWw9qLf6gWjIahepzQogmv1D0zaJfj/qSXJXVR4FMwKBgQCaPxmua3BqhylUxo86csoaaGevDu55R/5c4GfgiH0NUH9gUNqnwwTsWLdL3//H6AXXFWFYs0QlDW0Yj0hJnx87jNexs//rQv0CwvMcZ6BvrMSEzuzhEfubDn7TZTAAzAHg4lTxTGYAzF1Dx8UQylZJAYaIubJ5AB8Mc6oKT0t5gQKBgQCtX84rRzuKcJvARf6bbrBqGHVNTbIFm9RgVO3jc2vGcwOFwUPn/GyomKAFYuMn3EOBQM2sbtS6xkKatkkjXKCSbyQuPkbHRaABJ1PBBIV1GPK70+uO0ehEiaqbWgn1JLlaTtYlz9Uu8Og5uK/JUr3PRZygZsX5AZzJvBKF/vAPAQKBgAq6uyV0AsB0S5whnJmjRUn15SMNPD4odIaVs16L7xlaWD6rGjXw78zTCnTbD9obK9CrcnIg2sEAutX65U624pkhiYeEvzkq8tqHmFDiKXB5iFV/SfZV+1qEdIoC22/gXzbiCC+ZP6/gtSAt7V4/lvleetU+EuYa9FB/vi4vlotE';

function fromB64(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export class AdbConnection {
    constructor() {
        this.manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        this.device = null;
        this.transport = null;
        this.adb = null;
    }

    async connect(uiManager = null) {
        if (!this.manager) {
            throw new Error('WebUSB is not supported in this browser.');
        }
        try {
            const devices = await this.manager.getDevices();
            const cached = JSON.parse(localStorage.getItem('adbDevice') || 'null');
            let target = null;
            if (cached) {
                target = devices.find(d =>
                    d.raw.vendorId === cached.vendorId &&
                    d.raw.productId === cached.productId &&
                    (!cached.serialNumber || d.serial === cached.serialNumber)
                );
            }
            if (!target) {
                if (devices.length > 0) target = devices[0];
                else target = await this.manager.requestDevice();
            }
            if (!target) {
                throw new Error('No compatible Android device found. Please connect your device via USB and ensure USB debugging is enabled.');
            }

            this.device = target;
            try {
                localStorage.setItem('adbDevice', JSON.stringify({
                    vendorId: target.raw.vendorId,
                    productId: target.raw.productId,
                    serialNumber: target.serial
                }));
            } catch (e) {
                console.warn('Failed to cache device info', e);
            }

            const connection = await target.connect();

            const privateKey = fromB64(STATIC_PRIVATE_KEY_B64);
            const credentialStore = {
                async generateKey() { return { buffer: privateKey }; },
                iterateKeys() { return [{ buffer: privateKey }]; }
            };

            this.transport = await AdbDaemonTransport.authenticate({
                serial: target.serial,
                connection,
                credentialStore
            });

            this.adb = new Adb(this.transport);
            return target.raw;
        } catch (error) {
            console.error('Connection error:', error);
            if (error.name === 'NotFoundError') {
                throw new Error('No compatible Android device found. Please connect your device via USB and ensure USB debugging is enabled.');
            } else if (error.name === 'SecurityError') {
                throw new Error('USB device access denied. Please ensure you are using a secure context (HTTPS) and have granted permission to access the device.');
            } else if (error.message?.includes('Authentication')) {
                throw new Error('Device authorization required. Please check your Android device and tap "Allow".');
            }
            throw error;
        }
    }

    async disconnect(clearCache = true) {
        if (this.adb) {
            try { await this.adb.close(); } catch {}
        }
        this.adb = null;
        this.transport = null;
        this.device = null;
        if (clearCache) {
            try { localStorage.removeItem('adbDevice'); } catch {}
        }
    }

    async executeShellCommand(command) {
        if (!this.adb) {
            throw new Error('No device connected');
        }
        let processedCommand = command;
        if (command.includes('dpm set-device-owner')) {
            const match = command.match(/dpm set-device-owner\s+(?:["']([^"']+)["']|([^\s]+))/);
            if (match) {
                const componentName = match[1] || match[2];
                processedCommand = `dpm set-device-owner '${componentName}'`;
            }
        } else if (command.includes('dpm ') && command.includes('/')) {
            processedCommand = command.replace(/([\w.]+\/[\w.]+)/g, "'$1'");
        }
        try {
            return await this.adb.subprocess.noneProtocol.spawnWaitText(processedCommand);
        } catch (error) {
            console.error('Shell command error:', error);
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }

    async pushFile(localFile, remotePath) {
        if (!this.adb) {
            throw new Error('No device connected');
        }
        try {
            const sync = await this.adb.sync();
            await sync.write({ filename: remotePath, file: localFile.stream(), permission: 0o644 });
            await sync.dispose();
            return true;
        } catch (error) {
            console.error('Push file error:', error);
            throw new Error(`Failed to push file: ${error.message}`);
        }
    }

    async installApk(apkFile) {
        if (!this.adb) {
            throw new Error('No device connected');
        }
        try {
            const tempFile = `/data/local/tmp/${Date.now()}_${apkFile.name}`;
            await this.pushFile(apkFile, tempFile);
            const result = await this.executeShellCommand(`pm install -r "${tempFile}"`);
            await this.executeShellCommand(`rm "${tempFile}"`);
            if (result.includes('Success')) {
                return { success: true, message: 'APK installed successfully' };
            } else {
                throw new Error(result);
            }
        } catch (error) {
            console.error('APK installation error:', error);
            throw new Error(`Failed to install APK: ${error.message}`);
        }
    }

    async getDeviceInfo() {
        if (!this.adb) {
            throw new Error('No device connected');
        }
        try {
            const [model, androidVersion] = await Promise.all([
                this.executeShellCommand('getprop ro.product.model'),
                this.executeShellCommand('getprop ro.build.version.release')
            ]);
            return {
                model: model.trim(),
                androidVersion: androidVersion.trim(),
                serial: this.transport?.serial || this.device?.serial || ''
            };
        } catch (error) {
            console.error('Get device info error:', error);
            throw new Error(`Failed to get device info: ${error.message}`);
        }
    }

    isConnected() {
        return this.adb !== null;
    }
}

