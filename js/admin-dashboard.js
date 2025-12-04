let currentUser = null;

$(function() {
    fbRequireAuth();
    
    fbFetchProfile()
        .done(function(res) {
            currentUser = res.user;
            if (currentUser.role !== 'admin') {
                window.location.href = 'login.html';
                return;
            }
            displayUserName(currentUser);
            loadUsers();
            loadServices();
            loadBookings();
            
            // Get the current tab from URL hash or localStorage, default to 'services'
            let currentTab = 'services';
            if (window.location.hash) {
                // Check URL hash (e.g., #users, #bookings, #services)
                const hash = window.location.hash.substring(1);
                if (['services', 'bookings', 'users'].includes(hash)) {
                    currentTab = hash;
                }
            } else {
                // Check localStorage for last active tab
                const savedTab = localStorage.getItem('adminDashboardTab');
                if (savedTab && ['services', 'bookings', 'users'].includes(savedTab)) {
                    currentTab = savedTab;
                }
            }
            
            showTab(currentTab);
        })
        .fail(function() {
            window.location.href = 'login.html';
        });
});

function showTab(tab) {
    $('.tab-content').removeClass('active');
    $('.tab-btn').removeClass('active');
    $('#' + tab + '-tab').addClass('active');
    $('.tab-btn').filter(function() { return $(this).text().toLowerCase().includes(tab); }).addClass('active');
    
    // Save current tab to localStorage and update URL hash
    localStorage.setItem('adminDashboardTab', tab);
    window.location.hash = tab;
}

function handleLogout() {
    fbLogout().always(function() {
        window.location.href = 'login.html';
    });
}

function displayUserName(user) {
    if (!user) return;
    
    let displayName = '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    
    if (user.role === 'aesthetician') {
        // Aesthetician: Add "Dr." prefix
        displayName = `Dr. ${firstName} ${lastName}`;
    } else if (user.role === 'admin') {
        // Admin: Add "(admin)" suffix
        displayName = `${firstName} ${lastName} (admin)`;
    } else {
        // Client: Just first name and last name
        displayName = `${firstName} ${lastName}`;
    }
    
    $('#user-name-display').text(displayName);
}

