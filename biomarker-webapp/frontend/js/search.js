// Search Manager
class SearchManager {
    constructor() {
        this.stage = 0;
        this.accessions = [];
        this.foundFiles = [];
        this.commonBiomarkers = [];
        this.fileInfo = null;
        this.downloadFormat = null;
        this.init();
    }
    
    init() {
        // Input type toggle
        document.querySelectorAll('input[name="input-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const type = e.target.value;
                document.getElementById('text-input').style.display = type === 'text' ? 'block' : 'none';
                document.getElementById('file-input').style.display = type === 'file' ? 'block' : 'none';
            });
        });
        
        // Check Files button
        document.getElementById('check-files-btn').addEventListener('click', () => this.handleCheckFiles());
        
        // Clear search button
        document.getElementById('clear-search-btn')?.addEventListener('click', () => {
            document.getElementById('accession-input').value = '';
            document.getElementById('accession-file').value = '';
            document.getElementById('accession-input').focus();
        });
        
        // Keyboard shortcuts
        document.getElementById('accession-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                e.preventDefault();
                this.handleCheckFiles();
            }
        });
        
        // Check Biomarkers button
        document.getElementById('check-biomarkers-btn').addEventListener('click', () => this.handleFindBiomarkers());
        
        // Download button
        document.getElementById('download-btn').addEventListener('click', () => this.handlePrepareDownload());
        
        // Proceed Download button
        document.getElementById('proceed-download-btn').addEventListener('click', () => this.handleProceedDownload());
        
        // Back buttons
        document.getElementById('back-btn-1')?.addEventListener('click', () => this.goToPreviousStage());
        document.getElementById('back-btn-2')?.addEventListener('click', () => this.goToPreviousStage());
        document.getElementById('back-btn-3')?.addEventListener('click', () => this.goToPreviousStage());
        document.getElementById('back-btn-4')?.addEventListener('click', () => this.goToPreviousStage());
        
        // Home buttons
        document.getElementById('home-btn-1')?.addEventListener('click', () => {
            Router.navigate('home');
        });
        document.getElementById('home-btn-2')?.addEventListener('click', () => {
            Router.navigate('home');
        });
        
        // ESC key to go back
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.stage > 0) {
                this.goToPreviousStage();
            }
        });
    }
    
    async handleCheckFiles() {
        const inputType = document.querySelector('input[name="input-type"]:checked').value;
        let accessions = [];
        
        if (inputType === 'text') {
            const input = document.getElementById('accession-input').value.trim();
            if (!input) {
                notifications.error('Please enter accession numbers');
                return;
            }
            accessions = input.split(/\s+/).filter(a => a);
        } else {
            const fileInput = document.getElementById('accession-file');
            if (!fileInput.files.length) {
                notifications.error('Please upload a file');
                return;
            }
            try {
                const content = await readFileAsText(fileInput.files[0]);
                accessions = content.split(/\s+/).filter(a => a);
            } catch (error) {
                notifications.error('Error reading file');
                return;
            }
        }
        
        if (accessions.length === 0) {
            notifications.error('No valid accession numbers found');
            return;
        }
        
        this.accessions = [...new Set(accessions)];
        showLoading();
        
        try {
            const result = await api.checkAccessions(this.accessions);
            hideLoading();
            
            if (result.success) {
                this.foundFiles = result.data.found_files;
                this.showStage1(result.data);
            } else {
                notifications.error(result.error || 'Error checking files');
            }
        } catch (error) {
            hideLoading();
            notifications.error('Error checking files: ' + error.message);
        }
    }
    
    showStage1(data) {
        this.stage = 1;
        document.getElementById('stage-0').classList.remove('active');
        document.getElementById('stage-1').classList.add('active');
        this.updateProgressIndicator(1);
        
        document.getElementById('accession-count-info').textContent = 
            `You entered ${data.total_entered} unique accession numbers. Found in ${data.found_files.length} file(s).`;
        
        const resultsContainer = document.getElementById('file-results');
        const checkBiomarkersBtn = document.getElementById('check-biomarkers-btn');
        const actionButtonsContainer = checkBiomarkersBtn?.parentElement;
        
        resultsContainer.innerHTML = '';
        
        if (data.found_files.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
                    <p style="color: var(--text-secondary); font-size: 1.1rem; padding: 20px;">No matching accession numbers found.</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">Please check your input and try again.</p>
                </div>
            `;
            // Hide the "Check for Common Biomarkers" button when no matches found
            if (checkBiomarkersBtn) {
                checkBiomarkersBtn.style.display = 'none';
            }
            return;
        }
        
        // Show the button when files are found
        if (checkBiomarkersBtn) {
            checkBiomarkersBtn.style.display = 'inline-flex';
        }
        
        data.found_files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-result-item';
            item.innerHTML = `
                <h4>Found ${file.matches.length}/${data.total_entered} accession numbers in ${file.file_name}</h4>
                <p><strong>Metadata:</strong> ${file.metadata || 'N/A'}</p>
            `;
            resultsContainer.appendChild(item);
        });
    }
    
    async handleFindBiomarkers() {
        showLoading();
        
        try {
            const result = await api.findCommonBiomarkers(this.foundFiles.map(f => f.file_name));
            hideLoading();
            
            if (result.success) {
                this.commonBiomarkers = result.data.common_rs;
                this.fileInfo = result.data.file_info;
                this.showStage2(result.data);
            } else {
                notifications.warning(result.error || 'No common biomarkers found');
            }
        } catch (error) {
            hideLoading();
            notifications.error('Error finding biomarkers: ' + error.message);
        }
    }
    
    showStage2(data) {
        this.stage = 2;
        document.getElementById('stage-1').classList.remove('active');
        document.getElementById('stage-2').classList.add('active');
        this.updateProgressIndicator(2);
        
        const resultsContainer = document.getElementById('biomarker-results');
        resultsContainer.innerHTML = `
            <div class="card">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
                    <h3 style="color: var(--success);">Found ${data.count} common biomarkers</h3>
                    <p style="color: var(--text-secondary); margin-top: 10px;">The files have been prepared for download.</p>
                </div>
            </div>
        `;
    }
    
    handlePrepareDownload() {
        this.stage = 3;
        document.getElementById('stage-2').classList.remove('active');
        document.getElementById('stage-3').classList.add('active');
        this.updateProgressIndicator(3);
    }
    
    async handleProceedDownload() {
        const format = document.getElementById('format-select').value;
        this.downloadFormat = format;
        
        showLoading();
        
        try {
            const result = await api.prepareDownload(format);
            hideLoading();
            
            if (result.success) {
                this.stage = 4;
                document.getElementById('stage-3').classList.remove('active');
                document.getElementById('stage-4').classList.add('active');
                this.updateProgressIndicator(4);
                this.showDownloadOptions();
            } else {
                notifications.error(result.error || 'Error preparing download');
            }
        } catch (error) {
            hideLoading();
            notifications.error('Error preparing download: ' + error.message);
        }
    }
    
    showDownloadOptions() {
        const container = document.getElementById('download-options');
        container.innerHTML = `
            <div class="download-option">
                <label>
                    <input type="radio" name="download-option" value="combined" checked>
                    All in one file
                </label>
                <label>
                    <input type="radio" name="download-option" value="separate">
                    Separate files
                </label>
            </div>
            <div id="download-buttons"></div>
        `;
        
        document.querySelectorAll('input[name="download-option"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateDownloadButtons());
        });
        
        this.updateDownloadButtons();
    }
    
    updateDownloadButtons() {
        const option = document.querySelector('input[name="download-option"]:checked').value;
        const container = document.getElementById('download-buttons');
        container.innerHTML = '';
        
        if (option === 'combined') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = `Download ${this.downloadFormat.toUpperCase()} File`;
            btn.onclick = () => this.downloadFile('combined');
            container.appendChild(btn);
        } else {
            const count = this.fileInfo?.count || 0;
            for (let i = 0; i < count; i++) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = `Download ${this.downloadFormat.toUpperCase()} File ${i + 1}`;
                btn.onclick = () => this.downloadFile('separate', i);
                btn.style.display = 'block';
                btn.style.margin = '10px 0';
                container.appendChild(btn);
            }
        }
    }
    
    async downloadFile(option, index = null) {
        try {
            await api.downloadFile(this.downloadFormat, option, index);
            notifications.success('File downloaded successfully');
        } catch (error) {
            notifications.error('Error downloading file: ' + error.message);
        }
    }
    
    reset() {
        this.stage = 0;
        this.accessions = [];
        this.foundFiles = [];
        this.commonBiomarkers = [];
        this.fileInfo = null;
        this.downloadFormat = null;
        
        document.querySelectorAll('.stage').forEach(stage => {
            stage.classList.remove('active');
        });
        document.getElementById('stage-0').classList.add('active');
        
        document.getElementById('accession-input').value = '';
        document.getElementById('accession-file').value = '';
        
        // Reset button visibility
        const checkBiomarkersBtn = document.getElementById('check-biomarkers-btn');
        if (checkBiomarkersBtn) {
            checkBiomarkersBtn.style.display = 'inline-flex';
        }
        
        // Clear results containers
        const fileResults = document.getElementById('file-results');
        if (fileResults) fileResults.innerHTML = '';
        
        const biomarkerResults = document.getElementById('biomarker-results');
        if (biomarkerResults) biomarkerResults.innerHTML = '';
        
        const downloadOptions = document.getElementById('download-options');
        if (downloadOptions) downloadOptions.innerHTML = '';
        
        // Reset accession count info
        const countInfo = document.getElementById('accession-count-info');
        if (countInfo) countInfo.textContent = '';
        
        // Update progress indicator
        this.updateProgressIndicator(0);
    }
    
    updateProgressIndicator(stage) {
        const indicator = document.getElementById('search-progress');
        if (indicator) {
            const stages = ['Input', 'Results', 'Biomarkers', 'Format', 'Download'];
            indicator.textContent = `Step ${stage + 1} of ${stages.length}: ${stages[stage]}`;
        }
    }
    
    goToPreviousStage() {
        if (this.stage > 0) {
            this.stage--;
            document.querySelectorAll('.stage').forEach(stage => {
                stage.classList.remove('active');
            });
            document.getElementById(`stage-${this.stage}`).classList.add('active');
            this.updateProgressIndicator(this.stage);
        }
    }
}

// Initialize search manager
let searchManager;

