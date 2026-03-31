// Router
class Router {
    static init() {
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            const page = window.location.hash.slice(1) || 'home';
            this.loadPage(page);
        });
        
        // Load initial page
        const page = window.location.hash.slice(1) || 'home';
        this.loadPage(page);
    }
    
    static navigate(page) {
        window.location.hash = page;
        this.loadPage(page);
    }
    
    static loadPage(page) {
        // Clear ALL notifications immediately when navigating (clear entire container)
        if (typeof notifications !== 'undefined') {
            const container = document.getElementById('notification-popup-container');
            if (container) {
                container.innerHTML = '';
            }
            notifications.currentNotification = null;
        }
        
        // Get current active page BEFORE hiding it (to reset the page we're leaving)
        const currentActivePage = document.querySelector('.page.active');
        const currentPageName = currentActivePage ? currentActivePage.id.replace('-page', '') : null;
        
        // Cleanup files based on original biomarker_webapp.py behavior:
        // 1. Clean up when ENTERING search page (stage 0) - like line 394 in original
        // 2. Clean up when ENTERING converter page (stage 0) - like line 704 in original  
        // 3. Clean up when LEAVING converter/conversion-result pages (except when navigating between them)
        
        // Always clean up when entering search or converter pages (fresh start, like original)
        if (page === 'search' || page === 'converter') {
            api.cleanupFiles().catch(err => {
                console.error('Cleanup error:', err);
            });
        }
        
        // Also clean up when leaving converter/conversion-result pages (except when navigating between them)
        if (currentPageName && currentPageName !== page) {
            const isLeavingConverter = (currentPageName === 'converter' || currentPageName === 'conversion-result');
            const isGoingToConverter = (page === 'converter' || page === 'conversion-result');
            
            if (isLeavingConverter && !isGoingToConverter) {
                // Cleanup all temporary files (uploads, output, hapmap, Vcf, Dosage)
                api.cleanupFiles().catch(err => {
                    console.error('Cleanup error:', err);
                });
            }
            
            // Reset the page we're leaving
            this.resetSpecificPage(currentPageName);
        }
        
        // Instant page switch - no animations to prevent blinking
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            // Hide all pages instantly (no transitions)
            document.querySelectorAll('.page').forEach(p => {
                p.classList.remove('active');
            });
            
            // Show target page instantly
            targetPage.classList.add('active');
            
            // Update active nav link
            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.classList.remove('active');
                if (link.dataset.page === page) {
                    link.classList.add('active');
                }
            });
            
            // Reset the page we're navigating to
            this.resetSpecificPage(page);
            
            // Close mobile menu if open
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
    
    static resetSpecificPage(pageName) {
        // Reset Search Page
        // Note: Files are cleared by backend when starting a new search (see routes/search.py line 29)
        if (pageName === 'search' && typeof searchManager !== 'undefined') {
            searchManager.reset();
        }
        
        // Reset Converter Page
        if (pageName === 'converter' && typeof converterManager !== 'undefined') {
            converterManager.reset();
        }
        
        // Load Conversion Result Page
        if (pageName === 'conversion-result' && typeof converterManager !== 'undefined') {
            converterManager.loadConversionResultPage();
        }
        
        // Note: File cleanup is now handled in loadPage() to ensure it runs for all navigation
        // This ensures files are cleaned up when leaving converter/conversion-result pages
        
        // Reset Database Page
        if (pageName === 'database') {
            const uploadResult = document.getElementById('upload-result');
            if (uploadResult) uploadResult.innerHTML = '';
            
            const dbManager = window.databaseManager || (typeof databaseManager !== 'undefined' ? databaseManager : null);
            
            // Check authentication status when navigating to database page
            if (dbManager && typeof dbManager.checkAuthStatus === 'function') {
                // Check if there's a valid token and restore login state
                dbManager.checkAuthStatus().then(() => {
                    // After checking auth, clear file list only if not logged in
                    const fileListContainer = document.getElementById('file-list-container');
                    if (fileListContainer && !dbManager.isLoggedIn) {
                        fileListContainer.innerHTML = '';
                    }
                });
            } else {
                // Fallback: Clear file list if not logged in
                const fileListContainer = document.getElementById('file-list-container');
                if (fileListContainer && (!dbManager || !dbManager.isLoggedIn)) {
                    fileListContainer.innerHTML = '';
                }
            }
            
            // Re-initialize form handlers when database page loads
            if (dbManager && typeof dbManager.init === 'function') {
                // Re-attach form handlers
                setTimeout(() => {
                    const uploadForm = document.getElementById('upload-form');
                    if (uploadForm) {
                        // Remove old listeners and add new ones
                        const newForm = uploadForm.cloneNode(true);
                        uploadForm.parentNode.replaceChild(newForm, uploadForm);
                        dbManager.init();
                    }
                }, 100);
            }
        } else {
            // If leaving database page, ALWAYS log out and reset all state
            const dbManager = window.databaseManager || (typeof databaseManager !== 'undefined' ? databaseManager : null);
            if (dbManager && dbManager.isLoggedIn) {
                // Log out when leaving database page
                dbManager.isLoggedIn = false;
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiresIn');
                
                // Reset UI to login state
                const loginSection = document.getElementById('login-section');
                const uploadSection = document.getElementById('upload-section');
                if (loginSection && uploadSection) {
                    loginSection.style.display = 'block';
                    uploadSection.style.display = 'none';
                }
                
                // Clear forms and results
                const loginForm = document.getElementById('login-form');
                const uploadForm = document.getElementById('upload-form');
                const uploadResult = document.getElementById('upload-result');
                const fileListContainer = document.getElementById('file-list-container');
                
                if (loginForm) loginForm.reset();
                if (uploadForm) uploadForm.reset();
                if (uploadResult) uploadResult.innerHTML = '';
                if (fileListContainer) fileListContainer.innerHTML = '';
            }
        }
        
        // Reset Home Page - refresh stats
        if (pageName === 'home' && typeof loadHomePageData === 'function') {
            loadHomePageData();
        }
    }
}

