// Console filter to suppress browser extension errors
// This file should be loaded FIRST, before any other scripts

(function() {
    'use strict';
    
    // Intercept addEventListener IMMEDIATELY to prevent extensions from adding unload listeners
    // This must run as early as possible, before extensions inject their code
    if (typeof EventTarget !== 'undefined' && EventTarget.prototype && EventTarget.prototype.addEventListener) {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            // Block unload/beforeunload listeners to prevent permissions policy violations
            if (type === 'unload' || type === 'beforeunload') {
                // Check call stack to see if this is from an extension
                try {
                    const stack = new Error().stack || '';
                    // If it's from an extension (VM script, inspector, or chrome-extension), block it
                    if (stack.includes('inspector') || 
                        stack.includes('VM') || 
                        stack.includes('chrome-extension://') ||
                        stack.includes('moz-extension://') ||
                        stack.includes('safari-extension://')) {
                        return; // Silently block extension unload listeners
                    }
                } catch(e) {
                    // If we can't check stack, be conservative and allow it (might be legitimate page code)
                }
            }
            return originalAddEventListener.call(this, type, listener, options);
        };
    }
    
    const shouldSuppress = function(message) {
        if (!message) return false;
        const msg = String(message);
        return msg.includes('csspeeper') || 
               msg.includes('Permissions policy violation') ||
               msg.includes('Ad unit initialization failed') ||
               msg.includes('[Violation]') ||
               msg.includes('inspector.b9415ea5.js') ||
               msg.includes('unload is not allowed') ||
               (msg.includes('VM') && msg.includes('inspector')) ||
               msg.includes('Cannot read properties of undefined') ||
               msg.includes('reading \'payload\'') ||
               msg.includes('addEventListener') && msg.includes('unload');
    };
    
    // Override ALL console methods
    ['error', 'warn', 'log', 'info', 'debug', 'trace'].forEach(method => {
        if (console[method]) {
            const original = console[method];
            console[method] = function(...args) {
                const message = args.join(' ');
                if (shouldSuppress(message)) {
                    return; // Suppress these messages
                }
                original.apply(console, args);
            };
        }
    });
    
    // Suppress PerformanceObserver violations
    if (window.PerformanceObserver) {
        try {
            const OriginalPerformanceObserver = window.PerformanceObserver;
            window.PerformanceObserver = function(callback) {
                return new OriginalPerformanceObserver(function(list, observer) {
                    const entries = list.getEntries();
                    const filtered = entries.filter(entry => {
                        const name = String(entry.name || '');
                        const type = String(entry.entryType || '');
                        return !shouldSuppress(name) && 
                               !shouldSuppress(type) &&
                               !(name.includes('inspector') || name.includes('csspeeper'));
                    });
                    if (filtered.length > 0) {
                        const filteredList = {
                            getEntries: () => filtered,
                            getEntriesByType: (type) => filtered.filter(e => e.entryType === type),
                            getEntriesByName: (name) => filtered.filter(e => e.name === name)
                        };
                        callback(filteredList, observer);
                    }
                });
            };
        } catch(e) {
            // Ignore if PerformanceObserver override fails
        }
    }
    
    // Suppress unhandled promise rejections from extensions
    window.addEventListener('unhandledrejection', function(event) {
        const message = String(event.reason || '');
        if (shouldSuppress(message)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
    
    // Suppress error events from extensions
    window.addEventListener('error', function(event) {
        const message = String(event.message || event.filename || event.target?.src || '');
        if (shouldSuppress(message) || message.includes('inspector') || message.includes('csspeeper')) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return false;
        }
    }, true);
    
    // Intercept and suppress violation reports from Chrome's reporting API
    if (window.ReportingObserver) {
        try {
            const OriginalReportingObserver = window.ReportingObserver;
            window.ReportingObserver = function(callback, options) {
                return new OriginalReportingObserver(function(reports) {
                    const filtered = reports.filter(report => {
                        const body = String(report.body?.message || report.body?.sourceFile || '');
                        const type = String(report.type || '');
                        return !shouldSuppress(body) && 
                               !shouldSuppress(type) &&
                               !body.includes('Permissions policy violation') &&
                               !body.includes('unload is not allowed') &&
                               !body.includes('inspector') &&
                               !body.includes('csspeeper');
                    });
                    if (filtered.length > 0) {
                        callback(filtered);
                    }
                }, options);
            };
        } catch(e) {
            // Ignore if ReportingObserver override fails
        }
    }
    
    // Suppress console messages that Chrome logs directly (try to catch them early)
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // Wrap console methods more aggressively
    console.error = function(...args) {
        const msg = args.join(' ');
        if (shouldSuppress(msg) || msg.includes('Permissions policy') || msg.includes('unload is not allowed')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
        const msg = args.join(' ');
        if (shouldSuppress(msg) || msg.includes('Permissions policy') || msg.includes('unload is not allowed')) {
            return;
        }
        originalConsoleWarn.apply(console, args);
    };
})();

