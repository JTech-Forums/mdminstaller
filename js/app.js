import { AdbConnection } from './adb-connection.js';
import { ApkInstaller } from './apk-installer.js';
import { UIManager } from './ui-manager.js';
import KITS from './kits.js';

class JTechMDMInstaller {
    constructor() {
        this.adbConnection = new AdbConnection();
        this.apkInstaller = new ApkInstaller();
        this.uiManager = new UIManager();
        this.device = null;
        this.apkQueue = [];
        this.availableApks = [];
        this.commandHistory = [];
        this.currentTutorialStep = 0;
        this.tutorialSteps = [];
        this.swiper = null;
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
        
        // ADB Console
        document.getElementById('executeBtn')?.addEventListener('click', () => this.executeCommand());
        document.getElementById('commandInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeCommand();
            if (e.key === 'ArrowUp') this.showPreviousCommand();
            if (e.key === 'ArrowDown') this.showNextCommand();
        });
        document.getElementById('clearConsoleBtn')?.addEventListener('click', () => this.clearConsole());
        document.getElementById('downloadConsoleBtn')?.addEventListener('click', () => this.downloadConsoleOutput());

        // Modals
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            this.showTutorialStep(0);
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

        document.getElementById('skipTutorialBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
        });

        document.getElementById('startTutorialBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
            this.showTutorialStep(0);
            document.getElementById('helpModal')?.classList.remove('hidden');
        });

        document.getElementById('closeWelcomeBtn')?.addEventListener('click', () => {
            document.getElementById('welcomeModal')?.classList.add('hidden');
        });

        document.getElementById('nextStepBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep + 1);
        });

        document.getElementById('prevStepBtn')?.addEventListener('click', () => {
            this.showTutorialStep(this.currentTutorialStep - 1);
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

    showTutorialStep(index) {
        this.tutorialSteps = Array.from(document.querySelectorAll('.tutorial-step'));
        if (this.tutorialSteps.length === 0) return;

        if (index >= this.tutorialSteps.length) {
            document.getElementById('helpModal')?.classList.add('hidden');
            return;
        }

        if (index < 0) index = 0;

        this.tutorialSteps.forEach((step, i) => {
            step.classList.toggle('active', i === index);
        });
        this.currentTutorialStep = index;

        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');

        if (prevBtn) {
            prevBtn.disabled = index === 0;
        }

        if (nextBtn) {
            if (index === this.tutorialSteps.length - 1) {
                nextBtn.textContent = 'Finish';
            } else {
                nextBtn.textContent = 'Next';
            }
        }
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
                const installCard = document.getElementById('installCard');
                const consoleCard = document.getElementById('consoleCard');
                if (installCard) installCard.classList.add('hidden');
                if (consoleCard) consoleCard.classList.add('hidden');
                if (this.swiper) {
                    this.swiper.destroy(true, true);
                    this.swiper = null;
                }
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
                    const installCard = document.getElementById('installCard');
                    const consoleCard = document.getElementById('consoleCard');
                    if (installCard) installCard.classList.remove('hidden');
                    if (consoleCard) consoleCard.classList.remove('hidden');
                    this.renderAvailableApks();
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

            // Merge server-provided APK info with additional kit metadata
            this.availableApks = apks.map(apk => {
                const kit = KITS.find(k => k.key === apk.name) || {};
                return {
                    ...apk,
                    ...kit,
                    title: kit.title || apk.name,
                    infoUrl: kit.infoUrl || '#',
                    key: kit.key || apk.name
                };
            });
        } catch (error) {
            console.error('Failed to load APKs:', error);
            this.uiManager.log('Failed to load APK files from server', 'warning');
            this.availableApks = [];
        }
    }

    renderAvailableApks() {
        const grid = document.getElementById('kitsGrid');
        if (!grid) return;

        grid.innerHTML = '';


        this.availableApks.forEach((apk) => {

            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `
                <div class="app-item">
                    <div class="app-icon">
                        ${apk.image ? `<img src="${apk.image}" alt="${apk.title}">` : ''}
                    </div>
                    <span>${apk.title}</span>
                    <div class="app-actions">
                        <button class="btn btn-primary install-btn">Install</button>
                        <button class="btn btn-link info-btn">View Info</button>
                    </div>
                </div>
            `;

            slide.querySelector('.install-btn').addEventListener('click', () => this.installKit(apk));
            slide.querySelector('.info-btn').addEventListener('click', () => window.open(apk.infoUrl, '_blank'));

            grid.appendChild(slide);
        });

        if (this.swiper) {
            this.swiper.destroy(true, true);
        }

        const startIndex = this.availableApks.findIndex(a => a.key === 'TripleUMDM' || a.name === 'TripleUMDM');

        this.swiper = new Swiper('#kitsSwiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 'auto',
            initialSlide: startIndex >= 0 ? startIndex : 0,
            coverflowEffect: {
                rotate: 50,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: true,
            }
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
                    name: apk.name,
                    file: null, // Will be loaded when needed
                    url: apk.url,
                    size: 'Remote',
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
                
                // If it's an APK from a remote URL, fetch it
                if (apk.url && !apk.file) {
                    this.uiManager.log(`Downloading ${apk.name}...`, 'info');
                    const response = await fetch(apk.url);
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
                        
                        // Wait a bit for the app to fully register after installation
                        this.uiManager.log('Waiting for app components to register...', 'info');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        for (const command of apk.postInstallCommands) {
                            if (command.trim()) {
                                try {
                                    // Add extra delay for device admin commands
                                    if (command.includes('dpm set-device-owner') || command.includes('device-admin')) {
                                        this.uiManager.log('Device admin command detected - waiting for component registration...', 'info');
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                    }
                                    
                                    this.uiManager.log(`Running: ${command}`, 'info');
                                    const result = await this.adbConnection.executeShellCommand(command);
                                    if (result.trim()) {
                                        this.uiManager.log(`Command output: ${result.trim()}`, 'info');
                                    }
                                    
                                    // Small delay between commands
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    
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

    async installKit(apk) {
        if (!this.device) {
            this.uiManager.showError('Please connect a device first');
            return;
        }

        document.getElementById('progressCard').classList.remove('hidden');
        this.uiManager.updateProgress(0, `Installing ${apk.title || apk.name}...`);
        this.uiManager.log(`Installing ${apk.title || apk.name}...`, 'info');

        try {
            let fileToInstall = apk.file;

            if (apk.url && !apk.file) {
                this.uiManager.log(`Downloading ${apk.title || apk.name}...`, 'info');
                const response = await fetch(apk.url);
                if (!response.ok) {
                    throw new Error(`Failed to load APK file: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                fileToInstall = new File([arrayBuffer], (apk.name || apk.title) + '.apk', { type: 'application/vnd.android.package-archive' });
            }

            if (!fileToInstall) {
                throw new Error('No APK file available for installation');
            }

            await this.apkInstaller.installFromFile(this.device, fileToInstall);

            if (apk.postInstallCommands && apk.postInstallCommands.length > 0) {
                this.uiManager.log(`Executing post-install commands for ${apk.title || apk.name}...`, 'info');
                this.uiManager.log('Waiting for app components to register...', 'info');
                await new Promise(resolve => setTimeout(resolve, 2000));

                for (const command of apk.postInstallCommands) {
                    if (!command.trim()) continue;
                    try {
                        if (command.includes('dpm set-device-owner') || command.includes('device-admin')) {
                            this.uiManager.log('Device admin command detected - waiting for component registration...', 'info');
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }

                        this.uiManager.log(`Running: ${command}`, 'info');
                        const result = await this.adbConnection.executeShellCommand(command);
                        if (result.trim()) {
                            this.uiManager.log(`Command output: ${result.trim()}`, 'info');
                        }

                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (cmdError) {
                        this.uiManager.log(`Command failed: ${command} - ${cmdError.message}`, 'warning');
                    }
                }

                this.uiManager.log(`Post-install setup completed for ${apk.title || apk.name}`, 'success');
            }

            this.uiManager.updateProgress(100, 'Installation complete');
            this.uiManager.log(`Successfully installed ${apk.title || apk.name}`, 'success');
            this.uiManager.showSuccess(`${apk.title || apk.name} installed successfully`);
        } catch (error) {
            this.uiManager.updateProgress(100, 'Installation failed');
            this.uiManager.log(`Failed to install ${apk.title || apk.name}: ${error.message}`, 'error');
            this.uiManager.showError(`Failed to install ${apk.title || apk.name}: ${error.message}`);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async executeCommand() {
        const commandInput = document.getElementById('commandInput');
        const command = commandInput.value.trim();
        
        if (!command) {
            return;
        }

        if (!this.device) {
            this.logToConsole('ERROR: No device connected', 'error');
            return;
        }

        const executeBtn = document.getElementById('executeBtn');
        executeBtn.disabled = true;
        executeBtn.innerHTML = `
            <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            Running...
        `;

        try {
            // Add to command history
            this.commandHistory.push(command);
            this.currentHistoryIndex = this.commandHistory.length;
            
            // Log the command being executed
            this.logToConsole(`$ adb shell ${command}`, 'command');
            
            // Execute the command
            const result = await this.adbConnection.executeShellCommand(command);
            
            // Log the result
            if (result.trim()) {
                this.logToConsole(result, 'output');
            } else {
                this.logToConsole('(no output)', 'info');
            }
            
            // Update history display
            this.updateCommandHistory();
            
        } catch (error) {
            this.logToConsole(`ERROR: ${error.message}`, 'error');
        }

        // Reset button
        executeBtn.disabled = false;
        executeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
            Execute
        `;

        // Clear input
        commandInput.value = '';
    }

    logToConsole(message, type = 'info') {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;
        
        if (type === 'command') {
            entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="command">${message}</span>`;
        } else if (type === 'output') {
            entry.innerHTML = `<pre class="output">${message}</pre>`;
        } else {
            entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="${type}">${message}</span>`;
        }
        
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    showPreviousCommand() {
        if (this.commandHistory.length === 0) return;
        
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
        }
        
        document.getElementById('commandInput').value = this.commandHistory[this.currentHistoryIndex] || '';
    }

    showNextCommand() {
        if (this.commandHistory.length === 0) return;
        
        if (this.currentHistoryIndex < this.commandHistory.length - 1) {
            this.currentHistoryIndex++;
            document.getElementById('commandInput').value = this.commandHistory[this.currentHistoryIndex];
        } else {
            this.currentHistoryIndex = this.commandHistory.length;
            document.getElementById('commandInput').value = '';
        }
    }

    updateCommandHistory() {
        const historyList = document.getElementById('historyList');
        const historySection = document.getElementById('commandHistory');
        
        if (this.commandHistory.length > 0) {
            historySection.classList.remove('hidden');
            
            historyList.innerHTML = this.commandHistory
                .slice(-10) // Show last 10 commands
                .reverse()
                .map((cmd, index) => `
                    <div class="history-item" onclick="document.getElementById('commandInput').value='${cmd.replace(/'/g, "\\'")}'; document.getElementById('commandInput').focus();">
                        <code>${cmd}</code>
                    </div>
                `).join('');
        }
    }

    clearConsole() {
        const consoleOutput = document.getElementById('consoleOutput');
        if (consoleOutput) {
            consoleOutput.innerHTML = '';
        }
    }

    downloadConsoleOutput() {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput || consoleOutput.children.length === 0) {
            this.uiManager.showWarning('No console output to download');
            return;
        }
        
        const content = Array.from(consoleOutput.children)
            .map(entry => entry.textContent)
            .join('\n');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `adb-console-output-${timestamp}.txt`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.uiManager.showSuccess('Console output downloaded');
    }

    async executeRawCommand(command) {
        // Execute command without any quote processing - exactly as written in text file
        if (!this.adbConnection || !this.adbConnection.adb) {
            throw new Error('No device connected');
        }

        try {
            const shell = await this.adbConnection.adb.shell(command);
            const output = await this.adbConnection.receiveAll(shell);
            await shell.close();
            return output;
        } catch (error) {
            throw new Error(`Failed to execute command: ${error.message}`);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new JTechMDMInstaller();
    await app.init();
    // Make UIManager globally accessible for modal buttons
    window.uiManager = app.uiManager;
    document.getElementById('welcomeModal')?.classList.remove('hidden');
});
