// File Converter Manager
class ConverterManager {
    constructor() {
        this.conversionInfo = null; // Store conversion info for result page
        this.init();
    }
    
    init() {
        const form = document.getElementById('converter-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleConvert(e));
        }
        
        // Conversion result page buttons
        const backToConverterBtn = document.getElementById('back-to-converter-btn');
        if (backToConverterBtn) {
            backToConverterBtn.addEventListener('click', () => {
                Router.navigate('converter');
            });
        }
        
        const homeFromResultBtn = document.getElementById('home-from-result-btn');
        if (homeFromResultBtn) {
            homeFromResultBtn.addEventListener('click', () => {
                Router.navigate('home');
            });
        }
        
        // File upload area click
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('converter-file');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--iita-orange)';
                uploadArea.style.background = 'rgba(247, 148, 29, 0.1)';
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = 'var(--bg-glass-border)';
                uploadArea.style.background = 'transparent';
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--bg-glass-border)';
                uploadArea.style.background = 'transparent';
                
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    this.updateFileInfo(e.dataTransfer.files[0]);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.updateFileInfo(e.target.files[0]);
                }
            });
        }
    }
    
    updateFileInfo(file) {
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const fileInfo = document.getElementById('file-info');
        const fileUploadContent = document.getElementById('file-upload-content');
        
        if (fileName && fileSize && fileInfo && fileUploadContent) {
            fileName.textContent = file.name;
            fileSize.textContent = this.formatFileSize(file.size);
            fileUploadContent.style.display = 'none';
            fileInfo.style.display = 'block';
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    async handleConvert(e) {
        e.preventDefault();
        
        const conversionType = document.getElementById('conversion-type').value;
        const fileInput = document.getElementById('converter-file');
        
        if (!conversionType) {
            notifications.warning('Please select a conversion type');
            return;
        }
        
        if (!fileInput.files.length) {
            notifications.warning('Please select a file');
            return;
        }
        
        const file = fileInput.files[0];
        
        // Validate file extension
        const allowedExtensions = {
            'Hapmap haplod to Hapmap diploid': ['.hmp.txt', '.txt'],
            'Hapmap to VCF': ['.hmp.txt', '.txt'],
            'Hapmap to Dosage': ['.hmp.txt', '.txt'],
            'VCF to Dosage': ['.vcf'],
            'VCF to Hapmap': ['.vcf']
        };
        
        const extensions = allowedExtensions[conversionType] || [];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!extensions.includes(fileExt)) {
                notifications.error('Invalid file type for selected conversion');
            return;
        }
        
        showLoading();
        
        try {
            const result = await api.convertFile(file, conversionType);
            hideLoading();
            
            if (result.success) {
                // Store conversion info for the result page
                this.conversionInfo = {
                    originalFileName: file.name,
                    conversionType: conversionType,
                    result: result
                };
                
                // Redirect to conversion result page
                Router.navigate('conversion-result');
            } else {
                // Show error on converter page (don't redirect)
                notifications.error(result.error || 'Conversion failed');
            }
        } catch (error) {
            hideLoading();
            // Show error on converter page (don't redirect)
            notifications.error('Conversion error: ' + error.message);
        }
    }
    
    async loadConversionResultPage() {
        const container = document.getElementById('conversion-files-container');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = `
            <div class="loading-skeleton">
                <div class="loading-spinner"></div>
                <p>Loading converted files...</p>
            </div>
        `;
        
        try {
            const filesResult = await api.listConvertedFiles();
            
            if (filesResult.success && filesResult.files.length > 0) {
                // Filter files: For "Hapmap to Dosage" conversion, hide intermediate VCF files
                let displayFiles = filesResult.files;
                
                // Filter files: For "Hapmap to Dosage" conversion, hide intermediate VCF files
                // Check if this is a Hapmap to Dosage conversion by:
                // 1. Checking stored conversionInfo
                // 2. Or detecting pattern: both .raw and .vcf files present (indicates Hapmap->VCF->Dosage)
                const hasRawFiles = filesResult.files.some(f => f.name.toLowerCase().endsWith('.raw'));
                const hasVcfFiles = filesResult.files.some(f => f.name.toLowerCase().endsWith('.vcf'));
                const isHapmapToDosage = (this.conversionInfo && this.conversionInfo.conversionType === 'Hapmap to Dosage') ||
                                         (hasRawFiles && hasVcfFiles);
                
                if (isHapmapToDosage) {
                    // Only show .raw files (final Dosage output), hide .vcf files (intermediate step)
                    displayFiles = filesResult.files.filter(file => {
                        const fileName = file.name.toLowerCase();
                        // Hide VCF files for Hapmap to Dosage conversion
                        return !fileName.endsWith('.vcf');
                    });
                }
                
                if (displayFiles.length > 0) {
                    container.innerHTML = '';
                    
                    // Create a card for each converted file
                    displayFiles.forEach((file, index) => {
                        const fileCard = document.createElement('div');
                        fileCard.className = 'conversion-file-card modern-card';
                        fileCard.style.marginBottom = '20px';
                        fileCard.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
                                <div style="flex: 1; min-width: 200px;">
                                    <h4 style="margin: 0 0 10px 0; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 1.5rem;">📄</span>
                                        <span>${file.name}</span>
                                    </h4>
                                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
                                        ${this.conversionInfo ? `Converted from: ${this.conversionInfo.originalFileName}` : 'Converted file'}
                                    </p>
                                </div>
                                <div>
                                    <button class="btn btn-primary" onclick="converterManager.downloadFile('${file.name}')" style="min-width: 180px;">
                                        ⬇️ Download File
                                    </button>
                                </div>
                            </div>
                        `;
                        container.appendChild(fileCard);
                    });
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">⚠️</div>
                            <h3>No converted files found</h3>
                            <p>The conversion may have completed, but no output files were found. Please try converting again.</p>
                        </div>
                    `;
                }
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>No converted files found</h3>
                        <p>The conversion may have completed, but no files were found. Please try converting again.</p>
                    </div>
                `;
            }
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error loading converted files</h3>
                    <p>${error.message || 'Could not retrieve converted files from the server.'}</p>
                    <button class="btn btn-primary" onclick="converterManager.loadConversionResultPage()" style="margin-top: 20px;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }
    
    async downloadFile(filename) {
        showLoading();
        try {
            await api.downloadConvertedFile(filename);
            hideLoading();
            notifications.success('File downloaded successfully');
        } catch (error) {
            hideLoading();
            notifications.error('Error downloading file: ' + error.message);
        }
    }
    
    reset() {
        const form = document.getElementById('converter-form');
        if (form) form.reset();
        
        const result = document.getElementById('converter-result');
        if (result) result.innerHTML = '';
        
        // Reset file upload area
        const fileInfo = document.getElementById('file-info');
        const fileUploadContent = document.getElementById('file-upload-content');
        if (fileInfo && fileUploadContent) {
            fileInfo.style.display = 'none';
            fileUploadContent.style.display = 'block';
        }
        
        const fileInput = document.getElementById('converter-file');
        if (fileInput) fileInput.value = '';
        
        // Don't clear conversionInfo here - it's needed for the result page
        // Only clear it when actually leaving the converter/conversion-result pages
        
        // Reset file upload area styling
        const uploadArea = document.getElementById('file-upload-area');
        if (uploadArea) {
            uploadArea.style.borderColor = 'var(--bg-glass-border)';
            uploadArea.style.background = 'transparent';
        }
        
        // Clear conversion info
        this.conversionInfo = null;
    }
}

// Initialize converter manager
const converterManager = new ConverterManager();

