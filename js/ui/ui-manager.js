export class UIManager {
    constructor() {
        this.consoleOutput = document.getElementById('consoleOutput');
    }

    updateConnectionStatus(status, deviceInfo = null) {
        const statusIcon = document.querySelector('.status-icon');
        const statusTitle = document.getElementById('statusTitle');
        const statusMessage = document.getElementById('statusMessage');
        const modelEl = document.getElementById('modelValue');
        const androidEl = document.getElementById('androidVersionValue');
        const rootedEl = document.getElementById('rootedValue');
        const accountsEl = document.getElementById('accountsValue');
        const connectBtn = document.getElementById('connectBtn');
        const inlineTutorial = document.getElementById('connectTutorial');
        const setVal = (el, text) => {
            if (!el) return;
            const value = text ? String(text) : '';
            el.textContent = value;
            el.title = value;
            el.classList.toggle('empty', !value);
        };

        if (status === 'connected' && deviceInfo) {
            statusIcon.classList.remove('disconnected');
            statusIcon.classList.add('connected');
            statusTitle.textContent = 'Device Connected';
            if (statusMessage) statusMessage.textContent = 'Ready to install MDM applications';

            setVal(modelEl, deviceInfo.model || '');
            setVal(androidEl, deviceInfo.androidVersion || '');
            setVal(rootedEl, deviceInfo.rooted ? 'Yes' : 'No');
            setVal(accountsEl, deviceInfo.accountsFound ? 'Found' : 'None');
            // keep tutorial visible\n            // if (inlineTutorial) inlineTutorial.classList.add('hidden');

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
            if (statusMessage) statusMessage.textContent = 'Connect your Android device via USB to begin';
            setVal(modelEl, '');
            setVal(androidEl, '');
            setVal(rootedEl, '');
            setVal(accountsEl, '');
            if (inlineTutorial) inlineTutorial.classList.remove('hidden');

            connectBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                </svg>
                Connect
            `;
        }
    }

    updateProgress(percent, message) {
        this.logToConsole(`${message} (${Math.round(percent)}%)`, 'info');
    }

    logToConsole(message, type = 'info') {
        if (!this.consoleOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;

        if (type === 'command') {
            entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="command">${message}</span>`;
        } else if (type === 'output') {
            entry.innerHTML = `<pre class="output">${message}</pre>`;
        } else {
            entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        }

        this.consoleOutput.appendChild(entry);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    showError(message) {
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

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);

        this.logToConsole(message, 'error');
    }

    showSuccess(message) {
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

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);

        this.logToConsole(message, 'success');
    }

    showWarning(message) {
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

        const remove = () => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        };

        const timer = setTimeout(remove, 5000);

        this.logToConsole(message, 'warning');
        return () => {
            clearTimeout(timer);
            remove();
        };
    }
}

