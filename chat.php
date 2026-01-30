<?php
// storage/chat.php
// Chat API over MySQL - PHP 5.2 Compatible

// DEBUG MODE
define('DEBUG_MODE', true);
define('REQUIRE_AUTH', false);

// Output settings
if (DEBUG_MODE) {
  ini_set('display_errors', '1');
  error_reporting(E_ALL);
} else {
  ini_set('display_errors', '0');
}

ini_set('log_errors', '1');
ini_set('zlib.output_compression', '0');

if (function_exists('apache_setenv')) {
  @apache_setenv('no-gzip', '1');
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Connection: close');

// JSON encode for PHP 5.2
if (!function_exists('json_encode')) {
  function json_encode($data) {
    if (is_null($data)) return 'null';
    if ($data === false) return 'false';
    if ($data === true) return 'true';
    
    if (is_scalar($data)) {
      if (is_float($data)) {
        return floatval(str_replace(',', '.', strval($data)));
      }
      if (is_string($data)) {
        $data = str_replace(array('\\', '/', '"', "\r", "\n", "\t"), 
                           array('\\\\', '\\/', '\\"', '\\r', '\\n', '\\t'), $data);
        return '"' . $data . '"';
      }
      return $data;
    }
    
    $isList = true;
    for ($i = 0, reset($data); $i < count($data); $i++, next($data)) {
      if (key($data) !== $i) {
        $isList = false;
        break;
      }
    }
    
    $result = array();
    if ($isList) {
      foreach ($data as $v) {
        $result[] = json_encode($v);
      }
      return '[' . join(',', $result) . ']';
    } else {
      foreach ($data as $k => $v) {
        $result[] = json_encode($k) . ':' . json_encode($v);
      }
      return '{' . join(',', $result) . '}';
    }
  }
}

if (!function_exists('json_decode')) {
  function json_decode($json, $assoc = false) {
    return null;
  }
}

// HTTP response code for PHP 5.2
function set_http_response_code($code) {
  if (function_exists('http_response_code')) {
    http_response_code($code);
    return;
  }
  
  $text = 'Unknown';
  if ($code == 200) {
    $text = 'OK';
  } else if ($code == 400) {
    $text = 'Bad Request';
  } else if ($code == 401) {
    $text = 'Unauthorized';
  } else if ($code == 500) {
    $text = 'Internal Server Error';
  }
  
  header("HTTP/1.1 " . $code . " " . $text);
  header("Status: " . $code . " " . $text);
}

// Error handler
function error_handler($errno, $errstr, $errfile, $errline) {
  if (DEBUG_MODE) {
    $error_info = array(
      'ok' => false,
      'error' => 'php_error',
      'message' => $errstr,
      'file' => $errfile,
      'line' => $errline,
      'type' => $errno
    );
    set_http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($error_info);
    exit;
  }
  return false;
}
set_error_handler('error_handler');

// Respond function
function respond($arr, $code) {
  if ($code === null) {
    $code = 200;
  }
  
  set_http_response_code($code);
  $json = json_encode($arr);
  
  if ($json === false || $json === null) {
    set_http_response_code(500);
    $json = '{"ok":false,"error":"json_encode_failed"}';
  }
  
  header('Content-Length: ' . strlen($json));
  echo $json;
  exit;
}

// Get environment variable
function get_env($k) {
  $v = getenv($k);
  if ($v === false) {
    return '';
  }
  return $v;
}

// Safe string comparison for PHP 5.2
function safe_strcmp($a, $b) {
  if (function_exists('hash_equals')) {
    return hash_equals($a, $b);
  }
  
  $diff = strlen($a) ^ strlen($b);
  $len = min(strlen($a), strlen($b));
  for ($i = 0; $i < $len; $i++) {
    $diff = $diff | (ord($a[$i]) ^ ord($b[$i]));
  }
  return $diff === 0;
}

// Token authentication
function require_token() {
  if (!REQUIRE_AUTH) {
    return;
  }
  
  $expected = 'e7ec8fad891d477d5cf2dcdaa7f0e1cb';
  
  if ($expected === '') {
    $expected = 'e7ec8fad891d477d5cf2dcdaa7f0e1cb';
  }
  
  $got = '';
  if (isset($_SERVER['HTTP_X_STORAGE_TOKEN'])) {
    $got = $_SERVER['HTTP_X_STORAGE_TOKEN'];
  }
  
  if ($expected === '' || $got === '' || !safe_strcmp($expected, $got)) {
    respond(array('ok' => false, 'error' => 'unauthorized'), 401);
  }
}

require_token();

$action = '';
if (isset($_GET['action'])) {
  $action = $_GET['action'];
}

$raw = file_get_contents('php://input');
$payload = array();

if ($raw) {
  $tmp = json_decode($raw, true);
  if (is_array($tmp)) {
    $payload = $tmp;
  }
}

// DB CONFIG
$dbHost = get_env('DB_HOST');
if ($dbHost === '') {
  $dbHost = 'localhost';
}

$dbPort = get_env('DB_PORT');
if ($dbPort === '') {
  $dbPort = '3306';
}

$dbUser = get_env('DB_USER');
if ($dbUser === '') {
  $dbUser = 'she0303';
}

$dbPass = get_env('DB_PASS');
if ($dbPass === '') {
  $dbPass = 'ksr671019';
}

$dbName = get_env('DB_NAME');
if ($dbName === '') {
  $dbName = 'she0303';
}

if ($dbUser === '' || $dbName === '') {
  respond(array('ok' => false, 'error' => 'db_config_missing'), 500);
}

$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName, intval($dbPort));

