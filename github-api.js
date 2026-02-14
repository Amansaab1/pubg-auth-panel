// github-api.js - Working with your Gist
const GitHubAPI = {
    async getData() {
        try {
            // Direct raw URL - no token needed for reading
            const response = await fetch(`https://gist.githubusercontent.com/Amansaab1/${GITHUB_CONFIG.gistId}/raw/${GITHUB_CONFIG.filename}`);
            return await response.json();
        } catch (error) {
            console.error('Error:', error);
            return {};
        }
    },

    async login(key, deviceId) {
        try {
            const data = await this.getData();
            
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
                // Note: Writing back to gist requires token
                // For now, just return success
            }
            
            return {
                success: true,
                message: 'Login successful',
                expiry: keyData.expiry
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

window.GitHubAPI = GitHubAPI;
