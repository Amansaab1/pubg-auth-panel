// github-api.js - Complete GitHub API Handler
const GitHubAPI = {
    currentSha: null,
    cache: null,
    lastFetch: 0,
    cacheDuration: 5000, // 5 seconds cache

    async readFile(forceRefresh = false) {
        try {
            // Return cache if available and not expired
            if (!forceRefresh && this.cache && (Date.now() - this.lastFetch) < this.cacheDuration) {
                return this.cache;
            }

            const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}?ref=${GITHUB_CONFIG.branch}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.status === 404) {
                // File doesn't exist, create it
                this.cache = await this.createEmptyFile();
                this.lastFetch = Date.now();
                return this.cache;
            }
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const data = await response.json();
            const content = atob(data.content);
            this.currentSha = data.sha;
            
            // Parse and cache
            this.cache = JSON.parse(content);
            this.lastFetch = Date.now();
            
            return this.cache;
        } catch (error) {
            console.error('Error reading file:', error);
            return this.cache || {}; // Return cache on error
        }
    },
    
    async createEmptyFile() {
        try {
            const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}`;
            
            const content = btoa(unescape(encodeURIComponent(JSON.stringify({}, null, 2))));
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Initialize keys file',
                    content: content,
                    branch: GITHUB_CONFIG.branch
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentSha = data.content.sha;
            
            return {};
        } catch (error) {
            console.error('Error creating file:', error);
            return {};
        }
    },
    
    async saveFile(content) {
        try {
            // First get current file to ensure we have latest SHA
            await this.readFile(true);
            
            const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}`;
            
            const jsonContent = JSON.stringify(content, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(jsonContent)));
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update keys data - ${new Date().toLocaleString()}`,
                    content: encodedContent,
                    sha: this.currentSha,
                    branch: GITHUB_CONFIG.branch
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save');
            }
            
            const data = await response.json();
            this.currentSha = data.content.sha;
            this.cache = content;
            this.lastFetch = Date.now();
            
            return true;
        } catch (error) {
            console.error('Error saving file:', error);
            return false;
        }
    },
    
    // Generate random key
    generateKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) key += '-';
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        return key;
    },
    
    // Login function
    async login(key, deviceId) {
        try {
            const data = await this.readFile();
            
            if (!data[key]) {
                return { success: false, message: 'Invalid key' };
            }
            
            const keyData = data[key];
            const now = Date.now();
            const expiry = new Date(keyData.expiry).getTime();
            
            if (now > expiry) {
                return { success: false, message: 'Key expired' };
            }
            
            // Check if device already registered
            const deviceIndex = keyData.devices.findIndex(d => d.id === deviceId);
            
            if (deviceIndex === -1) {
                if (keyData.devices.length >= keyData.maxDevices) {
                    return { success: false, message: 'Maximum devices reached' };
                }
                keyData.devices.push({
                    id: deviceId,
                    time: new Date().toISOString()
                });
            } else {
                keyData.devices[deviceIndex].time = new Date().toISOString();
            }
            
            data[key] = keyData;
            
            const saved = await this.saveFile(data);
            
            if (saved) {
                return {
                    success: true,
                    message: 'Login successful',
                    expiry: keyData.expiry
                };
            } else {
                return { success: false, message: 'Failed to save data' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Generate new key
    async generateKey(maxDevices, duration, customKey = '') {
        try {
            const data = await this.readFile();
            
            // Use custom key or generate random
            const key = customKey || this.generateKey();
            
            if (data[key]) {
                return { success: false, message: 'Key already exists' };
            }
            
            // Calculate expiry
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + duration);
            
            // Add new key
            data[key] = {
                maxDevices: parseInt(maxDevices),
                devices: [],
                createdAt: new Date().toISOString(),
                expiry: expiry.toISOString()
            };
            
            const saved = await this.saveFile(data);
            
            if (saved) {
                return {
                    success: true,
                    key: key,
                    expiry: expiry.toISOString(),
                    maxDevices: maxDevices
                };
            } else {
                return { success: false, message: 'Failed to save data' };
            }
        } catch (error) {
            console.error('Generate error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Check key info
    async checkKey(key) {
        try {
            const data = await this.readFile();
            
            if (!data[key]) {
                return { success: false, message: 'Key not found' };
            }
            
            const keyData = data[key];
            const now = Date.now();
            const expiry = new Date(keyData.expiry).getTime();
            
            return {
                success: true,
                key: key,
                maxDevices: keyData.maxDevices,
                devicesUsed: keyData.devices.length,
                devices: keyData.devices,
                expiry: keyData.expiry,
                isExpired: now > expiry,
                createdAt: keyData.createdAt
            };
        } catch (error) {
            console.error('Check error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Delete key
    async deleteKey(key) {
        try {
            const data = await this.readFile();
            
            if (!data[key]) {
                return { success: false, message: 'Key not found' };
            }
            
            delete data[key];
            const saved = await this.saveFile(data);
            
            return { success: saved };
        } catch (error) {
            console.error('Delete error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Get all keys
    async getAllKeys() {
        try {
            const data = await this.readFile();
            const now = Date.now();
            
            return Object.entries(data).map(([key, value]) => ({
                key: key,
                ...value,
                isExpired: now > new Date(value.expiry).getTime()
            }));
        } catch (error) {
            console.error('Get all error:', error);
            return [];
        }
    },
    
    // Handle API requests via URL
    async handleRequest() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const callback = urlParams.get('callback');
        
        let result = { success: false, message: 'Invalid action' };
        
        try {
            switch(action) {
                case 'login':
                    const key = urlParams.get('key');
                    const deviceId = urlParams.get('device_id');
                    if (!key || !deviceId) {
                        result = { success: false, message: 'Key and device_id required' };
                    } else {
                        result = await this.login(key, deviceId);
                    }
                    break;
                    
                case 'check':
                    const checkKey = urlParams.get('key');
                    if (!checkKey) {
                        result = { success: false, message: 'Key required' };
                    } else {
                        result = await this.checkKey(checkKey);
                    }
                    break;
                    
                case 'list':
                    const keys = await this.getAllKeys();
                    result = { success: true, keys: keys };
                    break;
                    
                default:
                    result = { success: false, message: 'Unknown action' };
            }
        } catch (error) {
            result = { success: false, message: error.message };
        }
        
        // Output response
        const jsonResponse = JSON.stringify(result);
        
        if (callback) {
            document.write(`${callback}(${jsonResponse});`);
        } else {
            document.write(jsonResponse);
        }
    }
};

// Auto-handle requests when script loads
(function() {
    if (window.location.search.includes('action=')) {
        GitHubAPI.handleRequest();
    }
})();

// Make available globally
window.GitHubAPI = GitHubAPI;
