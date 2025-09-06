// Authentication module
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.loadUser();
    }

    // Load user from localStorage
    loadUser() {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
            } catch (error) {
                console.error('Error parsing user data:', error);
                this.clearUser();
            }
        }
    }

    // Save user to localStorage
    saveUser(user) {
        this.currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Clear user data
    clearUser() {
        this.currentUser = null;
        localStorage.removeItem('user');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('access_token') && !!this.currentUser;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // Redirect to dashboard if already authenticated
    redirectIfAuthenticated() {
        if (this.isAuthenticated()) {
            window.location.href = 'index.html';
            return true;
        }
        return false;
    }
}

// Create global auth manager
const auth = new AuthManager();

// Button loading state management
function setButtonLoading(button, loading) {
    const textElement = button.querySelector('.btn-text');
    const loaderElement = button.querySelector('.btn-loader');
    
    if (loading) {
        button.disabled = true;
        textElement.classList.add('hidden');
        loaderElement.classList.remove('hidden');
    } else {
        button.disabled = false;
        textElement.classList.remove('hidden');
        loaderElement.classList.add('hidden');
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const credentials = Object.fromEntries(formData);
    const submitButton = form.querySelector('button[type="submit"]');
    
    setButtonLoading(submitButton, true);
    
    try {
        const response = await api.login(credentials);
        
        // Save user data
        auth.saveUser(response.user);
        
        // Show success message
        Swal.fire({
            icon: 'success',
            title: 'Login realizado!',
            text: `Bem-vindo(a), ${response.user.name}!`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'index.html';
        });
        
    } catch (error) {
        console.error('Login error:', error);
        // Error is already handled by API client
    } finally {
        setButtonLoading(submitButton, false);
    }
}

// Handle register form submission
async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const userData = Object.fromEntries(formData);
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Validate password confirmation
    if (userData.password !== userData.password_confirmation) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'As senhas não coincidem.',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    setButtonLoading(submitButton, true);
    
    try {
        // Note: You'll need to implement register endpoint in your API
        const response = await api.post('/register', userData);
        
        // Save user data and tokens if returned
        if (response.access_token) {
            api.setToken(response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
            auth.saveUser(response.user);
        }
        
        Swal.fire({
            icon: 'success',
            title: 'Conta criada!',
            text: `Bem-vindo(a), ${response.user.name}!`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            if (response.access_token) {
                window.location.href = 'index.html';
            } else {
                // If no auto-login, switch to login tab
                document.querySelector('[data-tab="login"]').click();
                form.reset();
            }
        });
        
    } catch (error) {
        console.error('Register error:', error);
        // Error is already handled by API client
    } finally {
        setButtonLoading(submitButton, false);
    }
}

// Handle logout
async function handleLogout() {
    try {
        const result = await Swal.fire({
            title: 'Sair do sistema?',
            text: 'Tem certeza que deseja fazer logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, sair',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280'
        });
        
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Saindo...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            await api.logout();
            auth.clearUser();
            
            Swal.fire({
                icon: 'success',
                title: 'Logout realizado!',
                text: 'Você foi desconectado com sucesso.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'login.html';
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout even on error
        auth.clearUser();
        api.setToken(null);
        window.location.href = 'login.html';
    }
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'login.html' || currentPage === '') {
        // Redirect if already authenticated
        auth.redirectIfAuthenticated();
    } else {
        // Require authentication for other pages
        if (!auth.requireAuth()) {
            return;
        }
        
        // Update UI with user info
        updateUserUI();
        
        // Bind logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
});

// Update UI elements with user information
function updateUserUI() {
    const user = auth.getCurrentUser();
    if (!user) return;
    
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = user.name;
    }
}

// Auto-refresh token when it's about to expire
function scheduleTokenRefresh() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        // JWT tokens contain expiration info, but since we're using custom tokens,
        // we'll refresh every 50 minutes (tokens expire in 60 minutes)
        setTimeout(async () => {
            try {
                await api.refreshToken();
                scheduleTokenRefresh(); // Schedule next refresh
            } catch (error) {
                console.error('Token refresh failed:', error);
                // Will be handled by API client (redirect to login)
            }
        }, 50 * 60 * 1000); // 50 minutes
    } catch (error) {
        console.error('Error scheduling token refresh:', error);
    }
}

// Start token refresh schedule
if (auth.isAuthenticated()) {
    scheduleTokenRefresh();
}

// Theme toggle functionality
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    // Load saved theme or default to light
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeToggleButton(currentTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleButton(newTheme);
    });
}

function updateThemeToggleButton(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
    }
}

// Initialize theme toggle
document.addEventListener('DOMContentLoaded', initThemeToggle);

// Handle network status
function handleNetworkStatus() {
    window.addEventListener('online', () => {
        Swal.fire({
            icon: 'success',
            title: 'Conexão Restaurada',
            text: 'Você está novamente online!',
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });
    });
    
    window.addEventListener('offline', () => {
        Swal.fire({
            icon: 'warning',
            title: 'Sem Conexão',
            text: 'Você está offline. Algumas funcionalidades podem não funcionar.',
            timer: 3000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });
    });
}

// Initialize network status monitoring
handleNetworkStatus();