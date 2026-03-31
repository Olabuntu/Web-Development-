// Modern Popup Notification System

class NotificationManager {
    constructor() {
        this.container = this.createContainer();
        this.currentNotification = null; // Track current notification to replace it
    }

    createContainer() {
        let container = document.getElementById('notification-popup-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-popup-container';
            container.className = 'notification-popup-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 4000) {
        // Remove previous notification immediately (no animation) if exists
        if (this.currentNotification) {
            this.removeImmediate(this.currentNotification);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification-popup notification-popup-${type} show`;
        
        // Icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <div class="notification-popup-content">
                <div class="notification-popup-icon">${icons[type] || icons.info}</div>
                <div class="notification-popup-message">${message}</div>
                <button class="notification-popup-close" onclick="notifications.remove(this.closest('.notification-popup'))">×</button>
            </div>
        `;
        
        // Add to container - show immediately (no animation for seamless replacement)
        this.container.appendChild(notification);
        this.currentNotification = notification;
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                if (this.currentNotification === notification) {
                    this.remove(notification);
                }
            }, duration);
        }
        
        return notification;
    }
    
    removeImmediate(notification) {
        // Remove immediately without animation for seamless replacement
        if (notification && notification.parentElement) {
            notification.remove();
        }
        if (this.currentNotification === notification) {
            this.currentNotification = null;
        }
    }

    remove(notification, clearCurrent = true) {
        if (!notification || !notification.parentElement) return;
        
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
            if (clearCurrent && this.currentNotification === notification) {
                this.currentNotification = null;
            }
        }, 300);
    }

    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
}

// Global instance
const notifications = new NotificationManager();

// Backward compatibility
function showNotification(message, type = 'info') {
    notifications.show(message, type);
}

