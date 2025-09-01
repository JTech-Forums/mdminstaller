export class AdbConnection {
    constructor() {
        this.webusb = null;
        this.adb = null;
        this.device = null;
    }

    async connect() {
        try {
            // Open WebUSB connection
            this.webusb = await window.Adb.open("WebUSB");
            
            if (!this.webusb) {
                throw new Error('Failed to open WebUSB connection');
            }

            // Connect to ADB with auth callback for user notification
            const connectWithAuth = async () => {
                return await this.webusb.connectAdb("host::", (publicKey) => {
                    console.log('Device requires authorization. Please check your Android device.');
                    // This callback is called when the device needs authorization
                    // The prompt should appear on the Android device automatically
                });
            };

            this.adb = await connectWithAuth();

            // Wait until the device is authorized
            while (this.adb && this.adb.mode === 'unauthorized') {
                console.log('Waiting for device authorization...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.adb = await connectWithAuth();
            }

            if (!this.adb) {
                throw new Error('Failed to establish ADB connection');
            }

            // Store the device reference
            this.device = this.webusb.device;
            
            console.log('ADB connection established successfully');
            console.log('Device mode:', this.adb.mode);
            console.log('Device banner:', this.adb.banner);

            return this.device;
        } catch (error) {
            console.error('Connection error:', error);
            
            // Provide more specific error messages
            if (error.name === 'NotFoundError') {
                throw new Error('No compatible Android device found. Please connect your device via USB and ensure USB debugging is enabled.');
            } else if (error.name === 'SecurityError') {
                throw new Error('USB device access denied. Please ensure you are using a secure context (HTTPS) and have granted permission to access the device.');
            } else if (error.message.includes('AUTH')) {
                throw new Error('Device authorization required. Please check your Android device and tap "Allow" or "Always allow from this computer" when prompted.');
            } else if (error.message.includes('Failed to connect')) {
                throw new Error('Failed to connect to device. Please ensure USB debugging is enabled and the device is not in use by another ADB instance.');
            }
            
            throw error;
        }
    }

    async disconnect() {
        if (this.adb) {
            try {
                // Close ADB connection
                if (this.webusb) {
                    this.webusb.close();
                }
            } catch (error) {
                console.error('Disconnect error:', error);
            }
            this.webusb = null;
            this.adb = null;
            this.device = null;
        }
    }

    async getDeviceInfo() {
        if (!this.adb) {
            throw new Error('No device connected');
        }

        try {
            // Get device properties using shell commands
            const getProp = async (prop) => {
                try {
                    const shell = await this.adb.shell(`getprop ${prop}`);
                    const result = await this.receiveAll(shell);
                    await shell.close();
                    return result.trim();
                } catch (error) {
                    console.error(`Failed to get ${prop}:`, error);
                    return 'Unknown';
                }
            };

            const model = await getProp('ro.product.model');
            const manufacturer = await getProp('ro.product.manufacturer');
            const androidVersion = await getProp('ro.build.version.release');
            const sdk = await getProp('ro.build.version.sdk');
            const serial = await getProp('ro.serialno');

            return {
                model: `${manufacturer} ${model}`.trim() || 'Unknown Device',
                serial: serial || 'Unknown',
                androidVersion: androidVersion ? `Android ${androidVersion} (SDK ${sdk})` : 'Unknown'
            };
        } catch (error) {
            console.error('Failed to get device info:', error);
            // Return basic info from the banner if shell commands fail
            return {
                model: this.device?.productName || 'Unknown Device',
                serial: this.device?.serialNumber || 'Unknown',
                androidVersion: 'Unknown'
            };
        }
    }

    async executeShellCommand(command) {
        if (!this.adb) {
            throw new Error('No device connected');
        }

        console.log(`Executing: ${command}`);
        
        try {
            // For commands with quotes, we need to escape them properly
            // The webadb library expects the command as-is, but some commands need special handling
            let processedCommand = command;
            
            // Handle dpm commands specifically - they need proper component name formatting
            if (command.includes('dpm set-device-owner')) {
                // Extract the component name (with or without quotes)
                const match = command.match(/dpm set-device-owner\s+(?:["']([^"']+)["']|([^\s]+))/);
                if (match) {
                    const componentName = match[1] || match[2];
                    // For dpm commands, we need to properly escape the component name
                    processedCommand = `dpm set-device-owner '${componentName}'`;
                }
            } else if (command.includes('dpm ') && command.includes('/')) {
                // For other dpm commands with component names, wrap in single quotes
                processedCommand = command.replace(/([\w.]+\/[\w.]+)/g, "'$1'");
            }
            
            console.log(`Processed command: ${processedCommand}`);
            
            const shell = await this.adb.shell(processedCommand);
            const output = await this.receiveAll(shell);
            await shell.close();
            return output;
        } catch (error) {
            console.error('Shell command error:', error);
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }

    async pushFile(localFile, remotePath) {
        if (!this.adb) {
            throw new Error('No device connected');
        }

        console.log(`Pushing ${localFile.name} to ${remotePath}`);
        
        try {
            // Open sync service
            const sync = await this.adb.sync();
            
            // Push the file
            await sync.push(localFile, remotePath, 0o644, (sent, total) => {
                const progress = Math.round((sent / total) * 100);
                console.log(`Push progress: ${progress}%`);
            });
            
            // Close sync service
            await sync.quit();
            
            console.log('File pushed successfully');
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
            // Generate a temporary filename
            const tempFile = `/data/local/tmp/${Date.now()}_${apkFile.name}`;
            
            // Push APK to device
            await this.pushFile(apkFile, tempFile);
            
            // Install the APK
            const installCmd = `pm install -r "${tempFile}"`;
            const result = await this.executeShellCommand(installCmd);
            
            // Clean up temporary file
            await this.executeShellCommand(`rm "${tempFile}"`);
            
            // Check if installation was successful
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

    async receiveAll(shell) {
        let output = '';
        let decoder = new TextDecoder();
        
        try {
            while (true) {
                const response = await shell.receive();
                if (response.cmd === 'CLSE') {
                    break;
                }
                if (response.data) {
                    output += decoder.decode(response.data);
                }
                await shell.send('OKAY');
            }
        } catch (error) {
            // Stream closed
        }
        
        return output;
    }

    isConnected() {
        return this.adb !== null;
    }
}