// Users
function loadUsers() {
    const search = $('#user-search').val();
    const role = $('#user-role-filter').val();
    
    fbAdminGetUsers({ search, role })
        .done(function(res) {
            const users = res.items || [];
            let html = '<table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
            
            users.forEach(user => {
                html += `<tr>
                    <td>${user.id}</td>
                    <td>${user.first_name} ${user.last_name}</td>
                    <td>${user.email}</td>
                    <td>${user.role}${user.is_super_admin ? ' (Super Admin)' : ''}</td>
                    <td>
                        <button onclick="editUser(${user.id})">Edit</button>
                        ${!user.is_super_admin && user.id !== currentUser.id ? `<button onclick="deleteUser(${user.id})">Delete</button>` : ''}
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            $('#users-list').html(html);
        });
}

function showUserModal(userId = null) {
    $('#user-modal-title').text(userId ? 'Edit User' : 'Add User');
    $('#user-form')[0].reset();
    $('#user-id').val('');
    
    // Set email field as read-only when editing, editable when adding
    if (userId) {
        // Editing: make email read-only
        $('#user-email').prop('readonly', true);
        
        // Prevent focus when clicking on read-only email field
        $('#user-email').off('focus').on('focus', function(e) {
            e.preventDefault();
            $(this).blur();
            return false;
        });
        
        // Prevent focus on mousedown
        $('#user-email').off('mousedown').on('mousedown', function(e) {
            e.preventDefault();
            return false;
        });
        
        fbAdminGetUsers().done(function(res) {
            const user = res.items.find(u => u.id === userId);
            if (user) {
                $('#user-id').val(user.id);
                $('#user-name').val(user.name);
                $('#user-first-name').val(user.first_name);
                $('#user-last-name').val(user.last_name);
                $('#user-email').val(user.email);
                $('#user-role').val(user.role);
            }
        });
    } else {
        // Adding: make email editable
        $('#user-email').prop('readonly', false);
        // Remove focus prevention handlers when adding
        $('#user-email').off('focus mousedown');
    }
    
    $('#user-modal').show();
}

function closeUserModal() {
    $('#user-modal').hide();
}

function saveUser(e) {
    e.preventDefault();
    const id = $('#user-id').val();
    const data = {
        name: $('#user-name').val(),
        first_name: $('#user-first-name').val(),
        last_name: $('#user-last-name').val(),
        email: $('#user-email').val(),
        role: $('#user-role').val()
    };
    
    if ($('#user-password').val()) {
        data.password = $('#user-password').val();
    }
    
    const promise = id ? fbAdminUpdateUser(id, data) : fbAdminCreateUser(data);
    
    promise.done(function() {
        closeUserModal();
        loadUsers();
    }).fail(function(xhr) {
        alert('Error: ' + (xhr.responseJSON?.message || 'Failed to save user'));
    });
}

function editUser(id) {
    showUserModal(id);
}

function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    fbAdminDeleteUser(id)
        .done(function() {
            loadUsers();
        })
        .fail(function(xhr) {
            alert('Error: ' + (xhr.responseJSON?.message || 'Failed to delete user'));
        });
}

// Services
function loadServices() {
    const search = $('#service-search').val();
    const status = $('#service-status-filter').val();
    
    fbAdminGetServices({ search, status })
        .done(function(res) {
            const services = res.items || [];
            let html = '<table><thead><tr><th>ID</th><th>Name</th><th>Image</th><th>Price</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
            services.forEach(service => {
                const storageBase = typeof STORAGE_BASE !== 'undefined' ? STORAGE_BASE : 'http://127.0.0.1:8000';
                const imageUrl = service.image_url || storageBase + '/storage/services/default_service.png';
                html += `<tr>
                    <td>${service.id}</td>
                    <td>${service.name}</td>
                    <td>
                        <div class="service-image-container">
                            <img src="${imageUrl}" alt="${service.name}" onerror="this.src='${storageBase}/storage/services/default_service.png'">
                        </div>
                    </td>
                    <td>₱${service.price}</td>
                    <td>${service.duration_minutes} min</td>
                    <td>${service.is_active ? 'Active' : 'Inactive'}</td>
                    <td>
                        <button onclick="editService(${service.id})">Edit</button>
                        <button onclick="deleteService(${service.id})">Delete</button>
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            $('#services-list').html(html);
        });
}

function showServiceModal(serviceId = null) {
    $('#service-modal-title').text(serviceId ? 'Edit Service' : 'Add Service');
    
    // Reset form but preserve service ID if editing
    const currentId = serviceId || $('#service-id').val();
    $('#service-form')[0].reset();
    $('#service-image-preview').hide();
    $('#service-image-preview-img').attr('src', '');
    
    // Clear file input explicitly
    $('#service-image').val('');
    
    if (serviceId) {
        console.log('Loading service for edit:', serviceId);
        fbAdminGetServices().done(function(res) {
            const service = res.items.find(s => s.id == serviceId); // Use == for type coercion
            if (service) {
                console.log('Service found:', service);
                $('#service-id').val(service.id);
                $('#service-name').val(service.name);
                $('#service-description').val(service.description || '');
                $('#service-price').val(service.price);
                $('#service-duration').val(service.duration_minutes);
                $('#service-active').prop('checked', service.is_active);
                
                // Show existing image if available
                if (service.image_url) {
                    $('#service-image-preview-img').attr('src', service.image_url);
                    $('#service-image-preview').show();
                }
            } else {
                console.error('Service not found with ID:', serviceId);
                alert('Service not found');
            }
        }).fail(function() {
            console.error('Failed to load services');
            alert('Failed to load service data');
        });
    } else {
        $('#service-id').val('');
    }
    
    $('#service-modal').show();
}

function previewServiceImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            $('#service-image-preview-img').attr('src', e.target.result);
            $('#service-image-preview').show();
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        $('#service-image-preview').hide();
    }
}

function closeServiceModal() {
    $('#service-modal').hide();
}