if ($mysqli->connect_errno) {
  respond(array('ok' => false, 'error' => 'db_connect_failed', 'detail' => $mysqli->connect_error), 500);
}

$mysqli->set_charset('utf8');

function now_mysql() {
  return date('Y-m-d H:i:s');
}

// start_dm action
if ($action === 'start_dm') {
  $a = '';
  if (isset($payload['user_a'])) {
    $a = $payload['user_a'];
  }
  
  $b = '';
  if (isset($payload['user_b'])) {
    $b = $payload['user_b'];
  }
  
  if ($a === '' || $b === '') {
    respond(array('ok' => false, 'error' => 'missing_users'), 400);
  }
  
  $stmt = $mysqli->prepare(
    "SELECT c.id
     FROM chat_conversations c
     JOIN chat_participants p1 ON p1.conversation_id=c.id AND p1.user_id=?
     JOIN chat_participants p2 ON p2.conversation_id=c.id AND p2.user_id=?
     WHERE c.type='dm'
     LIMIT 1"
  );
  
  if (!$stmt) {
    respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
  }
  
  $stmt->bind_param("ss", $a, $b);
  $stmt->execute();
  $stmt->bind_result($conv_id);
  
  if ($stmt->fetch()) {
    $stmt->close();
    respond(array('ok' => true, 'conversation_id' => intval($conv_id)), 200);
  }
  $stmt->close();
  
  $t = now_mysql();
  $stmt = $mysqli->prepare("INSERT INTO chat_conversations (type, created_at) VALUES ('dm', ?)");
  
  if (!$stmt) {
    respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
  }
  
  $stmt->bind_param("s", $t);
  $stmt->execute();
  $cid = intval($mysqli->insert_id);
  $stmt->close();
  
  $stmt = $mysqli->prepare("INSERT INTO chat_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)");
  
  if (!$stmt) {
    respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
  }
  
  $stmt->bind_param("isis", $cid, $a, $cid, $b);
  $stmt->execute();
  $stmt->close();
  
  respond(array('ok' => true, 'conversation_id' => $cid), 200);
}

