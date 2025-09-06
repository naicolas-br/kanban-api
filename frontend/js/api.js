// API Client with error handling
class ApiClient {
    constructor() {
        this.baseURL = 'http://localhost:8000/api';
        this.token = localStorage.getItem('access_token');
    }

    // Set authorization token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('access_token', token);
        } else {
            localStorage.removeItem('access_token');
        }
    }

    // Get authorization headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Handle API response
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        let data = null;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { message: await response.text() };
        }

        if (!response.ok) {
            throw new ApiError(response.status, data);
        }

        return data;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                headers: this.getHeaders(),
                ...options
            };

            if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
                config.body = JSON.stringify(config.body);
            }

            const response = await fetch(url, config);
            return await this.handleResponse(response);
        } catch (error) {
            if (error instanceof ApiError) {
                this.handleApiError(error);
                throw error;
            }
            
            // Network or other errors
            this.showNetworkError();
            throw new ApiError(0, { message: 'Erro de conexão' });
        }
    }

    // Handle API errors with SweetAlert2
    handleApiError(error) {
        const { status, data } = error;

        switch (status) {
            case 401:
                this.handleUnauthorized();
                break;
            case 403:
                this.showError('Acesso Negado', 'Você não tem permissão para realizar esta ação.');
                break;
            case 404:
                this.showError('Não Encontrado', 'O recurso solicitado não foi encontrado.');
                break;
            case 422:
                this.handleValidationError(data);
                break;
            case 500:
                this.showError('Erro do Servidor', 'Ocorreu um erro interno. Tente novamente mais tarde.');
                break;
            default:
                this.showError('Erro', data.message || 'Ocorreu um erro inesperado.');
        }
    }

    // Handle 401 Unauthorized
    handleUnauthorized() {
        this.setToken(null);
        localStorage.removeItem('refresh_token');
        
        Swal.fire({
            icon: 'warning',
            title: 'Sessão Expirada',
            text: 'Sua sessão expirou. Você será redirecionado para o login.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            window.location.href = 'login.html';
        });
    }

    // Handle validation errors (422)
    handleValidationError(data) {
        let message = 'Por favor, corrija os erros abaixo:';
        
        if (data.error && data.error.code === 'WIP_LIMIT_REACHED') {
            message = 'Limite de WIP atingido! Esta coluna não pode receber mais cards.';
        } else if (data.errors) {
            message += '\n\n';
            Object.keys(data.errors).forEach(field => {
                message += `• ${data.errors[field][0]}\n`;
            });
        }

        this.showError('Erro de Validação', message);
    }

    // Show network error
    showNetworkError() {
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
            confirmButtonText: 'Tentar Novamente',
            confirmButtonColor: '#4f46e5',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.reload();
            }
        });
    }

    // Generic error display
    showError(title, message) {
        Swal.fire({
            icon: 'error',
            title: title,
            text: message,
            confirmButtonText: 'OK',
            confirmButtonColor: '#4f46e5'
        });
    }

    // Success notification
    showSuccess(title, message) {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });
    }

    // HTTP Methods
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: data
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Authentication methods
    async login(credentials) {
        const data = await this.post('/login', credentials);
        if (data.access_token) {
            this.setToken(data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data;
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const data = await this.post('/refresh', { refresh_token: refreshToken });
        if (data.access_token) {
            this.setToken(data.access_token);
        }
        return data;
    }

    async logout() {
        try {
            await this.post('/logout');
        } catch (error) {
            // Ignore errors on logout
        } finally {
            this.setToken(null);
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
        }
    }

    // Board methods
    async getBoards() {
        return this.get('/boards');
    }

    async getBoard(id) {
        return this.get(`/boards/${id}`);
    }

    async createBoard(boardData) {
        return this.post('/boards', boardData);
    }

    async updateBoard(id, boardData) {
        return this.patch(`/boards/${id}`, boardData);
    }

    async deleteBoard(id) {
        return this.delete(`/boards/${id}`);
    }

    // Column methods
    async createColumn(boardId, columnData) {
        return this.post(`/boards/${boardId}/columns`, columnData);
    }

    async updateColumn(id, columnData) {
        return this.patch(`/columns/${id}`, columnData);
    }

    async deleteColumn(id) {
        return this.delete(`/columns/${id}`);
    }

    // Card methods
    async createCard(boardId, cardData) {
        return this.post(`/boards/${boardId}/cards`, cardData);
    }

    async updateCard(id, cardData) {
        return this.patch(`/cards/${id}`, cardData);
    }

    async moveCard(id, moveData) {
        return this.post(`/cards/${id}/move`, moveData);
    }

    async deleteCard(id) {
        return this.delete(`/cards/${id}`);
    }

    // History methods
    async getBoardHistory(boardId) {
        return this.get(`/boards/${boardId}/history`);
    }

    async getCardHistory(cardId) {
        return this.get(`/cards/${cardId}/history`);
    }
}

// Custom API Error class
class ApiError extends Error {
    constructor(status, data) {
        super(data.message || 'API Error');
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Create global API instance
const api = new ApiClient();

// Auto-refresh token on 401 (optional enhancement)
const originalRequest = api.request.bind(api);
api.request = async function(endpoint, options = {}) {
    try {
        return await originalRequest(endpoint, options);
    } catch (error) {
        if (error.status === 401 && localStorage.getItem('refresh_token')) {
            try {
                await this.refreshToken();
                // Retry original request with new token
                return await originalRequest(endpoint, options);
            } catch (refreshError) {
                this.handleUnauthorized();
                throw refreshError;
            }
        }
        throw error;
    }
}.bind(api);