<?php
// api.php - Proxy to handle CORS and forward to GitHub API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = isset($_POST['action']) ? $_POST['action'] : (isset($_GET['action']) ? $_GET['action'] : '');

switch ($action) {
    case 'login':
        $key = isset($_POST['key']) ? $_POST['key'] : '';
        $deviceId = isset($_POST['device_id']) ? $_POST['device_id'] : '';
        
        // Call GitHub API through JavaScript (since PHP can't directly)
        echo json_encode(['success' => false, 'message' => 'Use GitHub Pages URL directly']);
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
?>