// conversations action
if ($action === 'conversations') {
  $user = '';
  
  if (isset($_GET['user'])) {
    $user = $_GET['user'];
  } else if (isset($payload['user'])) {
    $user = $payload['user'];
  }
  
  if ($user === '') {
    respond(array('ok' => false, 'error' => 'missing_user'), 400);
  }
  
  $stmt = $mysqli->prepare(
    "SELECT c.id, c.type, c.created_at,
      (SELECT m.body FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
      (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_at
     FROM chat_conversations c
     JOIN chat_participants p ON p.conversation_id=c.id
     WHERE p.user_id=?
     ORDER BY COALESCE(last_at, c.created_at) DESC
     LIMIT 200"
  );
  
  if (!$stmt) {
    respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
  }
  
  $stmt->bind_param("s", $user);
  $stmt->execute();
  $stmt->bind_result($id, $type, $created_at, $last_body, $last_at);
  
  $items = array();
  while ($stmt->fetch()) {
    $items[] = array(
      'id' => $id,
      'type' => $type,
      'created_at' => $created_at,
      'last_body' => $last_body,
      'last_at' => $last_at
    );
  }
  
  $stmt->close();
  respond(array('ok' => true, 'items' => $items), 200);
}

// messages action
if ($action === 'messages') {
  $cid = 0;
  
  if (isset($_GET['conversation_id'])) {
    $cid = intval($_GET['conversation_id']);
  } else if (isset($payload['conversation_id'])) {
    $cid = intval($payload['conversation_id']);
  }
  
  $after = 0;
  
  if (isset($_GET['after_id'])) {
    $after = intval($_GET['after_id']);
  } else if (isset($payload['after_id'])) {
    $after = intval($payload['after_id']);
  }
  
  if ($cid <= 0) {
    respond(array('ok' => false, 'error' => 'missing_conversation_id'), 400);
  }
  
  if ($after > 0) {
    $stmt = $mysqli->prepare("SELECT id, conversation_id, sender_id, body, file_url, created_at FROM chat_messages WHERE conversation_id=? AND id>? ORDER BY id ASC LIMIT 500");
    if (!$stmt) {
      respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
    }
    $stmt->bind_param("ii", $cid, $after);
  } else {
    $stmt = $mysqli->prepare("SELECT id, conversation_id, sender_id, body, file_url, created_at FROM chat_messages WHERE conversation_id=? ORDER BY id ASC LIMIT 200");
    if (!$stmt) {
      respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
    }
    $stmt->bind_param("i", $cid);
  }
  
  $stmt->execute();
  $stmt->bind_result($id, $conversation_id, $sender_id, $body, $file_url, $created_at);
  
  $items = array();
  while ($stmt->fetch()) {
    $items[] = array(
      'id' => $id,
      'conversation_id' => $conversation_id,
      'sender_id' => $sender_id,
      'body' => $body,
      'file_url' => $file_url,
      'created_at' => $created_at
    );
  }
  
  $stmt->close();
  respond(array('ok' => true, 'items' => $items), 200);
}

// send action
if ($action === 'send') {
  $cid = 0;
  if (isset($payload['conversation_id'])) {
    $cid = intval($payload['conversation_id']);
  }
  
  $sender = '';
  if (isset($payload['sender_id'])) {
    $sender = $payload['sender_id'];
  }
  
  $text = '';
  if (isset($payload['text'])) {
    $text = $payload['text'];
  }
  
  $fileUrl = '';
  if (isset($payload['file_url'])) {
    $fileUrl = $payload['file_url'];
  }
  
  if ($cid <= 0 || $sender === '') {
    respond(array('ok' => false, 'error' => 'missing_fields'), 400);
  }
  
  if ($text === '' && $fileUrl === '') {
    respond(array('ok' => false, 'error' => 'empty_message'), 400);
  }
  
  $t = now_mysql();
  $stmt = $mysqli->prepare("INSERT INTO chat_messages (conversation_id, sender_id, body, file_url, created_at) VALUES (?, ?, ?, ?, ?)");
  
  if (!$stmt) {
    respond(array('ok' => false, 'error' => 'prepare_failed', 'detail' => $mysqli->error), 500);
  }
  
  $stmt->bind_param("issss", $cid, $sender, $text, $fileUrl, $t);
  $stmt->execute();
  $insert_id = intval($mysqli->insert_id);
  $stmt->close();
  
  respond(array('ok' => true, 'id' => $insert_id), 200);
}

$mysqli->close();

respond(array('ok' => false, 'error' => 'unknown_action'), 400);