// Real-time validation for price and duration inputs
$(document).ready(function() {
    // Prevent typing dash/minus and limit price to 2 decimal places
    $('#service-price').on('keydown', function(e) {
        // Prevent typing dash/minus sign
        if (e.key === '-' || e.key === 'Minus') {
            e.preventDefault();
            return false;
        }
        // Explicitly allow decimal point and numbers
        // Don't block anything else - let the input handler do the validation
    }).on('input', function() {
        let value = $(this).val();
        
        // If empty, allow it (user might be deleting)
        if (value === '' || value === '.') {
            return; // Allow empty or just a decimal point while typing
        }
        
        // Remove any negative signs
        if (value.includes('-')) {
            value = value.replace(/-/g, '');
        }
        
        // Allow decimal point but limit to 2 decimal places
        if (value.includes('.')) {
            const parts = value.split('.');
            // Only allow one decimal point
            if (parts.length > 2) {
                // If multiple decimal points, keep only the first one
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limit decimal places to 2 (only if there are decimal digits)
            if (parts.length > 1 && parts[1] && parts[1].length > 2) {
                value = parts[0] + '.' + parts[1].substring(0, 2);
            }
        }
        
        // Only validate and correct if we have a valid number
        // Don't interfere while user is typing (e.g., "12." should be allowed)
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue < 0) {
            value = Math.abs(numValue).toFixed(2);
        }
        
        // Only update if value changed to avoid cursor jumping
        if ($(this).val() !== value) {
            $(this).val(value);
        }
    }).on('blur', function() {
        // Format to 2 decimal places on blur (if it's a valid number)
        const value = $(this).val();
        if (value && value.trim() !== '' && value !== '.') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue >= 0) {
                $(this).val(numValue.toFixed(2));
            } else if (value === '.') {
                // If user left just a decimal point, clear it
                $(this).val('');
            }
        } else if (value === '.') {
            $(this).val('');
        }
    });
    
    // Prevent typing dash/minus and remove decimals from duration field
    $('#service-duration').on('keydown', function(e) {
        // Prevent typing dash/minus sign
        if (e.key === '-' || e.key === 'Minus') {
            e.preventDefault();
            return false;
        }
        // Prevent typing decimal point
        if (e.key === '.' || e.key === 'Decimal') {
            e.preventDefault();
            return false;
        }
    }).on('input', function() {
        let value = $(this).val();
        
        // Remove any negative signs
        if (value.includes('-')) {
            value = value.replace(/-/g, '');
        }
        
        // Remove decimal point and everything after it (make it integer-only)
        if (value.includes('.')) {
            value = value.split('.')[0];
        }
        
        // Ensure value is a positive integer
        const intValue = parseInt(value);
        if (!isNaN(intValue) && intValue < 0) {
            value = Math.abs(intValue).toString();
        } else if (!isNaN(intValue) && intValue >= 0) {
            value = intValue.toString();
        }
        
        $(this).val(value);
    }).on('blur', function() {
        // Ensure it's an integer on blur
        const intValue = parseInt($(this).val());
        if (!isNaN(intValue) && intValue >= 1) {
            $(this).val(intValue.toString());
        }
    });
    
    // Prevent pasting negative values or invalid formats
    $('#service-price, #service-duration').on('paste', function(e) {
        e.preventDefault();
        const paste = (e.originalEvent || e).clipboardData.getData('text');
        let cleanValue = paste;
        
        // Remove negative signs
        cleanValue = cleanValue.replace(/-/g, '');
        
        if ($(this).attr('id') === 'service-price') {
            // For price: limit to 2 decimal places
            if (cleanValue.includes('.')) {
                const parts = cleanValue.split('.');
                if (parts[1] && parts[1].length > 2) {
                    cleanValue = parts[0] + '.' + parts[1].substring(0, 2);
                }
            }
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue) && numValue >= 0) {
                $(this).val(numValue.toFixed(2));
            }
        } else {
            // For duration: remove decimals, keep only integer part
            if (cleanValue.includes('.')) {
                cleanValue = cleanValue.split('.')[0];
            }
            const intValue = parseInt(cleanValue);
            if (!isNaN(intValue) && intValue >= 1) {
                $(this).val(intValue.toString());
            }
        }
    });
});

