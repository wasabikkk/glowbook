// js/api.js
// ---------- CONFIG ----------

// Automatically detect environment and set API base URL
// For local development: uses localhost
// For production (GitHub Pages): uses your Hostinger domain
function getApiBase() {
    // Check if running on GitHub Pages
    if (window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('github.com')) {
        // Production backend URL
        return 'https://glowbook.ccs4thyear.com/api';
    }
    
    // Check if running on localhost or 127.0.0.1 (development)
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000/api';
    }
    
    // Default: assume same domain as frontend (if frontend and backend are on same domain)
    return window.location.origin + '/api';
}

const API_BASE = getApiBase();

// Get base URL for storage (avatars, service images, etc.)
function getStorageBase() {
    // Check if running on GitHub Pages
    if (window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('github.com')) {
        // Production backend URL
        return 'https://glowbook.ccs4thyear.com';
    }
    
    // Check if running on localhost or 127.0.0.1 (development)
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    
    // Default: assume same domain as frontend
    return window.location.origin;
}

const STORAGE_BASE = getStorageBase();

// ---- Token helpers (localStorage) ----
function fbGetToken() {
    return localStorage.getItem('token') || '';
}

function fbSetToken(token) {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

// ---- Auth header ----
function fbAuthHeaders() {
    const t = fbGetToken();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
}

// ---- Generic jQuery AJAX wrapper for JSON ----
function fbApiJson(method, path, data) {
    return $.ajax({
        url: API_BASE + path,
        method: method,
        data: data ? JSON.stringify(data) : null,
        dataType: 'json',
        contentType: 'application/json',
        headers: fbAuthHeaders()
    }).fail(function(xhr) {
        // Handle invalid/unauthorized/tampered tokens
        if (xhr.status === 401 || xhr.status === 419) {
            const response = xhr.responseJSON;
            if (response && (
                response.message === 'Invalid or unauthorized token.' ||
                response.message === 'Unauthenticated.' ||
                response.message?.toLowerCase().includes('token') ||
                response.message?.toLowerCase().includes('unauthorized') ||
                response.message?.toLowerCase().includes('tampered') ||
                response.message?.toLowerCase().includes('expired')
            )) {
                // Token is invalid/tampered/expired - backend has already deleted it
                // Clear token from localStorage immediately
                fbSetToken('');
                
                // Redirect to login if not already on login/register page
                if (window.location.pathname !== '/login.html' && 
                    window.location.pathname !== '/register.html' &&
                    !window.location.pathname.includes('login.html') &&
                    !window.location.pathname.includes('register.html')) {
                    alert('Your session has expired or the token is invalid. Please login again.');
                    window.location.href = 'login.html';
                }
            }
        }
    });
}

// ---- Auth specific helpers ----

// Register
function fbRegister(payload) {
    // payload: { username, first_name, last_name, email, password, password_confirmation }
    return fbApiJson('POST', '/register', payload);
}

// Login (now username-based)
function fbLogin(payload) {
    // payload: { username, password }
    return fbApiJson('POST', '/login', payload);
}

// Logout
function fbLogout() {
    return fbApiJson('POST', '/logout', {}).always(function () {
        fbSetToken('');
    });
}

// Get current logged-in user profile
function fbFetchProfile() {
    return fbApiJson('GET', '/profile');
}

// Update profile
function fbUpdateProfile(data) {
    return fbApiJson('PUT', '/profile', data);
}

// Change password
function fbChangePassword(data) {
    return fbApiJson('POST', '/profile/change-password', data);
}

// Email verification
function fbVerifyEmailCode(code) {
    return fbApiJson('POST', '/verify-email-code', { code });
}

function fbResendVerificationCode() {
    return fbApiJson('POST', '/resend-verification-code', {});
}

// Password reset
function fbForgotPassword(email) {
    return fbApiJson('POST', '/forgot-password', { email });
}

function fbResetPassword(data) {
    return fbApiJson('POST', '/reset-password', data);
}

// Admin - Users
function fbAdminGetUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fbApiJson('GET', '/admin/users' + (query ? '?' + query : ''));
}

function fbAdminCreateUser(data) {
    return fbApiJson('POST', '/admin/users', data);
}

function fbAdminUpdateUser(id, data) {
    return fbApiJson('PUT', '/admin/users/' + id, data);
}

function fbAdminDeleteUser(id) {
    return fbApiJson('DELETE', '/admin/users/' + id, {});
}

// Admin - Services
function fbAdminGetServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fbApiJson('GET', '/admin/services' + (query ? '?' + query : ''));
}

function fbAdminCreateService(data) {
    const formData = new FormData();
    
    // Append all fields to FormData
    Object.keys(data).forEach(key => {
        if (key === 'image' && data[key] instanceof File) {
            // Append image file
            formData.append(key, data[key]);
        } else if (key !== 'image') {
            // Append all other fields (strings, numbers, booleans)
            formData.append(key, data[key]);
        }
    });
    
    return $.ajax({
        url: API_BASE + '/admin/services',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: fbAuthHeaders()
    }).fail(function(xhr) {
        // Log error for debugging
        console.error('Create service error:', xhr.responseJSON || xhr);
    });
}

