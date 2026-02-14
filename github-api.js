// github-api.js - Complete Working API
const GitHubAPI = {
    gistId: GITHUB_CONFIG.gistId,
    filename: 'keys_data.json',
    
    // Read data from gist
    async readFile() {
        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.files[this.filename].content;
            return JSON.parse(content);
        } catch (error) {
            console.error('Read error:', error);
            return {};
        }
    },

    // Write data to gist
    async writeFile(content) {
        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    files: {
                        [this.filename]: {
                            content: JSON.stringify(content, null, 2)
                        }
                    }
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('Write error:', error);
            return false;
        }
    },

    // Generate random key
    generateRandomKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) key += '-';
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        return key;
    },

    // Generate new key
    async generateKey(maxDevices, duration, customKey = '') {
        try {
            const data = await this.readFile();
            
            let key = customKey || this.generateRandomKey();
            
            if (data[key]) {
                return { success: false, message: 'Key already exists' };
            }
            
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + duration);
            
            data[key] = {
                maxDevices: parseInt(maxDevices),
                devices: [],
                createdAt: new Date().toISOString(),
                expiry: expiry.toISOString()
            };
            
            const saved = await this.writeFile(data);
            
            if (saved) {
                return {
                    success: true,
                    key: key,
                    expiry: expiry.toISOString(),
                    maxDevices: maxDevices
                };
            } else {
                return { success: false, message: 'Failed to save' };
            }
        } catch (error) {
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
                maxDevices: value.maxDevices,
                devicesUsed: value.devices.length,
                expiry: value.expiry,
                createdAt: value.createdAt,
                isExpired: now > new Date(value.expiry).getTime()
            }));
        } catch (error) {
            return [];
        }
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
            
            const deviceExists = keyData.devices.some(d => d.id === deviceId);
            
            if (!deviceExists) {
                if (keyData.devices.length >= keyData.maxDevices) {
                    return { success: false, message: 'Max devices reached' };
                }
                keyData.devices.push({ id: deviceId, time: new Date().toISOString() });
            }
            
            data[key] = keyData;
            await this.writeFile(data);
            
            return {
                success: true,
                message: 'Login successful',
                expiry: keyData.expiry
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Check single key
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
            const saved = await this.writeFile(data);
            
            return { success: saved };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

// Make available globally
window.GitHubAPI = GitHubAPI;