function saveService(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const id = $('#service-id').val();
    
    console.log('Saving service, ID:', id, 'Type:', id ? 'UPDATE' : 'CREATE');
    
    // Get and validate form values
    const name = $('#service-name').val().trim();
    const priceInput = $('#service-price').val().trim();
    const durationInput = $('#service-duration').val().trim();
    
    // Validate required fields
    if (!name) {
        alert('Service name is required');
        $('#service-name').focus();
        return false;
    }
    
    // Validate price - must be a positive number
    if (!priceInput) {
        alert('Price is required');
        $('#service-price').focus();
        return false;
    }
    
    const price = parseFloat(priceInput);
    if (isNaN(price)) {
        alert('Price must be a valid number');
        $('#service-price').focus();
        return false;
    }
    
    if (price < 0) {
        alert('Price cannot be negative. Please enter a positive value.');
        $('#service-price').focus();
        $('#service-price').val('');
        return false;
    }
    
    if (price === 0) {
        if (!confirm('Price is set to ₱0.00. Do you want to continue?')) {
            $('#service-price').focus();
            return false;
        }
    }
    
    // Validate duration - must be a positive integer
    if (!durationInput) {
        alert('Duration is required');
        $('#service-duration').focus();
        return false;
    }
    
    const duration = parseInt(durationInput);
    if (isNaN(duration)) {
        alert('Duration must be a valid number');
        $('#service-duration').focus();
        return false;
    }
    
    if (duration < 0) {
        alert('Duration cannot be negative. Please enter a positive number of minutes.');
        $('#service-duration').focus();
        $('#service-duration').val('');
        return false;
    }
    
    if (duration < 1) {
        alert('Duration must be at least 1 minute');
        $('#service-duration').focus();
        return false;
    }
    
    if (duration < 10) {
        if (!confirm('Duration is less than 10 minutes. Do you want to continue?')) {
            $('#service-duration').focus();
            return false;
        }
    }
    
    const data = {
        name: name,
        description: $('#service-description').val().trim() || '',
        price: parseFloat(price.toFixed(2)), // Ensure exactly 2 decimal places
        duration_minutes: duration, // Already an integer
        is_active: $('#service-active').is(':checked') ? true : false
    };
    
    const imageFile = $('#service-image')[0].files[0];
    if (imageFile) {
        data.image = imageFile;
        console.log('Image file selected:', imageFile.name, 'Size:', imageFile.size);
    } else {
        console.log('No new image file selected - will keep existing image');
    }
    
    console.log('Service data keys:', Object.keys(data), 'Is update?', !!id, 'Service ID:', id);
    
    if (!id) {
        console.log('Creating new service');
        var promise = fbAdminCreateService(data);
    } else {
        console.log('Updating service with ID:', id);
        var promise = fbAdminUpdateService(id, data);
    }
    
    promise.done(function(res) {
        console.log('Service save response:', res);
        if (res.item && res.item.id) {
            console.log('Service created with ID:', res.item.id);
        }
        alert('Service saved successfully!');
        closeServiceModal();
        loadServices();
    }).fail(function(xhr) {
        console.error('Service save error:', xhr);
        let errorMsg = 'Failed to save service';
        if (xhr.responseJSON) {
            if (xhr.responseJSON.message) {
                errorMsg = xhr.responseJSON.message;
            } else if (xhr.responseJSON.errors) {
                const errors = [];
                Object.keys(xhr.responseJSON.errors).forEach(key => {
                    errors.push(xhr.responseJSON.errors[key].join(', '));
                });
                errorMsg = errors.join('\n');
            }
        }
        alert('Error: ' + errorMsg);
    });
    
    return false; // Prevent form submission
}

function editService(id) {
    showServiceModal(id);
}

function deleteService(id) {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    fbAdminDeleteService(id)
        .done(function() {
            loadServices();
        })
        .fail(function(xhr) {
            alert('Error: ' + (xhr.responseJSON?.message || 'Failed to delete service'));
        });
}

// Bookings
function loadBookings() {
    const status = $('#booking-status-filter').val();
    
    fbGetBookings(status ? { status } : {})
        .done(function(res) {
            const bookings = res.items || [];
            let html = '<table><thead><tr><th>ID</th><th>Client</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Aesthetician</th></tr></thead><tbody>';
            
            bookings.forEach(booking => {
                // Format date to mm/dd/yyyy
                let formattedDate = booking.appointment_date;
                if (booking.appointment_date) {
                    const date = new Date(booking.appointment_date);
                    if (!isNaN(date.getTime())) {
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = date.getFullYear();
                        formattedDate = `${month}/${day}/${year}`;
                    }
                }
                
                // Format time to show time slot format (e.g., 9:00am-10:00am)
                let formattedTime = '';
                if (booking.appointment_time) {
                    const timeParts = booking.appointment_time.split(':');
                    const hour = parseInt(timeParts[0]);
                    const minute = timeParts[1] || '00';
                    
                    if (hour >= 0 && hour < 24) {
                        let displayHour = hour;
                        let ampm = 'am';
                        
                        if (hour === 0) {
                            displayHour = 12;
                        } else if (hour === 12) {
                            ampm = 'pm';
                        } else if (hour > 12) {
                            displayHour = hour - 12;
                            ampm = 'pm';
                        }
                        
                        const nextHour = hour + 1;
                        let nextDisplayHour = nextHour;
                        let nextAmpm = 'am';
                        
                        if (nextHour === 0) {
                            nextDisplayHour = 12;
                        } else if (nextHour === 12) {
                            nextAmpm = 'pm';
                        } else if (nextHour > 12) {
                            nextDisplayHour = nextHour - 12;
                            nextAmpm = 'pm';
                        } else if (nextHour === 24) { // Handle 11pm-12am case
                            nextDisplayHour = 12;
                        }
                        
                        formattedTime = `${displayHour}:${minute}${ampm}-${nextDisplayHour}:${minute}${nextAmpm}`;
                    }
                }
                
                html += `<tr>
                    <td>${booking.id}</td>
                    <td>${booking.client?.first_name} ${booking.client?.last_name}</td>
                    <td>${booking.service?.name}</td>
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                    <td>${booking.aesthetician ? booking.aesthetician.first_name + ' ' + booking.aesthetician.last_name : 'N/A'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            $('#bookings-list').html(html);
        });
}

