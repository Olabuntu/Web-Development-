// Main Application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize router
    Router.init();
    
    // Initialize search manager
    searchManager = new SearchManager();
    
    // Setup navigation
    setupNavigation();
    
    // Load initial data
    loadHomePageData();
    
    // Setup mobile menu toggle
    setupMobileMenu();

    // Setup scroll-to-top button
    setupScrollToTop();
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            Router.navigate(page);
        });
    });
}

async function loadHomePageData() {
    try {
        const result = await api.getAccessionCount();
        if (result.success) {
            const count = result.count || 0;
            
            // Update home page stat card
            const countElement = document.getElementById('accession-count');
            if (countElement) {
                animateCounter(countElement, count);
            }
            
            // Update header stat
            const headerCount = document.getElementById('header-accessions');
            if (headerCount) {
                animateCounter(headerCount, count);
            }
        }
        
        // Load file statistics (file count and biomarker count)
        try {
            const statsResult = await api.getFileStatistics();
            if (statsResult.success && statsResult.data) {
                // Update file count
                const fileCountElement = document.getElementById('file-count');
                if (fileCountElement) {
                    animateCounter(fileCountElement, statsResult.data.total_files || 0);
                }
                
                // Update biomarker count
                const biomarkerCountElement = document.getElementById('biomarker-count');
                if (biomarkerCountElement) {
                    animateCounter(biomarkerCountElement, statsResult.data.total_biomarkers || 0);
                }
            }
        } catch (e) {
            // Fallback to getAllFiles for file count only
            try {
                const filesResult = await api.getAllFiles();
                if (filesResult.success && filesResult.data) {
                    const fileCountElement = document.getElementById('file-count');
                    if (fileCountElement) {
                        animateCounter(fileCountElement, filesResult.data.length);
                    }
                }
            } catch (err) {
                console.error('Error loading file statistics:', err);
            }
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Animated counter function
function animateCounter(element, target) {
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    const duration = 1500; // 1.5 seconds
    const increment = (target - current) / (duration / 16); // 60fps
    let currentValue = current;
    
    const timer = setInterval(() => {
        currentValue += increment;
        if ((increment > 0 && currentValue >= target) || (increment < 0 && currentValue <= target)) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(currentValue);
        }
    }, 16);
}

function setupMobileMenu() {
    // Use existing mobile menu toggle
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('mobile-menu-toggle');
        
        if (window.innerWidth <= 576 && sidebar && toggleBtn) {
            if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// Make loadHomePageData available globally
window.loadHomePageData = loadHomePageData;

function setupScrollToTop() {
    const btn = document.getElementById('scroll-to-top');
    if (!btn) return;

    // Hide initially
    btn.classList.remove('visible');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

