export class UIManager {
    constructor() {
        this.logOutput = document.getElementById('logOutput');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.installationLogs = [];
        this.setupLogControls();
    }

    updateConnectionStatus(status, deviceInfo = null) {
        const statusIcon = document.querySelector('.status-icon');
        const statusTitle = document.getElementById('statusTitle');
        const statusMessage = document.getElementById('statusMessage');
        const deviceInfoDiv = document.getElementById('deviceInfo');
        const connectBtn = document.getElementById('connectBtn');

        if (status === 'connected' && deviceInfo) {
            statusIcon.classList.remove('disconnected');
            statusIcon.classList.add('connected');
            statusTitle.textContent = 'Device Connected';
            statusMessage.textContent = 'Ready to install MDM applications';
            
            // Update device info
            document.getElementById('deviceModel').textContent = deviceInfo.model || 'Unknown';
            document.getElementById('androidVersion').textContent = deviceInfo.androidVersion || 'Unknown';
            document.getElementById('deviceSerial').textContent = deviceInfo.serial || 'Unknown';
            deviceInfoDiv.classList.remove('hidden');

            // Update button
            connectBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                    <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
                Disconnect
            `;
        } else {
            statusIcon.classList.remove('connected');
            statusIcon.classList.add('disconnected');
            statusTitle.textContent = 'No Device Connected';
            statusMessage.textContent = 'Connect your Android device via USB to begin';
            deviceInfoDiv.classList.add('hidden');

            // Update button
            connectBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                </svg>
                Connect Device
            `;
        }
    }

    updateProgress(percent, message) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = message;
        }
        if (this.progressPercent) {
            this.progressPercent.textContent = `${Math.round(percent)}%`;
        }
    }

    log(message, type = 'info') {
        if (!this.logOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const fullTimestamp = new Date().toISOString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        let prefix = '';
        switch (type) {
            case 'success':
                prefix = '✓';
                break;
            case 'error':
                prefix = '✗';
                break;
            case 'warning':
                prefix = '⚠';
                break;
            default:
                prefix = '›';
        }

        const logText = `[${timestamp}] ${prefix} ${message}`;
        entry.textContent = logText;
        this.logOutput.appendChild(entry);
        
        // Store in persistent log
        this.installationLogs.push({
            timestamp: fullTimestamp,
            message: message,
            type: type,
            formatted: logText
        });
        
        // Auto-scroll to bottom
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }

    setupLogControls() {
        // Add log controls to the progress card
        const progressCard = document.getElementById('progressCard');
        if (progressCard) {
            // Add buttons to progress card header
            const logControls = document.createElement('div');
            logControls.className = 'log-controls';
            logControls.innerHTML = `
                <button class="btn btn-small" id="viewLogsBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                    </svg>
                    View Logs
                </button>
                <button class="btn btn-small" id="downloadLogsBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7,10 12,15 17,10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                </button>
                <button class="btn btn-small" id="clearLogsBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Clear
                </button>
            `;
            
            // Insert after the h2 in progress card
            const h2 = progressCard.querySelector('h2');
            h2.parentNode.insertBefore(logControls, h2.nextSibling);
            
            // Add event listeners
            document.getElementById('viewLogsBtn')?.addEventListener('click', () => this.showLogModal());
            document.getElementById('downloadLogsBtn')?.addEventListener('click', () => this.downloadLogs());
            document.getElementById('clearLogsBtn')?.addEventListener('click', () => this.clearLog());
        }
    }

    clearLog() {
        if (this.logOutput) {
            this.logOutput.innerHTML = '';
        }
        this.installationLogs = [];
    }

    showLogModal() {
        // Create modal for viewing logs
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content log-modal">
                <div class="modal-header">
                    <h2>Installation Logs</h2>
                    <button class="modal-close" id="closeLogModal">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="log-viewer">
                    ${this.installationLogs.map(log => 
                        `<div class="log-entry ${log.type}">${log.formatted}</div>`
                    ).join('')}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">Close</button>
                    <button class="btn btn-primary" onclick="window.uiManager.downloadLogs();">Download Logs</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on outside click or close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'closeLogModal') {
                modal.remove();
            }
        });
    }

    downloadLogs() {
        if (this.installationLogs.length === 0) {
            this.showWarning('No logs to download');
            return;
        }
        
        const logContent = this.installationLogs
            .map(log => log.formatted)
            .join('\n');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `jtechmdm-install-logs-${timestamp}.txt`;
        
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccess('Logs downloaded successfully');
    }

    showError(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, var(--danger-gradient-start), var(--danger-gradient-end));
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            z-index: 1001;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
            border: 1px solid var(--border-color);
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);

        // Also log the error
        this.log(message, 'error');
    }

    showSuccess(message) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, var(--success-gradient-start), var(--success-gradient-end));
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            z-index: 1001;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
            border: 1px solid var(--border-color);
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);

        // Also log the success
        this.log(message, 'success');
    }

    showWarning(message) {
        // Create warning notification
        const notification = document.createElement('div');
        notification.className = 'warning-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, var(--warning-gradient-start), var(--warning-gradient-end));
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            z-index: 1001;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
            border: 1px solid var(--border-color);
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);

        // Also log the warning
        this.log(message, 'warning');
    }

    toggleLoadingState(element, loading = true) {
        if (loading) {
            element.disabled = true;
            element.dataset.originalText = element.textContent;
            element.innerHTML = `
                <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Loading...
            `;
            
            // Add spinner animation
            const style = document.createElement('style');
            style.textContent = `
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        } else {
            element.disabled = false;
            element.textContent = element.dataset.originalText || element.textContent;
        }
    }
}
