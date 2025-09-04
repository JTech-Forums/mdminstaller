export class ApkInstaller {
    constructor() {
        this.installPath = '/data/local/tmp/';
        this.adbConnection = null;
    }

    setAdbConnection(connection) {
        this.adbConnection = connection;
    }

    async installFromFile(device, apkFile) {
        if (!this.adbConnection || !this.adbConnection.isConnected()) {
            throw new Error('No ADB connection available');
        }

        try {
            // Validate APK file
            if (!apkFile.name.toLowerCase().endsWith('.apk')) {
                throw new Error('Invalid file type. Please select an APK file.');
            }

            console.log(`Installing APK: ${apkFile.name}`);
            
            // Use the ADB connection's installApk method which handles everything
            const result = await this.adbConnection.installApk(apkFile);
            
            return result;
        } catch (error) {
            console.error('Installation error:', error);
            
            // Parse and provide user-friendly error messages
            const friendlyError = this.parseInstallError(error.message);
            throw new Error(friendlyError);
        }
    }

    async getInstalledPackages(device) {
        if (!this.adbConnection || !this.adbConnection.isConnected()) {
            throw new Error('No ADB connection available');
        }

        try {
            const result = await this.adbConnection.executeShellCommand('pm list packages');
            
            // Parse the output (format: package:com.example.app)
            const packages = result
                .split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim());
                
            return packages;
        } catch (error) {
            console.error('Error getting installed packages:', error);
            return [];
        }
    }

    async uninstallPackage(device, packageName) {
        if (!this.adbConnection || !this.adbConnection.isConnected()) {
            throw new Error('No ADB connection available');
        }

        try {
            const command = `pm uninstall ${packageName}`;
            console.log(`Executing: ${command}`);
            
            const result = await this.adbConnection.executeShellCommand(command);
            
            if (result.includes('Success')) {
                return {
                    success: true,
                    message: 'Package uninstalled successfully'
                };
            } else {
                throw new Error(result);
            }
        } catch (error) {
            console.error('Uninstall error:', error);
            throw new Error(`Failed to uninstall package: ${error.message}`);
        }
    }

    async getPackageInfo(device, packageName) {
        if (!this.adbConnection || !this.adbConnection.isConnected()) {
            throw new Error('No ADB connection available');
        }

        try {
            const command = `dumpsys package ${packageName} | grep -E "versionName|versionCode|firstInstallTime"`;
            const result = await this.adbConnection.executeShellCommand(command);
            
            // Parse the output to extract version info
            const versionMatch = result.match(/versionName=([\S]+)/);
            const versionCodeMatch = result.match(/versionCode=(\d+)/);
            const installTimeMatch = result.match(/firstInstallTime=(.*)/);
            
            return {
                package: packageName,
                version: versionMatch ? versionMatch[1] : 'Unknown',
                versionCode: versionCodeMatch ? versionCodeMatch[1] : 'Unknown',
                installTime: installTimeMatch ? installTimeMatch[1] : 'Unknown'
            };
        } catch (error) {
            console.error('Error getting package info:', error);
            return {
                package: packageName,
                version: 'Unknown',
                versionCode: 'Unknown',
                installTime: 'Unknown'
            };
        }
    }

    async checkPackageInstalled(packageName) {
        if (!this.adbConnection || !this.adbConnection.isConnected()) {
            throw new Error('No ADB connection available');
        }

        try {
            const result = await this.adbConnection.executeShellCommand(`pm list packages | grep ${packageName}`);
            return result.includes(packageName);
        } catch (error) {
            console.error('Error checking package:', error);
            return false;
        }
    }

    parseInstallError(error) {
        const errorMap = {
            'INSTALL_FAILED_INSUFFICIENT_STORAGE': 'Not enough storage space on device',
            'INSTALL_FAILED_VERSION_DOWNGRADE': 'Cannot downgrade app version',
            'INSTALL_FAILED_DUPLICATE_PACKAGE': 'Package already exists',
            'INSTALL_FAILED_NO_SHARED_USER': 'Shared user does not exist',
            'INSTALL_FAILED_UPDATE_INCOMPATIBLE': 'Package signatures do not match',
            'INSTALL_FAILED_SHARED_USER_INCOMPATIBLE': 'Shared user signatures do not match',
            'INSTALL_FAILED_MISSING_SHARED_LIBRARY': 'Missing required shared library',
            'INSTALL_FAILED_CPU_ABI_INCOMPATIBLE': 'App not compatible with device CPU',
            'INSTALL_FAILED_OLDER_SDK': 'App requires newer Android version',
            'INSTALL_FAILED_TEST_ONLY': 'App is marked as test-only',
            'INSTALL_FAILED_INVALID_APK': 'Invalid or corrupted APK file',
            'INSTALL_FAILED_CONFLICTING_PROVIDER': 'Conflicting content provider',
            'INSTALL_FAILED_NEWER_SDK': 'App requires older Android version',
            'INSTALL_FAILED_DEXOPT': 'Failed to optimize dex file',
            'INSTALL_FAILED_CONTAINER_ERROR': 'Secure container mount error',
            'INSTALL_FAILED_INVALID_INSTALL_LOCATION': 'Invalid installation location',
            'INSTALL_FAILED_MEDIA_UNAVAILABLE': 'External media is not available',
            'INSTALL_FAILED_INTERNAL_ERROR': 'Internal system error',
            'INSTALL_FAILED_USER_RESTRICTED': 'User is restricted from installing apps',
            'INSTALL_FAILED_DUPLICATE_PERMISSION': 'Duplicate custom permission',
            'INSTALL_FAILED_NO_MATCHING_ABIS': 'No compatible CPU architecture'
        };

        for (const [key, message] of Object.entries(errorMap)) {
            if (error.includes(key)) {
                return message;
            }
        }

        // Check for permission errors
        if (error.includes('Permission denied') || error.includes('permission')) {
            return 'Permission denied. Please ensure USB debugging is properly authorized.';
        }

        // Check for connection errors
        if (error.includes('device offline') || error.includes('device not found')) {
            return 'Device is offline or disconnected. Please reconnect and try again.';
        }

        return error || 'Installation failed for unknown reason';
    }
}
