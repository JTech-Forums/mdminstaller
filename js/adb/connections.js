import { Adb, AdbDaemonTransport } from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb@2.1.0/+esm';
import { AdbDaemonWebUsbDeviceManager } from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb-daemon-webusb@2.1.0/+esm';
import AdbWebCredentialStore from 'https://cdn.jsdelivr.net/npm/@yume-chan/adb-credential-web@2.1.0/+esm';

export class AdbConnection {
    constructor() {
        this.manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        this.device = null;
        this.transport = null;
        this.adb = null;
        this.credentialStore = new AdbWebCredentialStore('WebADB Key');
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

            this.transport = await AdbDaemonTransport.authenticate({
                serial: target.serial,
                connection,
                credentialStore: this.credentialStore
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
                uiManager?.showWarning('Tap allow on your device');
                throw new Error('Device authorization required. Please check your Android device and tap "Allow".');
            }
            throw error;
        }
    }

    async disconnect(clearCache = false) {
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
            const [model, androidVersion, buildId] = await Promise.all([
                this.executeShellCommand('getprop ro.product.model'),
                this.executeShellCommand('getprop ro.build.version.release'),
                this.executeShellCommand('getprop ro.build.display.id')
            ]);
            return {
                model: model.trim(),
                androidVersion: androidVersion.trim(),
                buildId: buildId.trim(),
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

