// Database Manager
class DatabaseManager {
    constructor() {
        this.isLoggedIn = false;
        this.init();
    }
    
    init() {
        // Use event delegation for forms that might not exist yet
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'login-form') {
                e.preventDefault();
                this.handleLogin(e);
            } else if (e.target.id === 'upload-form') {
                e.preventDefault();
                e.stopPropagation();
                this.handleUpload(e);
            }
        });
        
        // Handle upload button click directly
        document.addEventListener('click', (e) => {
            if (e.target.id === 'upload-btn' || e.target.closest('#upload-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.handleUpload(e);
            }
        });
        
        // Legacy direct attachment (for immediate availability)
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e);
            });
        }
        
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleUpload(e);
            });
        }
        
        // Also attach upload button handler directly
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleUpload(e);
            });
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Password toggle functionality
        const passwordToggle = document.getElementById('password-toggle');
        const passwordInput = document.getElementById('password');
        const passwordToggleIcon = document.getElementById('password-toggle-icon');
        
        if (passwordToggle && passwordInput && passwordToggleIcon) {
            passwordToggle.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                passwordToggleIcon.textContent = type === 'password' ? '👁️' : '🙈';
            });
        }
        
        // Check auth status on page load
        this.checkAuthStatus();
        
        // Add keyboard support for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const editModal = document.getElementById('edit-metadata-modal');
                const deleteModal = document.getElementById('delete-confirm-modal');
                if (editModal && editModal.style.display === 'flex') {
                    this.closeEditModal();
                }
                if (deleteModal && deleteModal.style.display === 'flex') {
                    this.closeDeleteModal();
                }
            }
        });
        
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            const editModal = document.getElementById('edit-metadata-modal');
            const deleteModal = document.getElementById('delete-confirm-modal');
            
            if (editModal && e.target === editModal) {
                this.closeEditModal();
            }
            if (deleteModal && e.target === deleteModal) {
                this.closeDeleteModal();
            }
        });
        
        // Add Enter key support for metadata input
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                const editModal = document.getElementById('edit-metadata-modal');
                const deleteModal = document.getElementById('delete-confirm-modal');
                if (editModal && editModal.style.display === 'flex') {
                    this.saveMetadata();
                }
            }
        });
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            notifications.warning('Please enter both username and password');
            return;
        }
        
        showLoading();
        
        try {
            const result = await api.login(username, password);
            hideLoading();
            
            if (result.success) {
                this.isLoggedIn = true;
                // Token is already stored in api.login()
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('upload-section').style.display = 'block';
                notifications.success('Logged in successfully!');
                
                // Clear login form
                document.getElementById('login-form').reset();
                
                // Load file list
                this.loadFileList();
            } else {
                notifications.error(result.error || 'Invalid username or password');
            }
        } catch (error) {
            hideLoading();
            // Check if it's a rate limit error
            if (error.message.includes('429') || error.message.includes('rate limit')) {
                notifications.error('Too many login attempts. Please wait a minute and try again.');
            } else {
                notifications.error('Login error: ' + error.message);
            }
        }
    }
    
    async handleUpload(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        console.log('handleUpload called'); // Debug log
        
        // Clear previous error/success messages immediately when button is clicked
        const resultDiv = document.getElementById('upload-result');
        if (resultDiv) {
            resultDiv.innerHTML = '';
            resultDiv.className = 'upload-result';
        }
        
        const fileInput = document.getElementById('db-file');
        const metadataInput = document.getElementById('metadata');
        const uploadBtn = document.getElementById('upload-btn');
        
        if (!fileInput || !metadataInput) {
            console.error('Form elements not found');
            notifications.error('Form elements not found. Please refresh the page.');
            return;
        }
        
        const metadata = metadataInput.value.trim();
        
        if (!fileInput.files || !fileInput.files.length) {
            notifications.warning('Please select a file');
            return;
        }
        
        // Validate metadata is required
        if (!metadata) {
            notifications.error('File Metadata is required. Please enter a description.');
            metadataInput.focus();
            metadataInput.style.borderColor = 'var(--error, #ff4444)';
            // Remove error styling after user starts typing
            const clearError = () => {
                metadataInput.style.borderColor = '';
                metadataInput.removeEventListener('input', clearError);
            };
            metadataInput.addEventListener('input', clearError);
            return;
        }
        
        const file = fileInput.files[0];
        
        // File validation
        if (!file.name.endsWith('.hmp.txt')) {
            notifications.error('Please upload a .hmp.txt file');
            return;
        }
        
        const maxSize = 1024 * 1024 * 1024; // 1GB
        if (file.size > maxSize) {
            notifications.error('File size exceeds 1GB limit');
            return;
        }
        
        // Disable upload button to prevent multiple clicks
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.6';
            uploadBtn.style.cursor = 'not-allowed';
            const originalText = uploadBtn.innerHTML;
            uploadBtn.innerHTML = '⏳ Uploading...';
            
            // Store original state to restore later
            uploadBtn.dataset.originalText = originalText;
        }
        
        // Show progress
        const progressDiv = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressPercent = document.getElementById('upload-percent');
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressPercent) {
            progressPercent.textContent = '0%';
        }
        
        // Simulate progress (since we can't track actual upload progress with current API)
        let progress = 0;
        let progressInterval = null;
        if (progressBar && progressPercent) {
            progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
                if (progressPercent) {
                    progressPercent.textContent = Math.round(progress) + '%';
                }
            }, 200);
        }
        
        try {
            const result = await api.uploadFile(file, metadata);
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            if (progressPercent) {
                progressPercent.textContent = '100%';
            }
            
            setTimeout(() => {
                if (progressDiv) {
                    progressDiv.style.display = 'none';
                }
            }, 500);
            
            const resultDiv = document.getElementById('upload-result');
            
            if (result.success) {
                resultDiv.className = 'upload-result success';
                resultDiv.innerHTML = `
                    <p><strong>Success!</strong></p>
                    <p>Uploaded ${result.file_name} to the database.</p>
                    <p>It has ${result.biomarkers} biomarkers and ${result.accessions} accessions.</p>
                `;
                notifications.success(`File "${result.file_name}" uploaded successfully! Biomarkers: ${result.biomarkers}, Accessions: ${result.accessions}`);
                
                // Reset form
                document.getElementById('upload-form').reset();
                
                // Refresh file list immediately (like all_database() in biomarker_webapp.py line 971)
                this.loadFileList();
                
                // Refresh home page statistics
                if (window.loadHomePageData) {
                    window.loadHomePageData();
                }
                
                // Reload page after 2 seconds to ensure all data is refreshed (like st.rerun() in Streamlit)
                // This matches the behavior in biomarker_webapp.py where st.rerun() is called after upload
                setTimeout(() => {
                    // Force reload of database page to refresh all cached data
                    // Similar to st.rerun() in biomarker_webapp.py line 863, 958, 985
                    if (window.Router) {
                        // Navigate to database page to force refresh (router will reload data)
                        Router.navigate('database');
                    } else {
                        // Fallback: reload the page
                        window.location.reload();
                    }
                }, 2000);
            } else {
                resultDiv.className = 'upload-result error';
                
                // Check if it's a duplicate file error
                const isDuplicate = result.error && (
                    result.error.toLowerCase().includes('already exists') || 
                    result.error.toLowerCase().includes('duplicate')
                );
                
                if (isDuplicate) {
                    const existingFileName = result.existing_file_name || 'Unknown file';
                    const existingMetadata = result.existing_metadata || 'No metadata';
                    
                    resultDiv.innerHTML = `
                        <p><strong>⚠️ File Already Exists</strong></p>
                        <p>${result.error}</p>
                        <div style="margin-top: 15px; padding: 15px; background: var(--bg-card, rgba(255, 255, 255, 0.05)); border-radius: var(--radius-md, 8px); border-left: 3px solid var(--iita-orange, #f7941d);">
                            <p style="margin: 0 0 10px 0; font-weight: 600; color: var(--text-primary);">Existing File in Database:</p>
                            <p style="margin: 5px 0; color: var(--text-primary);"><strong>File Name:</strong> <span style="color: var(--iita-green, #4CAF50);">${existingFileName}</span></p>
                            <p style="margin: 5px 0; color: var(--text-primary);"><strong>Metadata:</strong> <span style="color: var(--text-secondary, #b0b0b0);">${existingMetadata}</span></p>
                        </div>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 15px;">
                            The content of this file already exists in the database, so it won't be uploaded again.
                        </p>
                    `;
                    notifications.warning(result.error || 'File already exists in database');
                } else {
                    resultDiv.innerHTML = `<p><strong>Error:</strong> ${result.error}</p>`;
                    notifications.error(result.error || 'Upload failed');
                }
            }
        } catch (error) {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            if (progressDiv) {
                progressDiv.style.display = 'none';
            }
            notifications.error('Upload error: ' + error.message);
        } finally {
            // Re-enable upload button after upload completes (success or error)
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.style.opacity = '1';
                uploadBtn.style.cursor = 'pointer';
                if (uploadBtn.dataset.originalText) {
                    uploadBtn.innerHTML = uploadBtn.dataset.originalText;
                } else {
                    uploadBtn.innerHTML = '⬆️ Upload File';
                }
            }
        }
    }
    
    async loadFileList() {
        const container = document.getElementById('file-list-container');
        if (!container) return;
        
        try {
            const result = await api.getAllFiles();
            if (!result.success || !result.data) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px; color: var(--error);">
                        <p>Failed to load files.</p>
                    </div>
                `;
                return;
            }
            
            const files = result.data;
            if (files.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">📁</div>
                        <p style="color: var(--text-secondary);">No files uploaded yet.</p>
                    </div>
                `;
                return;
            }
            
            // Build dashboard table with collapsible header (collapsed by default)
            container.innerHTML = `
                <div class="card" style="margin-top: 30px; overflow: hidden;">
                    <div class="dashboard-header" style="padding: 20px; border-bottom: 1px solid var(--bg-glass-border); cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s;" onclick="databaseManager.toggleDashboard()">
                        <h3 style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                            <span class="dashboard-toggle-icon" style="transition: transform 0.3s;">▶</span>
                            <span>📂</span>
                            <span>Files in Database (${files.length})</span>
                        </h3>
                    </div>
                    <div class="dashboard-content" style="overflow-x: auto; display: none;">
                        <table class="file-dashboard-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--bg-secondary);">
                                    <th style="text-align: left; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">#</th>
                                    <th style="text-align: left; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">File Name</th>
                                    <th style="text-align: left; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">Metadata</th>
                                    <th style="text-align: center; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">Biomarkers</th>
                                    <th style="text-align: center; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">Accessions</th>
                                    <th style="text-align: center; padding: 12px 15px; font-weight: 600; color: var(--text-primary); border-bottom: 2px solid var(--bg-glass-border);">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="file-table-body"></tbody>
                        </table>
                    </div>
                </div>
            `;
            
            const tbody = document.getElementById('file-table-body');
            files.forEach((file, index) => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid var(--bg-glass-border); transition: background 0.2s;';
                tr.onmouseenter = () => tr.style.background = 'var(--bg-secondary)';
                tr.onmouseleave = () => tr.style.background = '';
                
                const shape = file.shape || [0, 0];
                const biomarkers = shape[0] || 0;
                const accessions = (shape[1] || 0) > 11 ? (shape[1] - 11) : 0;
                const metadata = (file.metadata || 'No metadata').replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                const fileName = (file.file_name || 'Unknown').replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                tr.innerHTML = `
                    <td style="padding: 12px 15px; color: var(--text-secondary); font-weight: 500;">${index + 1}</td>
                    <td style="padding: 12px 15px; max-width: 300px; word-break: break-all; color: var(--text-primary); font-weight: 500;">${fileName}</td>
                    <td style="padding: 12px 15px; max-width: 350px; word-break: break-word; font-size: 0.9rem; color: var(--text-secondary);">
                        <span title="${metadata}">${metadata.length > 50 ? metadata.substring(0, 50) + '...' : metadata}</span>
                    </td>
                    <td style="padding: 12px 15px; text-align: center; color: #00bcd4; font-weight: 700; background: rgba(0, 188, 212, 0.1); border-radius: 4px;">${biomarkers.toLocaleString()}</td>
                    <td style="padding: 12px 15px; text-align: center; color: var(--iita-orange); font-weight: 600;">${accessions.toLocaleString()}</td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <button class="btn btn-secondary btn-sm" 
                            onclick="databaseManager.editMetadata('${fileName.replace(/'/g, "\\'")}', \`${metadata.replace(/`/g, '\\`')}\`)"
                            style="padding: 6px 12px; font-size: 0.875rem; margin-right: 8px;">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-danger btn-sm" 
                            onclick="databaseManager.deleteFile('${fileName.replace(/'/g, "\\'")}')"
                            style="padding: 6px 12px; font-size: 0.875rem;">
                            🗑️ Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--error);">
                    <p>Error loading files: ${error.message}</p>
                </div>
            `;
        }
    }
    
    async deleteFile(fileName) {
        this.openDeleteModal(fileName);
    }
    
    toggleDashboard() {
        const content = document.querySelector('.dashboard-content');
        const icon = document.querySelector('.dashboard-toggle-icon');
        if (content && icon) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
                icon.style.transform = 'rotate(0deg)';
            }
        }
    }
    
    openEditModal(fileName, currentMetadata = '') {
        if (!fileName) return;
        
        const modal = document.getElementById('edit-metadata-modal');
        const fileNameInput = document.getElementById('edit-file-name');
        const metadataInput = document.getElementById('edit-metadata-input');
        
        if (modal && fileNameInput && metadataInput) {
            fileNameInput.value = fileName;
            metadataInput.value = currentMetadata || '';
            modal.style.display = 'flex';
            metadataInput.focus();
            // Store current file name for save operation
            modal.dataset.fileName = fileName;
        }
    }
    
    closeEditModal() {
        const modal = document.getElementById('edit-metadata-modal');
        if (modal) {
            modal.style.display = 'none';
            const metadataInput = document.getElementById('edit-metadata-input');
            if (metadataInput) metadataInput.value = '';
            delete modal.dataset.fileName;
        }
    }
    
    async saveMetadata() {
        const modal = document.getElementById('edit-metadata-modal');
        const metadataInput = document.getElementById('edit-metadata-input');
        const saveBtn = document.getElementById('save-metadata-btn');
        
        if (!modal || !metadataInput) return;
        
        const fileName = modal.dataset.fileName;
        const newMetadata = metadataInput.value.trim();
        
        if (!fileName) {
            notifications.error('File name not found');
            return;
        }
        
        if (!newMetadata) {
            notifications.warning('Metadata cannot be empty');
            metadataInput.focus();
            return;
        }
        
        // Disable save button
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '⏳ Saving...';
        }
        
        showLoading();
        try {
            const result = await api.updateMetadata(fileName, newMetadata);
            hideLoading();
            
            if (result.success) {
                notifications.success(result.message || 'Metadata updated successfully');
                this.closeEditModal();
                
                // Refresh list and stats
                this.loadFileList();
                if (window.loadHomePageData) {
                    window.loadHomePageData();
                }
                
                // Reload database page after short delay
                setTimeout(() => {
                    if (window.Router) {
                        Router.navigate('database');
                    } else {
                        window.location.reload();
                    }
                }, 1500);
            } else {
                notifications.error(result.error || 'Failed to update metadata');
            }
        } catch (error) {
            hideLoading();
            notifications.error('Error updating metadata: ' + error.message);
        } finally {
            // Re-enable save button
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾 Save Changes';
            }
        }
    }
    
    openDeleteModal(fileName) {
        if (!fileName) return;
        
        const modal = document.getElementById('delete-confirm-modal');
        const fileNameInput = document.getElementById('delete-file-name');
        const passwordInput = document.getElementById('delete-password-input');
        
        if (modal && fileNameInput && passwordInput) {
            fileNameInput.value = fileName;
            passwordInput.value = '';
            modal.style.display = 'flex';
            passwordInput.focus();
            // Store current file name for delete operation
            modal.dataset.fileName = fileName;
        }
    }
    
    closeDeleteModal() {
        const modal = document.getElementById('delete-confirm-modal');
        if (modal) {
            modal.style.display = 'none';
            const passwordInput = document.getElementById('delete-password-input');
            if (passwordInput) passwordInput.value = '';
            delete modal.dataset.fileName;
        }
    }
    
    async confirmDelete() {
        const modal = document.getElementById('delete-confirm-modal');
        const passwordInput = document.getElementById('delete-password-input');
        const deleteBtn = document.getElementById('confirm-delete-btn');
        
        if (!modal || !passwordInput) return;
        
        const fileName = modal.dataset.fileName;
        const password = passwordInput.value.trim();
        
        if (!fileName) {
            notifications.error('File name not found');
            return;
        }
        
        if (!password) {
            notifications.warning('Password is required to delete file');
            passwordInput.focus();
            return;
        }
        
        // Disable delete button
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '⏳ Deleting...';
        }
        
        showLoading();
        try {
            const result = await api.deleteFile(fileName, password);
            hideLoading();
            
            if (result.success) {
                notifications.success(result.message || `File "${fileName}" deleted successfully`);
                this.closeDeleteModal();
                
                // Refresh list and stats
                this.loadFileList();
                if (window.loadHomePageData) {
                    window.loadHomePageData();
                }
                
                // Reload database page after short delay
                setTimeout(() => {
                    if (window.Router) {
                        Router.navigate('database');
                    } else {
                        window.location.reload();
                    }
                }, 1500);
            } else {
                notifications.error(result.error || 'Delete failed');
                // Clear password on error
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            hideLoading();
            notifications.error('Delete error: ' + error.message);
            // Clear password on error
            passwordInput.value = '';
            passwordInput.focus();
        } finally {
            // Re-enable delete button
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '🗑️ Delete File';
            }
        }
    }
    
    async editMetadata(fileName, currentMetadata = '') {
        this.openEditModal(fileName, currentMetadata);
    }
    
    async handleLogout() {
        try {
            await api.logout();
            this.isLoggedIn = false;
            // Token is already cleared in api.logout()
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('upload-section').style.display = 'none';
            document.getElementById('upload-result').innerHTML = '';
            document.getElementById('upload-form').reset();
            notifications.success('Logged out successfully');
        } catch (error) {
            // Even if logout fails, clear local state
            this.isLoggedIn = false;
            localStorage.removeItem('authToken');
            localStorage.removeItem('tokenExpiresIn');
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('upload-section').style.display = 'none';
            notifications.success('Logged out');
        }
    }
    
    async checkAuthStatus() {
        // Check if user is still authenticated when page loads
        const token = localStorage.getItem('authToken');
        const loginSection = document.getElementById('login-section');
        const uploadSection = document.getElementById('upload-section');
        
        if (token) {
            try {
                const result = await api.verifyToken();
                if (result.success && result.authenticated) {
                    this.isLoggedIn = true;
                    if (loginSection) loginSection.style.display = 'none';
                    if (uploadSection) uploadSection.style.display = 'block';
                    this.loadFileList();
                } else {
                    // Token invalid, clear it
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('tokenExpiresIn');
                    this.isLoggedIn = false;
                    if (loginSection) loginSection.style.display = 'block';
                    if (uploadSection) uploadSection.style.display = 'none';
                }
            } catch (error) {
                // Token invalid, clear it
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiresIn');
                this.isLoggedIn = false;
                if (loginSection) loginSection.style.display = 'block';
                if (uploadSection) uploadSection.style.display = 'none';
            }
        } else {
            // No token, show login form
            this.isLoggedIn = false;
            if (loginSection) loginSection.style.display = 'block';
            if (uploadSection) uploadSection.style.display = 'none';
        }
    }
}

// Initialize database manager
const databaseManager = new DatabaseManager();

// Make databaseManager available globally for router
window.databaseManager = databaseManager;

