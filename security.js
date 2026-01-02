/**
 * Security Module for Doomsday Forums
 * Protects against XSS, CSRF, Session Hijacking, and other attacks
 */

class SecurityManager {
    constructor() {
        this.sessionToken = this.generateSessionToken();
        this.csrfToken = this.generateCSRFToken();
        this.rateLimiter = new Map();
        this.failedAttempts = new Map();
        this.init();
    }

    init() {
        // Initialize security measures
        this.setupCSRFProtection();
        this.setupRateLimiting();
        this.setupSessionSecurity();
        this.setupXSSProtection();
        this.setupInputValidation();
        this.setupSecurityHeaders();
        this.setupEventListeners();
        
        console.log('🔒 Security Manager initialized');
    }

    // Generate secure random token
    generateToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Generate session token
    generateSessionToken() {
        const token = this.generateToken(64);
        sessionStorage.setItem('sessionToken', token);
        return token;
    }

    // Generate CSRF token
    generateCSRFToken() {
        const token = this.generateToken(32);
        localStorage.setItem('csrfToken', token);
        return token;
    }

    // Setup CSRF protection
    setupCSRFProtection() {
        // Add CSRF token to all forms
        document.addEventListener('DOMContentLoaded', () => {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrf_token';
                csrfInput.value = this.csrfToken;
                form.appendChild(csrfInput);
            });
        });
    }

    // Setup rate limiting
    setupRateLimiting() {
        // Rate limit for API calls
        this.rateLimit = {
            maxRequests: 10,
            windowMs: 60000, // 1 minute
            blockDuration: 300000 // 5 minutes
        };
    }

    // Check rate limit
    checkRateLimit(identifier = 'default') {
        const now = Date.now();
        const windowStart = now - this.rateLimit.windowMs;
        
        if (!this.rateLimiter.has(identifier)) {
            this.rateLimiter.set(identifier, []);
        }
        
        const requests = this.rateLimiter.get(identifier);
        
        // Remove old requests
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        // Check if rate limit exceeded
        if (validRequests.length >= this.rateLimit.maxRequests) {
            this.blockUser(identifier);
            return false;
        }
        
        // Add current request
        validRequests.push(now);
        this.rateLimiter.set(identifier, validRequests);
        
        return true;
    }

    // Block user for rate limit violation
    blockUser(identifier) {
        const blockedUntil = Date.now() + this.rateLimit.blockDuration;
        this.failedAttempts.set(identifier, blockedUntil);
        
        console.warn(`🚫 Rate limit exceeded for ${identifier}. Blocked until ${new Date(blockedUntil)}`);
        
        // Show user-friendly message
        this.showSecurityMessage('Trop de tentatives. Veuillez réessayer plus tard.', 'error');
    }

    // Check if user is blocked
    isUserBlocked(identifier = 'default') {
        const blockedUntil = this.failedAttempts.get(identifier);
        if (blockedUntil && Date.now() < blockedUntil) {
            return true;
        }
        
        // Remove expired block
        if (blockedUntil && Date.now() >= blockedUntil) {
            this.failedAttempts.delete(identifier);
        }
        
        return false;
    }

    // Setup session security
    setupSessionSecurity() {
        // Check session validity
        setInterval(() => {
            const storedToken = sessionStorage.getItem('sessionToken');
            if (storedToken !== this.sessionToken) {
                console.warn('🚨 Session hijacking detected!');
                this.handleSecurityBreach();
            }
        }, 10000); // Check every 10 seconds instead of 5

        // Auto-logout disabled - remove inactivity timer
        console.log('🔒 Auto-logout disabled - session remains active');
    }

    // Setup XSS protection
    setupXSSProtection() {
        // Override dangerous functions
        const originalEval = window.eval;
        window.eval = function(code) {
            console.warn('🚨 eval() usage detected:', code);
            throw new Error('eval() is disabled for security reasons');
        };

        // Monitor DOM changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkElementForXSS(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Check element for XSS
    checkElementForXSS(element) {
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /data:text\/html/i
        ];

        const checkNode = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Check attributes
                Array.from(node.attributes).forEach(attr => {
                    dangerousPatterns.forEach(pattern => {
                        if (pattern.test(attr.value)) {
                            console.warn('🚨 XSS attempt detected:', attr.name, attr.value);
                            node.remove();
                        }
                    });
                });

                // Check inline scripts
                if (node.tagName === 'SCRIPT') {
                    if (node.textContent) {
                        dangerousPatterns.forEach(pattern => {
                            if (pattern.test(node.textContent)) {
                                console.warn('🚨 XSS script detected:', node.textContent);
                                node.remove();
                            }
                        });
                    }
                }
            }
        };

        checkNode(element);
    }

    // Setup input validation
    setupInputValidation() {
        // Add input validation to all forms
        document.addEventListener('DOMContentLoaded', () => {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                form.addEventListener('submit', (e) => {
                    if (!this.validateForm(form)) {
                        e.preventDefault();
                    }
                });
            });

            // Add real-time input validation
            const inputs = document.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    this.validateInput(input);
                });
            });
        });
    }

    // Validate form
    validateForm(form) {
        const inputs = form.querySelectorAll('input, textarea');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // Validate input
    validateInput(input) {
        const value = input.value;
        const type = input.type || input.tagName.toLowerCase();

        // XSS patterns
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe[^>]*>/gi,
            /<object[^>]*>/gi,
            /<embed[^>]*>/gi
        ];

        // Check for XSS
        xssPatterns.forEach(pattern => {
            if (pattern.test(value)) {
                console.warn('🚨 XSS detected in input:', input.name, value);
                input.value = this.sanitizeInput(value);
                this.showSecurityMessage('Caractères dangereux détectés et supprimés', 'warning');
            }
        });

        // SQL injection patterns
        const sqlPatterns = [
            /union.*select/gi,
            /insert.*into/gi,
            /delete.*from/gi,
            /drop.*table/gi,
            /exec.*\(/gi
        ];

        sqlPatterns.forEach(pattern => {
            if (pattern.test(value)) {
                console.warn('🚨 SQL injection detected:', input.name, value);
                input.value = this.sanitizeInput(value);
                this.showSecurityMessage('Caractères dangereux détectés et supprimés', 'warning');
            }
        });

        return true;
    }

    // Sanitize input
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;

        return input
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/[<>"'&]/g, '')
            .replace(/union.*select/gi, '')
            .replace(/insert.*into/gi, '')
            .replace(/delete.*from/gi, '')
            .replace(/drop.*table/gi, '')
            .trim();
    }

    // Setup security headers (client-side simulation)
    setupSecurityHeaders() {
        // Note: Real headers should be set server-side
        console.log('🔒 Security headers configured (server-side implementation required)');
    }

    // Setup event listeners
    setupEventListeners() {
        // Monitor console access
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error
        };

        console.log = function(...args) {
            originalConsole.log(...args);
            // Log to server for monitoring
            SecurityManager.prototype.logToServer('LOG', args);
        };

        console.warn = function(...args) {
            originalConsole.warn(...args);
            SecurityManager.prototype.logToServer('WARN', args);
        };

        console.error = function(...args) {
            originalConsole.error(...args);
            SecurityManager.prototype.logToServer('ERROR', args);
        };

        // Monitor network requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            
            // Check for suspicious requests
            if (typeof url === 'string') {
                if (url.includes('eval(') || url.includes('base64') || url.includes('union')) {
                    console.warn('🚨 Suspicious request detected:', url);
                    return Promise.reject(new Error('Request blocked for security reasons'));
                }
            }
            
            return originalFetch.apply(this, args);
        };
    }

    // Log to server (simulation)
    logToServer(level, data) {
        // In production, this would send logs to a secure server
        if (level === 'ERROR' || level === 'WARN') {
            console.log(`📝 Security log: ${level}`, data);
        }
    }

    // Show security message
    showSecurityMessage(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `security-notification security-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#dc143c' : type === 'warning' ? '#ff6600' : '#0066cc'};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Handle security breach
    handleSecurityBreach() {
        console.error('🚨 SECURITY BREACH DETECTED!');
        
        // Clear sensitive data
        sessionStorage.clear();
        localStorage.clear();
        
        // Redirect to safe page
        window.location.href = '/security-breach.html';
    }

    // Logout user
    logout() {
        // Clear session
        sessionStorage.clear();
        localStorage.clear();
        
        // Redirect to login
        window.location.href = 'index.html';
    }

    // Check admin role
    verifyAdminRole() {
        const userRole = localStorage.getItem('userRole');
        const adminToken = localStorage.getItem('adminToken');
        
        // In production, verify with server
        return userRole === 'admin' && adminToken;
    }

    // Protect admin page
    protectAdminPage() {
        if (!this.verifyAdminRole()) {
            console.warn('🚨 Unauthorized access attempt to admin page');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    // Generate secure password hash (simulation)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Verify password
    async verifyPassword(password, hash) {
        const passwordHash = await this.hashPassword(password);
        return passwordHash === hash;
    }
}

// Rate Limiter Class
class RateLimiter {
    constructor(maxRequests = 10, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }

    isAllowed(identifier) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!this.requests.has(identifier)) {
            this.requests.set(identifier, []);
        }
        
        const requests = this.requests.get(identifier);
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        if (validRequests.length >= this.maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        this.requests.set(identifier, validRequests);
        
        return true;
    }
}

// Initialize Security Manager
const securityManager = new SecurityManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecurityManager, RateLimiter, securityManager };
}
