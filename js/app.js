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
        this.availableApks = [];
    }

    async init() {
        this.setupEventListeners();
        this.checkWebUSBSupport();
        this.uiManager.updateConnectionStatus('disconnected');
        await this.loadAvailableApks();
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
                this.apkInstaller.setAdbConnection(null);
                this.uiManager.updateConnectionStatus('disconnected');
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                    </svg>
                    Connect Device
                `;
                btn.disabled = false;
                document.getElementById('installCard').classList.add('hidden');
            } else {
                // Connect
                this.uiManager.log('Requesting USB device access...', 'info');
                this.uiManager.log('Please select your Android device from the browser prompt', 'info');
                this.device = await this.adbConnection.connect();
                
                if (this.device) {
                    // Link the ADB connection to the APK installer
                    this.apkInstaller.setAdbConnection(this.adbConnection);
                    
                    this.uiManager.log('Device connected. Getting device information...', 'info');
                    this.uiManager.log('If prompted on your device, tap "Allow" to authorize this computer', 'warning');
                    
                    const deviceInfo = await this.adbConnection.getDeviceInfo();
                    this.uiManager.updateConnectionStatus('connected', deviceInfo);
                    btn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                            <line x1="12" y1="2" x2="12" y2="12"></line>
                        </svg>
                        Disconnect
                    `;
                    btn.disabled = false;
                    document.getElementById('installCard').classList.remove('hidden');
                    this.uiManager.log('Device connected and ready', 'success');
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

    async loadAvailableApks() {
        try {
            const response = await fetch('/api/apks');
            const apks = await response.json();
            
            this.availableApks = apks;
            this.updateApkButtons();
        } catch (error) {
            console.error('Failed to load APKs:', error);
            this.uiManager.log('Failed to load APK files from server', 'warning');
            this.availableApks = [];
        }
    }

    updateApkButtons() {
        const apkButtonsContainer = document.querySelector('.app-grid');
        
        // Clear existing buttons except custom upload
        const existingButtons = apkButtonsContainer.querySelectorAll('.app-item:not([data-apk="custom"])');
        existingButtons.forEach(btn => btn.remove());
        
        // Add buttons for each APK file
        this.availableApks.forEach((apk, index) => {
            const button = document.createElement('button');
            button.className = 'app-item';
            button.dataset.apk = `file-${index}`;
            
            // Show indicator if APK has post-install commands
            const hasCommands = apk.postInstallCommands && apk.postInstallCommands.length > 0;
            const commandIndicator = hasCommands ? '<span class="command-indicator" title="Has post-install commands">⚙️</span>' : '';
            
            button.innerHTML = `
                <div class="app-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                    </svg>
                    ${commandIndicator}
                </div>
                <div class="app-info">
                    <h3>${apk.name.replace('.apk', '')}</h3>
                    <p>${this.formatFileSize(apk.size)}${hasCommands ? ' • Custom Setup' : ''}</p>
                </div>
            `;
            
            button.addEventListener('click', (e) => this.handleAppSelection(e));
            
            // Insert before the custom upload button
            const customButton = apkButtonsContainer.querySelector('[data-apk="custom"]');
            apkButtonsContainer.insertBefore(button, customButton);
        });
    }

    getPresetApkInfo(type) {
        if (type === 'custom') {
            return null; // Handle custom upload
        }
        
        if (type.startsWith('file-')) {
            const index = parseInt(type.replace('file-', ''));
            const apk = this.availableApks[index];
            
            if (apk) {
                return {
                    name: apk.name.replace('.apk', ''),
                    file: null, // Will be loaded when needed
                    apkPath: apk.path,
                    size: this.formatFileSize(apk.size),
                    package: 'unknown',
                    postInstallCommands: apk.postInstallCommands
                };
            }
        }
        
        return null;
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
                let fileToInstall = apk.file;
                
                // If it's an APK from the folder, fetch it
                if (apk.apkPath && !apk.file) {
                    this.uiManager.log(`Loading ${apk.name} from server...`, 'info');
                    const response = await fetch(apk.apkPath);
                    if (!response.ok) {
                        throw new Error(`Failed to load APK file: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    fileToInstall = new File([arrayBuffer], apk.name + '.apk', { type: 'application/vnd.android.package-archive' });
                }
                
                if (fileToInstall) {
                    // Install the APK file
                    await this.apkInstaller.installFromFile(this.device, fileToInstall);
                    
                    // Execute post-install commands if they exist
                    if (apk.postInstallCommands && apk.postInstallCommands.length > 0) {
                        this.uiManager.log(`Executing post-install commands for ${apk.name}...`, 'info');
                        
                        for (const command of apk.postInstallCommands) {
                            if (command.trim()) {
                                try {
                                    this.uiManager.log(`Running: ${command}`, 'info');
                                    const result = await this.adbConnection.executeShellCommand(command);
                                    if (result.trim()) {
                                        this.uiManager.log(`Command output: ${result.trim()}`, 'info');
                                    }
                                } catch (cmdError) {
                                    this.uiManager.log(`Command failed: ${command} - ${cmdError.message}`, 'warning');
                                }
                            }
                        }
                        
                        this.uiManager.log(`Post-install setup completed for ${apk.name}`, 'success');
                    }
                } else {
                    throw new Error('No APK file available for installation');
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
        
        // Don't auto-hide progress card or clear logs - user can access them later
        // Just clear the queue
        setTimeout(() => {
            this.clearQueue();
        }, 2000);
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
document.addEventListener('DOMContentLoaded', async () => {
    const app = new JTechMDMInstaller();
    await app.init();
    // Make UIManager globally accessible for modal buttons
    window.uiManager = app.uiManager;
});
