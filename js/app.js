import { AdbConnection } from './adb-connection.js';
import { ApkInstaller } from './apk-installer.js';
import { UIManager } from './ui-manager.js';

class JTechMDMInstaller {
    constructor() {
        this.adbConnection = new AdbConnection();
        this.apkInstaller = new ApkInstaller();
        this.uiManager = new UIManager();
        this.device = null;
        this.apkQueue = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkWebUSBSupport();
        this.uiManager.updateConnectionStatus('disconnected');
    }

    checkWebUSBSupport() {
        if (!('usb' in navigator)) {
            this.uiManager.showError('WebUSB is not supported in this browser. Please use Chrome or Edge.');
            document.getElementById('connectBtn').disabled = true;
        }
    }

    setupEventListeners() {
        // Connection button
        document.getElementById('connectBtn').addEventListener('click', () => this.handleConnect());

        // MDM app buttons
        document.querySelectorAll('.app-item').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAppSelection(e));
        });

        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const apkInput = document.getElementById('apkInput');

        uploadArea?.addEventListener('click', () => apkInput.click());
        apkInput?.addEventListener('change', (e) => this.handleFileSelection(e));

        // Drag and drop
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileDrop(e);
        });

        // Queue management
        document.getElementById('clearQueueBtn')?.addEventListener('click', () => this.clearQueue());
        document.getElementById('installBtn')?.addEventListener('click', () => this.installApks());

        // Modals
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            document.getElementById('helpModal').classList.remove('hidden');
        });

        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            document.getElementById('aboutModal').classList.remove('hidden');
        });

        document.getElementById('closeHelpBtn')?.addEventListener('click', () => {
            document.getElementById('helpModal').classList.add('hidden');
        });

        document.getElementById('closeAboutBtn')?.addEventListener('click', () => {
            document.getElementById('aboutModal').classList.add('hidden');
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    async handleConnect() {
        try {
            const btn = document.getElementById('connectBtn');
            btn.disabled = true;

            if (this.device) {
                // Disconnect
                await this.adbConnection.disconnect();
                this.device = null;
                this.uiManager.updateConnectionStatus('disconnected');
                btn.textContent = 'Connect Device';
                btn.disabled = false;
                document.getElementById('installCard').classList.add('hidden');
            } else {
                // Connect
                this.uiManager.log('Requesting USB device access...', 'info');
                this.device = await this.adbConnection.connect();
                
                if (this.device) {
                    const deviceInfo = await this.adbConnection.getDeviceInfo();
                    this.uiManager.updateConnectionStatus('connected', deviceInfo);
                    btn.textContent = 'Disconnect';
                    btn.disabled = false;
                    document.getElementById('installCard').classList.remove('hidden');
                    this.uiManager.log('Device connected successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Connection error:', error);
            this.uiManager.showError(`Connection failed: ${error.message}`);
            document.getElementById('connectBtn').disabled = false;
        }
    }

    handleAppSelection(e) {
        const btn = e.currentTarget;
        const apkType = btn.dataset.apk;

        if (apkType === 'custom') {
            document.getElementById('uploadSection').classList.remove('hidden');
            document.getElementById('apkInput').click();
        } else {
            // Add pre-configured APK to queue
            const apkInfo = this.getPresetApkInfo(apkType);
            if (apkInfo) {
                this.addToQueue(apkInfo);
                btn.classList.add('selected');
            }
        }
    }

    getPresetApkInfo(type) {
        const presets = {
            'workspace-one': {
                name: 'VMware Workspace ONE',
                package: 'com.airwatch.androidagent',
                url: 'https://play.google.com/store/apps/details?id=com.airwatch.androidagent',
                size: '45.2 MB'
            },
            'intune': {
                name: 'Microsoft Intune Company Portal',
                package: 'com.microsoft.windowsintune.companyportal',
                url: 'https://play.google.com/store/apps/details?id=com.microsoft.windowsintune.companyportal',
                size: '38.7 MB'
            },
            'meraki': {
                name: 'Cisco Meraki Systems Manager',
                package: 'com.meraki.sm',
                url: 'https://play.google.com/store/apps/details?id=com.meraki.sm',
                size: '28.5 MB'
            }
        };

        return presets[type] || null;
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.name.toLowerCase().endsWith('.apk')) {
                this.addToQueue({
                    name: file.name,
                    file: file,
                    size: this.formatFileSize(file.size),
                    package: 'unknown'
                });
            }
        });
    }

    handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (file.name.toLowerCase().endsWith('.apk')) {
                this.addToQueue({
                    name: file.name,
                    file: file,
                    size: this.formatFileSize(file.size),
                    package: 'unknown'
                });
            }
        });
    }

    addToQueue(apkInfo) {
        // Check if already in queue
        const exists = this.apkQueue.find(item => item.name === apkInfo.name);
        if (!exists) {
            this.apkQueue.push(apkInfo);
            this.updateQueueDisplay();
            document.getElementById('apkQueue').classList.remove('hidden');
        }
    }

    removeFromQueue(index) {
        this.apkQueue.splice(index, 1);
        this.updateQueueDisplay();
        if (this.apkQueue.length === 0) {
            document.getElementById('apkQueue').classList.add('hidden');
        }
    }

    clearQueue() {
        this.apkQueue = [];
        this.updateQueueDisplay();
        document.getElementById('apkQueue').classList.add('hidden');
        document.querySelectorAll('.app-item').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queueList');
        queueList.innerHTML = '';

        this.apkQueue.forEach((apk, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `
                <div class="queue-item-info">
                    <div class="queue-item-icon">APK</div>
                    <div class="queue-item-details">
                        <h4>${apk.name}</h4>
                        <p>${apk.size} • ${apk.package}</p>
                    </div>
                </div>
                <button class="queue-item-remove" data-index="${index}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;

            item.querySelector('.queue-item-remove').addEventListener('click', () => {
                this.removeFromQueue(index);
            });

            queueList.appendChild(item);
        });
    }

    async installApks() {
        if (!this.device) {
            this.uiManager.showError('Please connect a device first');
            return;
        }

        if (this.apkQueue.length === 0) {
            this.uiManager.showError('No APKs in queue');
            return;
        }

        document.getElementById('progressCard').classList.remove('hidden');
        document.getElementById('installBtn').disabled = true;

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < this.apkQueue.length; i++) {
            const apk = this.apkQueue[i];
            const progress = ((i + 1) / this.apkQueue.length) * 100;
            
            this.uiManager.updateProgress(progress, `Installing ${apk.name}...`);
            this.uiManager.log(`Installing ${apk.name}...`, 'info');

            try {
                if (apk.file) {
                    // Install from file
                    await this.apkInstaller.installFromFile(this.device, apk.file);
                } else if (apk.url) {
                    // For preset APKs, we'd need to download first
                    this.uiManager.log(`Preset APK installation requires manual download`, 'warning');
                    this.uiManager.log(`Please download from: ${apk.url}`, 'info');
                    failCount++;
                    continue;
                }
                
                successCount++;
                this.uiManager.log(`Successfully installed ${apk.name}`, 'success');
            } catch (error) {
                failCount++;
                this.uiManager.log(`Failed to install ${apk.name}: ${error.message}`, 'error');
            }
        }

        this.uiManager.updateProgress(100, 'Installation complete');
        this.uiManager.log(`Installation complete: ${successCount} succeeded, ${failCount} failed`, 
                          failCount > 0 ? 'warning' : 'success');

        document.getElementById('installBtn').disabled = false;
        
        // Clear queue after installation
        setTimeout(() => {
            this.clearQueue();
            document.getElementById('progressCard').classList.add('hidden');
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new JTechMDMInstaller();
});