function fbAdminUpdateService(id, data) {
    if (!id) {
        console.error('Service ID is required for update');
        return $.Deferred().reject({ 
            status: 400, 
            responseJSON: { message: 'Service ID is required' } 
        });
    }
    
    // Ensure API_BASE is defined
    const apiBase = typeof API_BASE !== 'undefined' ? API_BASE : 'http://127.0.0.1:8000/api';
    const url = apiBase + '/admin/services/' + id;
    
    console.log('Updating service - URL:', url, 'ID:', id);
    console.log('Data to send:', data);
    
    const formData = new FormData();
    
    // Add _method=PUT for Laravel to recognize as PUT request when using FormData
    formData.append('_method', 'PUT');
    
    // Append all fields to FormData
    Object.keys(data).forEach(key => {
        if (key === 'image' && data[key] instanceof File) {
            // Append image file
            formData.append(key, data[key]);
            console.log('Appended image file:', data[key].name);
        } else if (key !== 'image') {
            // Append all other fields (convert to string for FormData)
            const value = data[key];
            // Convert boolean to string 'true' or 'false' for Laravel to parse
            if (typeof value === 'boolean') {
                formData.append(key, value ? 'true' : 'false');
            } else {
                formData.append(key, value !== null && value !== undefined ? String(value) : '');
            }
            console.log('Appended field:', key, '=', value, '(as:', typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value), ')');
        }
    });
    
    // Log FormData contents (for debugging)
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + (pair[1] instanceof File ? pair[1].name : pair[1]));
    }
    
    // Use POST method with _method=PUT for FormData compatibility
    return $.ajax({
        url: url,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: fbAuthHeaders()
    }).fail(function(xhr, status, error) {
        console.error('Update service AJAX error:', {
            url: url,
            status: status,
            error: error,
            response: xhr.responseText,
            statusCode: xhr.status
        });
    });
}

function fbAdminDeleteService(id) {
    return fbApiJson('DELETE', '/admin/services/' + id, {});
}

// Public Services
function fbGetServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fbApiJson('GET', '/services' + (query ? '?' + query : ''));
}

// Bookings
function fbGetBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fbApiJson('GET', '/bookings' + (query ? '?' + query : ''));
}

function fbCreateBooking(data) {
    return fbApiJson('POST', '/bookings', data);
}

function fbCancelBooking(id) {
    return fbApiJson('POST', '/bookings/' + id + '/cancel', {});
}

function fbUpdateBookingStatus(id, status) {
    return fbApiJson('PUT', '/bookings/' + id + '/status', { status });
}

// Get aestheticians
function fbGetAestheticians() {
    return fbApiJson('GET', '/aestheticians');
}

// Simple guard for pages that need login
function fbRequireAuth(redirectToLogin = 'login.html') {
    if (!fbGetToken()) {
        window.location.href = redirectToLogin;
    }
}

// Redirect based on role
function fbRedirectByRole(user) {
    if (!user || !user.role) {
        window.location.href = 'login.html';
        return;
    }
    
    switch(user.role) {
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        case 'aesthetician':
            window.location.href = 'aesthetician-dashboard.html';
            break;
        case 'client':
            window.location.href = 'client-dashboard.html';
            break;
        default:
            window.location.href = 'login.html';
    }
}

// ---- Loading Indicator Helpers ----
function showLoading(message = 'Loading...') {
    // Remove any existing loading overlay
    $('.loading-overlay').remove();
    
    // Create loading overlay
    const overlay = $('<div class="loading-overlay"></div>');
    const content = $('<div class="loading-content"></div>');
    const spinner = $('<div class="loading-spinner-large"></div>');
    const text = $('<p>' + message + '</p>');
    
    content.append(spinner).append(text);
    overlay.append(content);
    $('body').append(overlay);
}

function hideLoading() {
    $('.loading-overlay').fadeOut(200, function() {
        $(this).remove();
    });
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        $(button).addClass('loading').prop('disabled', true);
    } else {
        $(button).removeClass('loading').prop('disabled', false);
    }
}

// Export helpers to global namespace
window.fbGetToken = fbGetToken;
window.fbSetToken = fbSetToken;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.setButtonLoading = setButtonLoading;
window.fbRegister = fbRegister;
window.fbLogin = fbLogin;
window.fbLogout = fbLogout;
window.fbFetchProfile = fbFetchProfile;
window.fbUpdateProfile = fbUpdateProfile;
window.fbChangePassword = fbChangePassword;
window.fbVerifyEmailCode = fbVerifyEmailCode;
window.fbResendVerificationCode = fbResendVerificationCode;
window.fbForgotPassword = fbForgotPassword;
window.fbResetPassword = fbResetPassword;
window.fbAdminGetUsers = fbAdminGetUsers;
window.fbAdminCreateUser = fbAdminCreateUser;
window.fbAdminUpdateUser = fbAdminUpdateUser;
window.fbAdminDeleteUser = fbAdminDeleteUser;
window.fbAdminGetServices = fbAdminGetServices;
window.fbAdminCreateService = fbAdminCreateService;
window.fbAdminUpdateService = fbAdminUpdateService;
window.fbAdminDeleteService = fbAdminDeleteService;
window.fbGetServices = fbGetServices;
window.fbGetBookings = fbGetBookings;
window.fbCreateBooking = fbCreateBooking;
window.fbCancelBooking = fbCancelBooking;
window.fbUpdateBookingStatus = fbUpdateBookingStatus;
window.fbGetAestheticians = fbGetAestheticians;
window.fbRequireAuth = fbRequireAuth;
window.fbRedirectByRole = fbRedirectByRole;
window.API_BASE = API_BASE;
window.STORAGE_BASE = STORAGE_BASE;
