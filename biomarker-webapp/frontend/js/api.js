// API Client
class APIClient {
    constructor(baseURL = null) {
        // Get port from window location or use default
        const port = window.location.port || '8000';
        this.baseURL = baseURL || `${window.location.protocol}//${window.location.hostname}:${port}/api`;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const sessionId = getSessionId();
        const token = localStorage.getItem('authToken');  // Get JWT token
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId,
                ...(token && { 'Authorization': `Bearer ${token}` }),  // Add JWT token if available
                ...options.headers
            },
            ...options
        };
        
        // Handle FormData (for file uploads)
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        } else if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            // Handle token expiration
            if (response.status === 401 && data.error && data.error.includes('token')) {
                // Token expired or invalid, clear it
                localStorage.removeItem('authToken');
                // Redirect to login if on database page
                if (window.location.hash.includes('database')) {
                    notifications.warning('Session expired. Please log in again.');
                    // Show login form
                    const loginSection = document.getElementById('login-section');
                    const uploadSection = document.getElementById('upload-section');
                    if (loginSection && uploadSection) {
                        loginSection.style.display = 'block';
                        uploadSection.style.display = 'none';
                    }
                }
            }
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    // Authentication methods
    async login(username, password) {
        const result = await this.request('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        
        // Store token if login successful
        if (result.success && result.token) {
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('tokenExpiresIn', result.expires_in || 86400);
        }
        
        return result;
    }
    
    async logout() {
        const result = await this.request('/auth/logout', {
            method: 'POST'
        });
        
        // Clear token on logout
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiresIn');
        
        return result;
    }
    
    async verifyToken() {
        return this.request('/auth/verify', {
            method: 'GET'
        });
    }
    
    async refreshToken() {
        return this.request('/auth/refresh', {
            method: 'POST'
        });
    }
    
    // File methods
    async getAllFiles() {
        return this.request('/files/all', {
            method: 'GET'
        });
    }
    
    async uploadFile(file, metadata) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', metadata);
        
        return this.request('/files/upload', {
            method: 'POST',
            body: formData
        });
    }
    
    async cleanupFiles() {
        return this.request('/files/cleanup', {
            method: 'POST'
        });
    }
    
    async deleteFile(fileName, password) {
        return this.request('/files/delete', {
            method: 'DELETE',
            body: { file_name: fileName, password }
        });
    }
    
    async updateMetadata(fileName, metadata) {
        return this.request('/files/metadata', {
            method: 'PUT',
            body: { file_name: fileName, metadata }
        });
    }
    
    // Search methods
    async checkAccessions(accessions) {
        return this.request('/search/check', {
            method: 'POST',
            body: { accessions }
        });
    }
    
    async findCommonBiomarkers(fileNames) {
        return this.request('/search/biomarkers', {
            method: 'POST',
            body: { file_names: fileNames }
        });
    }
    
    async prepareDownload(format) {
        return this.request('/search/prepare-download', {
            method: 'POST',
            body: { format }
        });
    }
    
    async downloadFile(format, option = 'combined', index = null) {
        let url = `${this.baseURL}/search/download/${format}?option=${option}`;
        if (index !== null) {
            url += `&index=${index}`;
        }
        
        const sessionId = getSessionId();
        const response = await fetch(url, {
            headers: {
                'X-Session-ID': sessionId
            }
        });
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1] || `download.${format}`;
        
        downloadFile(downloadUrl, filename);
        window.URL.revokeObjectURL(downloadUrl);
    }
    
    // Converter methods
    async convertFile(file, conversionType) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', conversionType);
        
        return this.request('/convert', {
            method: 'POST',
            body: formData
        });
    }
    
    async listConvertedFiles() {
        return this.request('/convert/list', {
            method: 'GET'
        });
    }
    
    async downloadConvertedFile(filename) {
        const url = `${this.baseURL}/convert/download/${filename}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        downloadFile(downloadUrl, filename);
        window.URL.revokeObjectURL(downloadUrl);
    }
    
    // Statistics methods
    async getAccessionCount() {
        return this.request('/statistics/accessions', {
            method: 'GET'
        });
    }
    
    async getFileStatistics() {
        return this.request('/statistics/files', {
            method: 'GET'
        });
    }
}

// Export singleton instance
const api = new APIClient();

