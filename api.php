<?php
// api.php - Place this in your GitHub Pages repository

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Data file path (using GitHub Pages - this will be temporary storage)
$dataFile = __DIR__ . '/keys_data.json';

// Initialize data file if not exists
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([]));
}

// Load keys data
$keysData = json_decode(file_get_contents($dataFile), true);

// Get request data
$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
$action = isset($input['action']) ? $input['action'] : '';

switch ($action) {
    case 'login':
        handleLogin($input, $keysData, $dataFile);
        break;
        
    case 'generate':
        handleGenerate($input, $keysData, $dataFile);
        break;
        
    case 'check':
        handleCheck($input, $keysData);
        break;
        
    case 'delete':
        handleDelete($input, $keysData, $dataFile);
        break;
        
    case 'list':
        handleList($keysData);
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

function handleLogin($input, &$keysData, $dataFile) {
    $key = isset($input['key']) ? $input['key'] : '';
    $deviceId = isset($input['device_id']) ? $input['device_id'] : '';
    
    if (empty($key) || empty($deviceId)) {
        echo json_encode(['success' => false, 'message' => 'Key and device ID required']);
        return;
    }
    
    if (!isset($keysData[$key])) {
        echo json_encode(['success' => false, 'message' => 'Invalid key']);
        return;
    }
    
    $keyData = &$keysData[$key];
    $now = time();
    $expiry = strtotime($keyData['expiry']);
    
    // Check if expired
    if ($now > $expiry) {
        echo json_encode(['success' => false, 'message' => 'Key expired']);
        return;
    }
    
    // Check if device already registered
    $deviceIndex = -1;
    foreach ($keyData['devices'] as $index => $device) {
        if ($device['id'] === $deviceId) {
            $deviceIndex = $index;
            break;
        }
    }
    
    // If device not found, check max devices
    if ($deviceIndex === -1) {
        if (count($keyData['devices']) >= $keyData['maxDevices']) {
            echo json_encode(['success' => false, 'message' => 'Maximum devices reached']);
            return;
        }
        
        // Register new device
        $keyData['devices'][] = [
            'id' => $deviceId,
            'time' => date('Y-m-d H:i:s')
        ];
    } else {
        // Update existing device time
        $keyData['devices'][$deviceIndex]['time'] = date('Y-m-d H:i:s');
    }
    
    // Save data
    file_put_contents($dataFile, json_encode($keysData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'expiry' => $keyData['expiry']
    ]);
}

function handleGenerate($input, &$keysData, $dataFile) {
    $maxDevices = isset($input['maxDevices']) ? intval($input['maxDevices']) : 1;
    $duration = isset($input['duration']) ? floatval($input['duration']) : 30;
    $customKey = isset($input['customKey']) ? $input['customKey'] : '';
    
    // Generate or use custom key
    if (!empty($customKey)) {
        $key = strtoupper($customKey);
        if (isset($keysData[$key])) {
            echo json_encode(['success' => false, 'message' => 'Key already exists']);
            return;
        }
    } else {
        $key = generateKey();
        while (isset($keysData[$key])) {
            $key = generateKey();
        }
    }
    
    // Calculate expiry
    $expiry = date('Y-m-d H:i:s', strtotime("+{$duration} days"));
    
    // Create key data
    $keysData[$key] = [
        'maxDevices' => $maxDevices,
        'devices' => [],
        'createdAt' => date('Y-m-d H:i:s'),
        'expiry' => $expiry
    ];
    
    // Save data
    file_put_contents($dataFile, json_encode($keysData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'key' => $key,
        'expiry' => $expiry,
        'maxDevices' => $maxDevices
    ]);
}

function handleCheck($input, $keysData) {
    $key = isset($input['key']) ? $input['key'] : '';
    
    if (empty($key)) {
        echo json_encode(['success' => false, 'message' => 'Key required']);
        return;
    }
    
    if (!isset($keysData[$key])) {
        echo json_encode(['success' => false, 'message' => 'Key not found']);
        return;
    }
    
    $keyData = $keysData[$key];
    $now = time();
    $expiry = strtotime($keyData['expiry']);
    
    echo json_encode([
        'success' => true,
        'key' => $key,
        'maxDevices' => $keyData['maxDevices'],
        'devicesUsed' => count($keyData['devices']),
        'devices' => $keyData['devices'],
        'expiry' => $keyData['expiry'],
        'isExpired' => $now > $expiry,
        'createdAt' => $keyData['createdAt']
    ]);
}

function handleDelete($input, &$keysData, $dataFile) {
    $key = isset($input['key']) ? $input['key'] : '';
    
    if (empty($key)) {
        echo json_encode(['success' => false, 'message' => 'Key required']);
        return;
    }
    
    if (isset($keysData[$key])) {
        unset($keysData[$key]);
        file_put_contents($dataFile, json_encode($keysData, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Key not found']);
    }
}

function handleList($keysData) {
    $keysList = [];
    foreach ($keysData as $key => $data) {
        $keysList[] = [
            'key' => $key,
            'maxDevices' => $data['maxDevices'],
            'devicesUsed' => count($data['devices']),
            'expiry' => $data['expiry'],
            'createdAt' => $data['createdAt']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'keys' => $keysList
    ]);
}

function generateKey($length = 16) {
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $key = '';
    for ($i = 0; $i < $length; $i++) {
        if ($i > 0 && $i % 4 == 0) {
            $key .= '-';
        }
        $key .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $key;
}
?>
