<?php
/**
 * NACSA Mobile Attendance API
 *
 * Upload this file to: nacsagh.com/mobile-api.php
 *
 * BEFORE GO-LIVE:
 *   1. Set $test_mode = false
 *   2. Set $api_key to a strong random string
 *   3. Fill in your DB credentials (cPanel → MySQL Databases)
 */

// ── Config ────────────────────────────────────────────────────────────────────
$test_mode = true;
$api_key   = 'ae4357c4-1c3c-4c0e-ab08-2b92fd167308';

$db_host = '127.0.0.1';
$db_name = 'nacsjcjt_stfattnd';
$db_user = 'nacsjcjt_sfgghdsff';
$db_pass = 'T%KJL2t?.RA$';
// ─────────────────────────────────────────────────────────────────────────────

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: X-API-Key, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Auth
$provided = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($provided !== $api_key) {
    respond(401, 'Unauthorized');
}

// DB
try {
    $pdo = new PDO(
        "mysql:host={$db_host};dbname={$db_name};charset=utf8mb4",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (Exception $e) {
    respond(500, 'Database unavailable');
}

$action = strtolower(trim($_GET['action'] ?? ''));

// ── GET: staff profile + branch data ─────────────────────────────────────────
if ($action === 'staff') {
    $staff_id = trim($_GET['staff_id'] ?? '');
    if (!$staff_id) respond(400, 'staff_id required');

    $stmt = $pdo->prepare("
        SELECT
            sp.staff_id,
            sp.full_name,
            sp.department,
            sp.face_descriptor,
            sp.status,
            sp.on_leave,
            sp.is_exempted,
            b.name          AS branch_name,
            b.latitude      AS branch_lat,
            b.longitude     AS branch_lng,
            b.allowed_radius,
            b.shift_start,
            b.shift_end,
            b.shift_late
        FROM staff_profiles sp
        LEFT JOIN branches b ON sp.wk_branch = b.id
        WHERE sp.staff_id = ?
        LIMIT 1
    ");
    $stmt->execute([$staff_id]);
    $row = $stmt->fetch();

    if (!$row)               respond(404, 'Staff not found');
    if ($row['status'] != 1) respond(403, 'Account is inactive');
    if ($row['on_leave'])    respond(403, 'Staff is currently on leave');

    // Parse descriptor from JSON string → array
    $row['face_descriptor'] = $row['face_descriptor']
        ? json_decode($row['face_descriptor'], true)
        : null;

    // Cast numeric branch fields
    $row['branch_lat']      = $row['branch_lat']      ? (float)$row['branch_lat']      : null;
    $row['branch_lng']      = $row['branch_lng']      ? (float)$row['branch_lng']      : null;
    $row['allowed_radius']  = $row['allowed_radius']  ? (int)$row['allowed_radius']    : 200;

    echo json_encode(['success' => true, 'data' => $row]);
    exit;
}

// ── GET: today's attendance rows for a staff member ───────────────────────────
if ($action === 'today') {
    $staff_id = trim($_GET['staff_id'] ?? '');
    if (!$staff_id) respond(400, 'staff_id required');

    $stmt = $pdo->prepare("
        SELECT id, clock_in_time, clockout_time
        FROM staff_attendance
        WHERE staff_id = ? AND attendance_date = CURDATE()
        ORDER BY id ASC
    ");
    $stmt->execute([$staff_id]);
    $rows = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $rows]);
    exit;
}

// ── GET: all face descriptors for on-device matching ─────────────────────────
if ($action === 'descriptors') {
    $stmt = $pdo->query("
        SELECT staff_id, face_descriptor
        FROM staff_profiles
        WHERE face_descriptor IS NOT NULL AND status = 1
    ");

    $result = [];
    foreach ($stmt->fetchAll() as $r) {
        $desc = json_decode($r['face_descriptor'], true);
        if ($desc && is_array($desc)) {
            $result[] = ['staff_id' => $r['staff_id'], 'descriptor' => $desc];
        }
    }

    echo json_encode(['success' => true, 'data' => $result]);
    exit;
}

// ── POST: write a clock event ─────────────────────────────────────────────────
if ($action === 'clock') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, 'POST required');

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $staff_id        = trim($body['staff_id']        ?? '');
    $event_type      =      $body['event_type']      ?? '';
    $latitude        =      $body['latitude']        ?? null;
    $longitude       =      $body['longitude']       ?? null;
    $face_verified   = (int)($body['face_verified']   ?? 0);
    $face_confidence = (int)($body['face_confidence'] ?? 0);
    $is_late         = (int)($body['is_late']         ?? 0);

    if (!$staff_id || !$event_type) respond(400, 'staff_id and event_type required');

    // ── Test mode: return what would have been written, touch nothing ─────────
    if ($test_mode) {
        echo json_encode([
            'success'    => true,
            'test_mode'  => true,
            'message'    => 'Test mode active — nothing was written to the database',
            'would_have' => $body,
        ]);
        exit;
    }

    $now   = date('Y-m-d H:i:s');
    $today = date('Y-m-d');

    $is_clock_in = in_array($event_type, ['clock-in-arrival', 'clock-in-lunch']);

    if ($is_clock_in) {
        $stmt = $pdo->prepare("
            INSERT INTO staff_attendance
                (staff_id, clock_in_time, attendance_date,
                 latitude, longitude,
                 face_verified, face_confidence, is_late, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'mobile_app')
        ");
        $stmt->execute([
            $staff_id, $now, $today,
            $latitude, $longitude,
            $face_verified, $face_confidence, $is_late,
        ]);
        echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);
    } else {
        // clock-out-lunch / clock-out-eod → update most recent open row
        $stmt = $pdo->prepare("
            UPDATE staff_attendance
            SET clockout_time      = ?,
                clockout_latitude  = ?,
                clockout_longitude = ?
            WHERE staff_id      = ?
              AND attendance_date = ?
              AND clockout_time IS NULL
            ORDER BY id DESC
            LIMIT 1
        ");
        $stmt->execute([$now, $latitude, $longitude, $staff_id, $today]);
        echo json_encode(['success' => true, 'rows_updated' => $stmt->rowCount()]);
    }
    exit;
}

respond(400, 'Unknown action');

// ── Helper ────────────────────────────────────────────────────────────────────
function respond(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}
