<?php
declare(strict_types=1);

const ACCOUNT_ORIGIN = 'https://olympiads.pro';
const SESSION_LIFETIME = 1209600;
const RESET_LIFETIME = 1800;
const EMAIL_CONFIRM_LIFETIME = 86400;
const BCRYPT_COST = 12;
const PROGRESS_BODY_LIMIT = 524288;
const PROGRESS_TOTAL_LIMIT = 4194304;
const PROGRESS_TASK_LIMIT = 8192;
const PROGRESS_ARTIFACT_LIMIT = 24576;
const LESSON_KEY_PATTERN = '[0-9]{4}(?:-[a-z0-9]{1,12}){1,7}/[1-9][0-9]{0,2}';
const MAX_NUMERIC_ANSWER = 999999;

final class AccountError extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly array $data = [],
    ) {
        parent::__construct($message);
    }
}

function reply(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
}

function inDirectory(string $path, string $directory): bool
{
    return $path === $directory || str_starts_with($path, $directory . DIRECTORY_SEPARATOR);
}

function privateDirectory(string $directory): string
{
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('private directory unavailable');
    }
    $resolved = realpath($directory);
    $mode = $resolved === false ? false : fileperms($resolved);
    if ($resolved === false || $mode === false || ($mode & 0077) !== 0) {
        throw new RuntimeException('private directory permissions');
    }
    return $resolved;
}

function openAccountDatabase(string $path): PDO
{
    $db = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA busy_timeout = 5000');
    $db->exec('PRAGMA foreign_keys = ON');
    $version = (int) $db->query('PRAGMA user_version')->fetchColumn();
    if ($version > 2) {
        throw new RuntimeException('unsupported account database version');
    }
    $hasAccountExtensions = $db->query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'account_mail'")->fetchColumn();
    if ($version === 2 && $hasAccountExtensions) {
        return $db;
    }
    // Take the migration lock before reading the version again. Other first
    // requests wait for the whole schema and see the committed result.
    $db->exec('BEGIN IMMEDIATE');
    try {
        $version = (int) $db->query('PRAGMA user_version')->fetchColumn();
        if ($version === 0) {
            $db->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL,
                    username_key TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    session_version INTEGER NOT NULL DEFAULT 1,
                    reset_digest TEXT UNIQUE,
                    reset_expires INTEGER,
                    progress_revision INTEGER NOT NULL DEFAULT 0,
                    progress_json TEXT NOT NULL DEFAULT '{}'
                );
                CREATE TABLE IF NOT EXISTS auth_limits (
                    digest TEXT NOT NULL,
                    expires INTEGER NOT NULL,
                    hits INTEGER NOT NULL,
                    PRIMARY KEY (digest, expires)
                );
                CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits (expires);
                CREATE TABLE IF NOT EXISTS auth_settings (
                    name TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                SQL);
            $db->prepare("INSERT OR IGNORE INTO auth_settings VALUES ('limit_secret', ?)")
                ->execute([bin2hex(random_bytes(32))]);
            $db->exec('PRAGMA user_version = 1');
        }
        if ($version < 2) {
            $db->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS account_scores (
                    account_id INTEGER PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
                    points INTEGER NOT NULL,
                    solved INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS account_scores_rank ON account_scores (points DESC);
                SQL);
            rebuildAccountScores($db);
            $db->exec('PRAGMA user_version = 2');
        }
        // Add compatible tables without changing the version understood by the
        // previous release. The flat progress column remains its rollback view.
        if (!$db->query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'account_mail'")->fetchColumn()) {
            $db->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS account_task_records (
                    account_id INTEGER PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
                    revision INTEGER NOT NULL,
                    records_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS account_mail (
                    account_id INTEGER PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
                    confirmed INTEGER NOT NULL DEFAULT 0,
                    allow_legacy_recovery INTEGER NOT NULL DEFAULT 0,
                    pending_email TEXT,
                    confirm_digest TEXT UNIQUE,
                    confirm_expires INTEGER
                );
                SQL);
        }
        $db->exec('COMMIT');
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
    return $db;
}

function startAccountSession(string $directory): void
{
    session_name('__Host-kenguru_account');
    if (!session_start([
        'save_handler' => 'files',
        'save_path' => $directory,
        'use_strict_mode' => 1,
        'use_only_cookies' => 1,
        'use_trans_sid' => 0,
        'cookie_lifetime' => SESSION_LIFETIME,
        'cookie_path' => '/',
        'cookie_domain' => '',
        'cookie_secure' => true,
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'gc_maxlifetime' => SESSION_LIFETIME,
        'gc_probability' => 1,
        'gc_divisor' => 100,
        'cache_limiter' => '',
    ])) {
        throw new RuntimeException('session unavailable');
    }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function rotateAccountSession(?array $account = null): void
{
    $_SESSION = [];
    if (!session_regenerate_id(true)) {
        throw new RuntimeException('session rotation failed');
    }
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    if ($account !== null) {
        $_SESSION['user_id'] = (int) $account['id'];
        $_SESSION['version'] = (int) $account['session_version'];
        $_SESSION['expires'] = time() + SESSION_LIFETIME;
    }
}

function accountForSession(PDO $db): ?array
{
    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    $lookup = $db->prepare(<<<'SQL'
        SELECT a.id, a.username, a.session_version, a.email, COALESCE(m.confirmed, 0) AS email_confirmed,
               m.pending_email
        FROM accounts a LEFT JOIN account_mail m ON m.account_id = a.id WHERE a.id = ?
        SQL);
    $lookup->execute([$_SESSION['user_id']]);
    $account = $lookup->fetch();
    if (!$account || (int) $account['session_version'] !== $_SESSION['version'] || time() >= ($_SESSION['expires'] ?? 0)) {
        rotateAccountSession();
        return null;
    }
    return $account;
}

function sessionPayload(?array $account): array
{
    return [
        'user' => $account === null ? null : [
            'id' => (int) $account['id'], 'username' => $account['username'], 'email' => $account['email'],
            'emailConfirmed' => (bool) $account['email_confirmed'], 'pendingEmail' => $account['pending_email'],
        ],
        'csrf' => $_SESSION['csrf'],
    ];
}

function getPayload(int $limit): stdClass
{
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
    if ($type !== 'application/json') {
        throw new AccountError(415, 'Запрос должен быть в формате JSON.');
    }
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) {
        throw new AccountError(413, 'Запрос слишком большой.');
    }
    try {
        $payload = json_decode($raw, false, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        $payload = null;
    }
    if (!$payload instanceof stdClass) {
        throw new AccountError(400, 'Не удалось прочитать данные запроса.');
    }
    return $payload;
}

function field(stdClass $payload, string $key): string
{
    return is_string($payload->$key ?? null) ? $payload->$key : '';
}

function emailKey(string $email): string
{
    $email = strtolower(trim($email));
    return strlen($email) <= 254 && !preg_match('/[\x00-\x20\x7f,]/', $email)
        && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
}

function passwordAllowed(string $password): bool
{
    return strlen($password) <= 72 && !str_contains($password, "\0") && mb_strlen($password, 'UTF-8') >= 10;
}

function passwordDigest(string $password): string
{
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
}

function ratePermit(PDO $db, string $secret, string $bucket, int $limit, int $window): bool
{
    $expires = (intdiv(time(), $window) + 1) * $window;
    $update = $db->prepare(<<<'SQL'
        INSERT INTO auth_limits (digest, expires, hits) VALUES (:digest, :expires, 1)
        ON CONFLICT (digest, expires) DO UPDATE SET hits = hits + 1 WHERE hits < :limit
        SQL);
    $update->bindValue(':digest', hash_hmac('sha256', $bucket, $secret));
    $update->bindValue(':expires', $expires, PDO::PARAM_INT);
    $update->bindValue(':limit', $limit, PDO::PARAM_INT);
    $update->execute();
    return $update->rowCount() === 1;
}

function enforceRate(PDO $db, string $secret, string $bucket, int $limit, int $window): void
{
    if (!ratePermit($db, $secret, $bucket, $limit, $window)) {
        throw new AccountError(429, 'Слишком много попыток. Попробуй чуть позже.');
    }
}

function registerAccount(PDO $db, stdClass $data, string $sender): array
{
    $username = trim(field($data, 'username'));
    $email = emailKey(field($data, 'email'));
    $password = field($data, 'password');
    if (!preg_match('/\A[\p{Latin}\p{Cyrillic}0-9_-]{3,24}\z/u', $username)) {
        throw new AccountError(422, 'Логин должен содержать от 3 до 24 букв, цифр, дефисов или знаков подчёркивания.');
    }
    if ($email === '') {
        throw new AccountError(422, 'Введи действующий адрес электронной почты.');
    }
    if (!passwordAllowed($password)) {
        throw new AccountError(422, 'Пароль должен содержать не менее 10 символов и занимать не более 72 байт.');
    }
    $db->beginTransaction();
    $insert = $db->prepare(<<<'SQL'
        INSERT INTO accounts (username, username_key, email, password_hash) VALUES (?, ?, ?, ?)
        ON CONFLICT DO NOTHING
        SQL);
    $insert->execute([$username, mb_strtolower($username, 'UTF-8'), $email, passwordDigest($password)]);
    if ($insert->rowCount() === 0) {
        $db->rollBack();
        throw new AccountError(409, 'Не удалось создать аккаунт с этими данными. Проверь логин или восстанови пароль.');
    }
    $account = [
        'id' => (int) $db->lastInsertId(), 'username' => $username, 'session_version' => 1,
        'email' => $email, 'email_confirmed' => 0, 'pending_email' => null,
    ];
    $db->prepare('INSERT INTO account_mail (account_id) VALUES (?)')->execute([$account['id']]);
    $db->commit();
    rotateAccountSession($account);
    return sessionPayload($account) + ['message' => startEmailConfirmation($db, $account, $sender)];
}

function loginAccount(PDO $db, stdClass $data, string $secret): array
{
    $login = mb_strtolower(trim(field($data, 'login')), 'UTF-8');
    $password = field($data, 'password');
    if ($login === '' || strlen($login) > 254 || !passwordAllowed($password)) {
        throw new AccountError(401, 'Проверь логин и пароль.');
    }
    enforceRate($db, $secret, 'login-id:' . $login, 12, 900);
    $column = str_contains($login, '@') ? 'email' : 'username_key';
    $lookup = $db->prepare("SELECT id, username, session_version, password_hash FROM accounts WHERE $column = ?");
    $lookup->execute([$login]);
    $account = $lookup->fetch();
    // Give unknown logins the same verification work.
    $dummy = '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    if (!password_verify($password, $account['password_hash'] ?? $dummy) || !$account) {
        throw new AccountError(401, 'Проверь логин и пароль.');
    }
    rotateAccountSession($account);
    return sessionPayload(accountForSession($db));
}

function sendAccountMail(string $email, string $subject, string $body, string $sender): bool
{
    $subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    try {
        return function_exists('mail') && @mail($email, $subject, $body, [
            'From' => $sender,
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Transfer-Encoding' => '8bit',
        ], '-f' . $sender);
    } catch (Throwable) {
        return false;
    }
}

function startEmailConfirmation(PDO $db, array $account, string $sender): string
{
    $email = $account['pending_email'] ?? $account['email'];
    if ($account['email_confirmed'] && $account['pending_email'] === null) {
        return 'Этот адрес уже подтверждён.';
    }
    $token = bin2hex(random_bytes(32));
    $save = $db->prepare(<<<'SQL'
        INSERT INTO account_mail (account_id, allow_legacy_recovery, confirm_digest, confirm_expires)
        SELECT id, 1, ?, ? FROM accounts WHERE id = ? AND email = ? AND session_version = ?
        ON CONFLICT (account_id) DO UPDATE
        SET confirm_digest = excluded.confirm_digest, confirm_expires = excluded.confirm_expires
        WHERE account_mail.pending_email IS ? AND (account_mail.pending_email IS NOT NULL OR account_mail.confirmed = 0)
        SQL);
    $save->execute([
        hash('sha256', $token), time() + EMAIL_CONFIRM_LIFETIME, $account['id'], $account['email'],
        $account['session_version'], $account['pending_email'],
    ]);
    if ($save->rowCount() === 0) {
        return 'Данные почты изменились. Открой профиль ещё раз.';
    }
    $link = ACCOUNT_ORIGIN . '/#confirm-email=' . $token;
    $body = "Чтобы подтвердить этот адрес для olympiads.pro, открой ссылку:\r\n\r\n"
        . $link . "\r\n\r\nСсылка действует сутки. Если ты не запрашивал подтверждение, проигнорируй письмо.\r\n";
    return sendAccountMail($email, 'Подтверждение адреса', $body, $sender)
        ? 'Письмо для подтверждения отправлено.'
        : 'Почта временно недоступна. Запроси письмо ещё раз в профиле.';
}

function confirmEmail(PDO $db, stdClass $data): void
{
    $token = field($data, 'token');
    $invalid = 'Ссылка недействительна или уже использована. Запроси новую в профиле.';
    if (!preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        throw new AccountError(422, $invalid);
    }
    $digest = hash('sha256', $token);
    $db->exec('BEGIN IMMEDIATE');
    try {
        $lookup = $db->prepare('SELECT account_id, pending_email FROM account_mail WHERE confirm_digest = ? AND confirm_expires > ?');
        $lookup->execute([$digest, time()]);
        $mail = $lookup->fetch();
        if (!$mail) {
            throw new AccountError(422, $invalid);
        }
        if ($mail['pending_email'] !== null) {
            $update = $db->prepare(<<<'SQL'
                UPDATE OR IGNORE accounts SET email = ?, reset_digest = NULL, reset_expires = NULL WHERE id = ?
                SQL);
            $update->execute([$mail['pending_email'], $mail['account_id']]);
            if ($update->rowCount() === 0) {
                throw new AccountError(409, 'Этот адрес уже связан с другим аккаунтом. Укажи другой адрес.');
            }
        }
        $db->prepare(<<<'SQL'
            UPDATE account_mail SET confirmed = 1, allow_legacy_recovery = 0, pending_email = NULL,
                confirm_digest = NULL, confirm_expires = NULL WHERE account_id = ?
            SQL)->execute([$mail['account_id']]);
        $db->exec('COMMIT');
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

function requirePassword(PDO $db, array $account, stdClass $data): void
{
    $lookup = $db->prepare('SELECT password_hash FROM accounts WHERE id = ? AND session_version = ?');
    $lookup->execute([$account['id'], $account['session_version']]);
    $password = field($data, 'password');
    $hash = $lookup->fetchColumn();
    if ($hash === false || !passwordAllowed($password) || !password_verify($password, $hash)) {
        throw new AccountError(422, 'Проверь текущий пароль.');
    }
}

function editAccount(PDO $db, array $account, stdClass $data, string $sender): array
{
    requirePassword($db, $account, $data);
    $username = trim(field($data, 'username'));
    $email = emailKey(field($data, 'email'));
    if (!preg_match('/\A[\p{Latin}\p{Cyrillic}0-9_-]{3,24}\z/u', $username) || $email === '') {
        throw new AccountError(422, 'Проверь имя пользователя и адрес электронной почты.');
    }
    $pending = $email === $account['email'] ? null : $email;
    $mailChanged = $pending !== $account['pending_email'];
    $db->exec('BEGIN IMMEDIATE');
    try {
        $update = $db->prepare('UPDATE OR IGNORE accounts SET username = ?, username_key = ? WHERE id = ? AND session_version = ?');
        $update->execute([$username, mb_strtolower($username, 'UTF-8'), $account['id'], $account['session_version']]);
        if ($update->rowCount() === 0) {
            throw new AccountError(409, 'Не удалось сохранить имя. Попробуй другое имя.');
        }
        if ($mailChanged) {
            $lookup = $db->prepare('SELECT 1 FROM accounts WHERE email = ? AND id <> ?');
            $lookup->execute([$pending, $account['id']]);
            $pendingUpdate = $db->prepare(<<<'SQL'
                INSERT OR IGNORE INTO account_mail (account_id, allow_legacy_recovery, pending_email)
                VALUES (?, 1, ?)
                ON CONFLICT (account_id) DO UPDATE SET pending_email = excluded.pending_email,
                    confirm_digest = NULL, confirm_expires = NULL
                SQL);
            if ($lookup->fetchColumn()) {
                throw new AccountError(409, 'Не удалось сохранить адрес. Проверь его или укажи другой.');
            }
            $pendingUpdate->execute([$account['id'], $pending]);
            if ($pendingUpdate->rowCount() === 0) {
                throw new AccountError(409, 'Не удалось сохранить адрес. Проверь его или укажи другой.');
            }
        }
        $db->exec('COMMIT');
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
    $account = accountForSession($db);
    $message = 'Данные профиля сохранены.';
    if ($mailChanged && $pending !== null) {
        $message .= ' ' . startEmailConfirmation($db, $account, $sender);
    }
    return sessionPayload($account) + ['message' => $message];
}

function deleteAccount(PDO $db, array $account, stdClass $data): array
{
    requirePassword($db, $account, $data);
    if (($data->confirm ?? null) !== true) {
        throw new AccountError(422, 'Подтверди удаление аккаунта.');
    }
    $delete = $db->prepare('DELETE FROM accounts WHERE id = ? AND session_version = ?');
    $delete->execute([$account['id'], $account['session_version']]);
    rotateAccountSession();
    return sessionPayload(null) + ['message' => 'Аккаунт и данные удалены.'];
}

function requestPasswordReset(PDO $db, stdClass $data, string $secret, string $sender): void
{
    $started = hrtime(true);
    $email = emailKey(field($data, 'email'));
    $token = bin2hex(random_bytes(32));
    $digest = hash('sha256', $token);
    $message = ['message' => 'Если этот адрес связан с аккаунтом, мы отправим ссылку для восстановления пароля.'];
    $willSend = false;
    if ($email !== '' && ratePermit($db, $secret, 'reset-email:' . $email, 3, 3600)) {
        $update = $db->prepare(<<<'SQL'
            UPDATE accounts SET reset_digest = ?, reset_expires = ? WHERE email = ? AND NOT EXISTS (
                SELECT 1 FROM account_mail WHERE account_id = accounts.id AND confirmed = 0 AND allow_legacy_recovery = 0
            )
            SQL);
        $update->execute([$digest, time() + RESET_LIFETIME, $email]);
        $willSend = $update->rowCount() === 1;
    }
    session_write_close();
    $finishEarly = function_exists('fastcgi_finish_request');
    if ($finishEarly) {
        // Finish the FastCGI response before invoking sendmail so delivery time stays private.
        waitForResetResponse($started, 150000);
        reply(200, $message);
        fastcgi_finish_request();
    }
    $link = ACCOUNT_ORIGIN . '/#reset=' . $token;
    $body = "Чтобы задать новый пароль для olympiads.pro, открой ссылку:\r\n\r\n"
        . $link . "\r\n\r\nСсылка действует 30 минут. Если ты не запрашивал восстановление, проигнорируй письмо.\r\n";
    if ($willSend && !sendAccountMail($email, 'Восстановление пароля', $body, $sender)) {
        error_log('olympiads auth: password reset mail rejected by local mailer');
    }
    if (!$finishEarly) {
        waitForResetResponse($started, 350000);
        reply(200, $message);
    }
}

function waitForResetResponse(int $started, int $minimumMicroseconds): void
{
    $remaining = $minimumMicroseconds - intdiv(hrtime(true) - $started, 1000);
    if ($remaining > 0) {
        usleep($remaining);
    }
}

function resetPassword(PDO $db, stdClass $data): array
{
    $token = field($data, 'token');
    $password = field($data, 'password');
    if (!preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        throw new AccountError(422, 'Ссылка недействительна или уже использована. Запроси новую.');
    }
    if (!passwordAllowed($password)) {
        throw new AccountError(422, 'Пароль должен содержать не менее 10 символов и занимать не более 72 байт.');
    }
    $update = $db->prepare(<<<'SQL'
        UPDATE accounts
        SET password_hash = ?, session_version = session_version + 1,
            reset_digest = NULL, reset_expires = NULL
        WHERE reset_digest = ? AND reset_expires > ?
        SQL);
    $update->execute([passwordDigest($password), hash('sha256', $token), time()]);
    if ($update->rowCount() === 0) {
        throw new AccountError(422, 'Ссылка недействительна или уже использована. Запроси новую.');
    }
    rotateAccountSession();
    return sessionPayload(null) + ['message' => 'Пароль изменён. Войди с новым паролем.'];
}

function validDrawingCoordinates(mixed $coordinates, int $dimensions): bool
{
    if (!is_array($coordinates) || count($coordinates) !== $dimensions) {
        return false;
    }
    foreach ($coordinates as $coordinate) {
        if ((!is_int($coordinate) && !is_float($coordinate)) || abs($coordinate) > 4096) {
            return false;
        }
    }
    return true;
}

function validDrawing(mixed $marks): bool
{
    if (!is_array($marks) || count($marks) > 500) {
        return false;
    }
    foreach ($marks as $mark) {
        if (!$mark instanceof stdClass
            || !in_array($mark->type ?? null, ['pen', 'line', 'arrow', 'ladder', 'fill'], true)
            || !is_string($mark->color ?? null)
            || !preg_match('/\A#[a-f0-9]{6}\z/i', $mark->color)
            || array_diff(array_keys(get_object_vars($mark)), ['type', 'color', 'points', 'cells'])
            || ($mark->type === 'fill' && !is_array($mark->cells ?? null))) {
            return false;
        }
        $points = $mark->points ?? [];
        $cells = $mark->cells ?? [];
        if (!is_array($points) || count($points) > 5000 || !is_array($cells) || count($cells) > 500) {
            return false;
        }
        foreach ($points as $coordinates) {
            if (!validDrawingCoordinates($coordinates, 2)) {
                return false;
            }
        }
        foreach ($cells as $coordinates) {
            if (!validDrawingCoordinates($coordinates, 4)) {
                return false;
            }
        }
    }
    return true;
}

function numericRating(string $lesson): bool
{
    return (ratingCatalog()[$lesson][2] ?? null) === 'number';
}

function validRatingAnswer(mixed $answer, string $lesson): bool
{
    return is_int($answer) && $answer >= 0 && $answer <= (numericRating($lesson) ? MAX_NUMERIC_ANSWER : 4);
}

function validLessonProgress(mixed $progress, string $lesson): bool
{
    $maxChoice = numericRating($lesson) ? MAX_NUMERIC_ANSWER : 50;
    return $progress instanceof stdClass
        && !array_diff(array_keys(get_object_vars($progress)), ['step', 'selected', 'seen', 'reviewOpened'])
        && is_int($progress->step ?? null) && $progress->step >= 0 && $progress->step <= 500
        && property_exists($progress, 'selected')
        && ($progress->selected === null || (is_int($progress->selected) && $progress->selected >= 0 && $progress->selected <= $maxChoice))
        && is_bool($progress->seen ?? null)
        && (!property_exists($progress, 'reviewOpened') || is_bool($progress->reviewOpened));
}

function preserveLessonReview(string $previous, string $incoming): string
{
    $saved = json_decode($previous, false, 12, JSON_THROW_ON_ERROR);
    $next = json_decode($incoming, false, 12, JSON_THROW_ON_ERROR);
    $seen = $saved->seen || $next->seen;
    $reviewOpened = ($saved->reviewOpened ?? false) || ($next->reviewOpened ?? false)
        || $saved->step > 0 || $next->step > 0;
    if ($next->seen === $seen && ($next->reviewOpened ?? false) === $reviewOpened) {
        return $incoming;
    }
    $next->seen = $seen;
    $next->reviewOpened = $reviewOpened;
    return json_encode($next, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
}

function validProgressEntry(string $key, mixed $value): bool
{
    $lesson = LESSON_KEY_PATTERN;
    if (!is_string($value) || strlen($value) > 262144) {
        return false;
    }
    if (preg_match('~\Arating:' . $lesson . '\z~', $key)) {
        return in_array($value, ['solved', 'reviewed'], true);
    }
    try {
        $parsed = json_decode($value, false, 12, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return false;
    }
    if (in_array($key, ['current', 'current:math', 'current:ru', 'current:british-bulldog', 'current:golden-fleece', 'current:kit', 'current:chip'], true)) {
        return is_string($parsed) && preg_match('~\A' . $lesson . '\z~', $parsed);
    }
    if (preg_match('~\A' . $lesson . '\z~', $key)) {
        return strlen($value) <= 512 && validLessonProgress($parsed, $key);
    }
    if (preg_match('~\Anotes:' . $lesson . '\z~', $key)) {
        return is_string($parsed) && strlen($parsed) <= 16000;
    }
    if (preg_match('~\A(?:paper:' . $lesson . ':(?:plain|grid)|scene:' . $lesson . ':[0-9]{1,3}:[0-9]?)\z~', $key)) {
        return validDrawing($parsed);
    }
    return false;
}

function ratingCatalog(): array
{
    static $catalog = null;
    if ($catalog === null) {
        $encoded = file_get_contents(__DIR__ . '/rating-catalog.json');
        if ($encoded === false) {
            throw new RuntimeException('rating catalogue unavailable');
        }
        $catalog = json_decode($encoded, true, 8, JSON_THROW_ON_ERROR);
    }
    return $catalog;
}

function saveAccountScore(PDO $db, int $accountId, stdClass $progress): void
{
    $catalog = ratingCatalog();
    $points = 0;
    $solved = 0;
    foreach ($progress as $key => $value) {
        if ($value !== 'solved' || !str_starts_with($key, 'rating:')) {
            continue;
        }
        $lesson = $catalog[substr($key, strlen('rating:'))] ?? null;
        if ($lesson !== null) {
            $points += $lesson[1];
            $solved++;
        }
    }
    $db->prepare(<<<'SQL'
        INSERT INTO account_scores (account_id, points, solved) VALUES (?, ?, ?)
        ON CONFLICT (account_id) DO UPDATE SET points = excluded.points, solved = excluded.solved
        SQL)->execute([$accountId, $points, $solved]);
}

function rebuildAccountScores(PDO $db): void
{
    $records = $db->query("SELECT id, progress_json FROM accounts WHERE progress_json <> '{}'");
    while ($record = $records->fetch()) {
        $progress = json_decode($record['progress_json'], false, 12, JSON_THROW_ON_ERROR);
        saveAccountScore($db, (int) $record['id'], $progress);
    }
}

// Scores are cached separately from confirmed solves. Rebuild them once per
// catalogue so even accounts that have been inactive move to their new rank.
function refreshLeaderboardScores(PDO $db): void
{
    $revision = hash('sha256', json_encode(ratingCatalog(), JSON_THROW_ON_ERROR));
    $saved = $db->query("SELECT value FROM auth_settings WHERE name = 'score_catalog'")->fetchColumn();
    if ($saved === $revision) {
        return;
    }
    $db->beginTransaction();
    try {
        $claim = $db->prepare(<<<'SQL'
            INSERT INTO auth_settings (name, value) VALUES ('score_catalog', ?)
            ON CONFLICT(name) DO UPDATE SET value = excluded.value
            WHERE value <> excluded.value
            SQL);
        $claim->execute([$revision]);
        if ($claim->rowCount() > 0) {
            rebuildAccountScores($db);
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

function independentRatingAnswer(string $lesson, stdClass $next, stdClass $saved, stdClass $claims): ?int
{
    $before = json_decode($saved->$lesson ?? 'null', false, 12, JSON_THROW_ON_ERROR);
    $submitted = json_decode($next->$lesson ?? 'null', false, 12, JSON_THROW_ON_ERROR);
    if (!isset(ratingCatalog()[$lesson][0]) || !validLessonProgress($submitted, $lesson)
        || ($submitted->step === 0 && !($submitted->reviewOpened ?? false))
        || ($before->seen ?? false) || ($before->reviewOpened ?? false) || ($before->step ?? 0) > 0) {
        return null;
    }
    $answer = $claims->$lesson ?? $submitted->selected;
    return validRatingAnswer($answer, $lesson) ? $answer : null;
}

function leaderboard(PDO $db, array $account): array
{
    $pageSize = 25;
    $page = filter_var($_GET['page'] ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($page === false) {
        throw new AccountError(422, 'Укажи номер страницы рейтинга.');
    }
    refreshLeaderboardScores($db);
    $db->beginTransaction();
    $total = (int) $db->query('SELECT COUNT(*) FROM accounts')->fetchColumn();
    $totalPages = max(1, (int) ceil($total / $pageSize));
    $page = min($page, $totalPages);
    $query = $db->prepare(<<<'SQL'
        WITH standings AS (
            SELECT a.id, a.username, a.username_key, COALESCE(s.points, 0) AS points,
                   COALESCE(s.solved, 0) AS solved
            FROM accounts a LEFT JOIN account_scores s ON s.account_id = a.id
        ), ranked AS (
            SELECT *, RANK() OVER (ORDER BY points DESC) AS place FROM standings
        )
        SELECT id, username, points, solved, place FROM ranked
        ORDER BY points DESC, solved DESC, username_key, id LIMIT ? OFFSET ?
        SQL);
    $query->bindValue(1, $pageSize, PDO::PARAM_INT);
    $query->bindValue(2, ($page - 1) * $pageSize, PDO::PARAM_INT);
    $query->execute();
    $serialize = static fn(array $row): array => [
        'rank' => (int) $row['place'],
        'username' => $row['username'],
        'points' => (int) $row['points'],
        'solved' => (int) $row['solved'],
        'isCurrent' => (int) $row['id'] === (int) $account['id'],
    ];
    $entries = array_map($serialize, $query->fetchAll());
    $own = $db->prepare(<<<'SQL'
        SELECT a.id, a.username, COALESCE(s.points, 0) AS points, COALESCE(s.solved, 0) AS solved,
               1 + (SELECT COUNT(*) FROM account_scores higher
                    WHERE higher.points > COALESCE(s.points, 0)) AS place
        FROM accounts a LEFT JOIN account_scores s ON s.account_id = a.id
        WHERE a.id = ?
        SQL);
    $own->execute([$account['id']]);
    $current = $serialize($own->fetch());
    $db->commit();
    return compact('entries', 'current', 'page', 'totalPages', 'total');
}

function progressForAccount(PDO $db, array $account, ?stdClass $data = null): array
{
    $expected = $data === null ? ($_GET['accountId'] ?? null) : ($data->accountId ?? null);
    if ($expected !== null && $expected !== (int) $account['id'] && $expected !== (string) $account['id']) {
        throw new AccountError(409, 'Аккаунт изменился. Обнови страницу.', sessionPayload($account));
    }
    $lookup = $db->prepare(<<<'SQL'
        SELECT a.progress_revision, a.progress_json, t.revision AS records_revision, t.records_json
        FROM accounts a LEFT JOIN account_task_records t ON t.account_id = a.id
        WHERE a.id = ? AND a.session_version = ?
        SQL);
    $lookup->execute([$account['id'], $account['session_version']]);
    $record = $lookup->fetch();
    if (!$record) {
        rotateAccountSession();
        throw new AccountError(401, 'Войди в аккаунт, чтобы сохранить прогресс.', sessionPayload(null));
    }
    $revision = (int) $record['progress_revision'];
    $progress = json_decode($record['progress_json'], false, 12, JSON_THROW_ON_ERROR);
    $result = ['revision' => $revision, 'progress' => $progress];
    if ($data === null) {
        return $result;
    }
    if (!is_int($data->revision ?? null) || $data->revision < 0
        || !(($data->progress ?? null) instanceof stdClass)
        || count(get_object_vars($data->progress)) > 2 * PROGRESS_TASK_LIMIT + PROGRESS_ARTIFACT_LIMIT) {
        throw new AccountError(422, 'Не удалось прочитать данные прогресса.');
    }
    if ($data->revision !== $revision) {
        throw new AccountError(409, 'Прогресс изменился на другом устройстве.', $result);
    }
    $claims = $data->ratingAnswers ?? new stdClass();
    if (!$claims instanceof stdClass || count(get_object_vars($claims)) > PROGRESS_TASK_LIMIT) {
        throw new AccountError(422, 'Не удалось прочитать первые ответы.');
    }
    foreach ($claims as $key => $answer) {
        if (!validRatingAnswer($answer, (string) $key) || !isset($data->progress->{'rating:' . $key})) {
            throw new AccountError(422, 'Не удалось прочитать первые ответы.');
        }
    }
    foreach ($data->progress as $key => $value) {
        if (!validProgressEntry($key, $value)) {
            throw new AccountError(422, 'Некоторые данные прогресса имеют неверный формат.');
        }
    }
    $saved = clone $progress;
    $existingTasks = json_decode($record['records_json'] ?? '{}', false, 12, JSON_THROW_ON_ERROR);
    $tasks = $record['records_revision'] === $revision ? $existingTasks : new stdClass();
    if ($tasks !== $existingTasks) {
        foreach ($saved as $key => $value) {
            if (preg_match('~\A(rating:)?(' . LESSON_KEY_PATTERN . ')\z~', $key, $parts)) {
                $lesson = $parts[2];
                $task = $tasks->$lesson ??= new stdClass();
                if ($parts[1] === '') {
                    $task->progress = $value;
                } else {
                    $task->rating = $value;
                    if (isset($existingTasks->$lesson->firstAnswer)) $task->firstAnswer = $existingTasks->$lesson->firstAnswer;
                }
            }
        }
    }
    $scoreChanged = false;
    foreach ($data->progress as $key => $value) {
        if (preg_match('~\A(rating:)?(' . LESSON_KEY_PATTERN . ')\z~', $key, $parts)) {
            $lesson = $parts[2];
            $task = $tasks->$lesson ??= new stdClass();
            if ($parts[1] === 'rating:') {
                if (isset($task->rating)) {
                    continue;
                }
                $firstAnswer = independentRatingAnswer($lesson, $data->progress, $saved, $claims);
                if ($firstAnswer !== null) {
                    $task->firstAnswer = $firstAnswer;
                }
                $correct = $firstAnswer !== null && $firstAnswer === ratingCatalog()[$lesson][0];
                $value = $value === 'solved' && $correct ? 'solved' : 'reviewed';
                $task->rating = $value;
                $scoreChanged = $scoreChanged || $value === 'solved';
            } else {
                $value = isset($task->progress) ? preserveLessonReview($task->progress, $value) : $value;
                $task->progress = $value;
            }
        }
        $progress->$key = $value;
    }
    $artifactCount = 0;
    foreach ($progress as $key => $value) {
        if (!preg_match('~\A(?:rating:)?' . LESSON_KEY_PATTERN . '\z~', $key)) {
            $artifactCount++;
        }
    }
    $encoded = json_encode($progress, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    if (strlen($encoded) > PROGRESS_TOTAL_LIMIT || count(get_object_vars($tasks)) > PROGRESS_TASK_LIMIT
        || $artifactCount > PROGRESS_ARTIFACT_LIMIT) {
        throw new AccountError(413, 'Достигнут предел хранения прогресса.');
    }
    if ($encoded === $record['progress_json'] && $tasks === $existingTasks) {
        return $result;
    }
    $changed = $encoded !== $record['progress_json'];
    $nextRevision = $revision + (int) $changed;
    $db->beginTransaction();
    $save = $db->prepare(<<<'SQL'
        UPDATE accounts SET progress_json = ?, progress_revision = ?
        WHERE id = ? AND progress_revision = ? AND session_version = ?
        SQL);
    $save->execute([$encoded, $nextRevision, $account['id'], $revision, $account['session_version']]);
    if ($save->rowCount() === 0) {
        $db->rollBack();
        throw new AccountError(409, 'Прогресс изменился на другом устройстве.', progressForAccount($db, $account));
    }
    $db->prepare(<<<'SQL'
        INSERT INTO account_task_records (account_id, revision, records_json) VALUES (?, ?, ?)
        ON CONFLICT (account_id) DO UPDATE SET revision = excluded.revision, records_json = excluded.records_json
        SQL)->execute([$account['id'], $nextRevision, json_encode($tasks, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    if ($scoreChanged) {
        saveAccountScore($db, (int) $account['id'], $progress);
    }
    $db->commit();
    return ['revision' => $nextRevision, 'progress' => $progress];
}

function routeAccountRequest(): void
{
    $https = $_SERVER['HTTPS'] ?? getenv('HTTPS', true);
    if ($https !== 'on' && $https !== '1') {
        throw new AccountError(403, 'Для входа в аккаунт требуется защищённое соединение.');
    }
    header('Strict-Transport-Security: max-age=300');
    if (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) !== '/api/auth.php') {
        throw new AccountError(404, 'Такой операции нет.');
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    $action = $_GET['action'] ?? 'session';
    $allowed = match ($action) {
        'session', 'leaderboard' => 'GET',
        'progress' => 'GET, POST',
        'register', 'login', 'logout', 'request-reset', 'reset',
            'verify-email', 'send-verification', 'edit-account', 'delete-account' => 'POST',
        default => '',
    };
    if ($allowed === '') {
        throw new AccountError(404, 'Такой операции нет.');
    }
    if (!in_array($method, explode(', ', $allowed), true)) {
        header('Allow: ' . $allowed);
        throw new AccountError(405, 'Этот метод запроса не поддерживается.');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? ACCOUNT_ORIGIN;
    if ($origin !== ACCOUNT_ORIGIN || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        throw new AccountError(403, 'Запрос с другого сайта отклонён.');
    }
    umask(0077);
    $home = dirname(__DIR__, 3);
    $www = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: dirname(__DIR__);
    // Prefer the actual DOCUMENT_ROOT to find the home if the API is accessed through a release symlink.
    $serverRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', DIRECTORY_SEPARATOR);
    if (basename(dirname($serverRoot)) === 'www') {
        $home = dirname($serverRoot, 2);
    }
    $configPath = realpath($home . '/olympiads-config.php');
    if ($configPath === false || inDirectory($configPath, $www) || !is_readable($configPath)
        || !extension_loaded('pdo_sqlite') || !extension_loaded('mbstring')) {
        throw new RuntimeException('account configuration unavailable');
    }
    $config = require $configPath;
    $sender = $config['mail_from'] ?? '';
    if (!is_string($sender) || emailKey($sender) === '' || !preg_match('/\A[a-z0-9_.+%@-]+\z/i', $sender)) {
        throw new RuntimeException('account mail sender misconfigured');
    }
    $path = $config['database'] ?? $home . '/.olympiads-auth/accounts.sqlite';
    if (!is_string($path) || !str_starts_with($path, '/') || str_contains($path, "\0")
        || !preg_match('/\A[A-Za-z0-9_.-]+\.sqlite\z/', basename($path))) {
        throw new RuntimeException('account database path misconfigured');
    }
    $directory = privateDirectory(dirname($path));
    $database = $directory . '/' . basename($path);
    if (inDirectory($directory, $www) || is_link($database) || (file_exists($database) && !is_file($database))) {
        throw new RuntimeException('account database requires a private path');
    }
    $sessionDirectory = privateDirectory($directory . '/sessions');
    if (inDirectory($sessionDirectory, $www) || dirname($sessionDirectory) !== $directory) {
        throw new RuntimeException('account sessions require a private path');
    }
    $db = openAccountDatabase($database);
    startAccountSession($sessionDirectory);
    $account = accountForSession($db);
    if ($method === 'GET') {
        if ($action === 'session') {
            reply(200, sessionPayload($account));
        } elseif ($account === null) {
            throw new AccountError(401, 'Войди в аккаунт, чтобы сохранить прогресс.', sessionPayload(null));
        } elseif ($action === 'leaderboard') {
            reply(200, leaderboard($db, $account));
        } else {
            reply(200, progressForAccount($db, $account));
        }
        return;
    }
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        throw new AccountError(403, 'Сессия обновилась. Повтори действие.', ['csrf' => $_SESSION['csrf']]);
    }
    $data = getPayload($action === 'progress' ? PROGRESS_BODY_LIMIT : 8192);
    if (isset($data->accountId) && $action !== 'progress' && $data->accountId !== (int) ($account['id'] ?? 0)) {
        throw new AccountError(409, 'Аккаунт изменился. Открой профиль ещё раз.', sessionPayload($account));
    }
    if ($action === 'logout') {
        rotateAccountSession();
        reply(200, sessionPayload(null) + ['message' => 'Ты вышел из аккаунта.']);
        return;
    }
    if ($action === 'progress') {
        if ($account === null) {
            throw new AccountError(401, 'Войди в аккаунт, чтобы сохранить прогресс.', sessionPayload(null));
        }
        reply(200, progressForAccount($db, $account, $data));
        return;
    }
    $secret = $db->query("SELECT value FROM auth_settings WHERE name = 'limit_secret'")->fetchColumn();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (random_int(1, 100) === 1) {
        $db->prepare('DELETE FROM auth_limits WHERE expires <= ?')->execute([time()]);
    }
    match ($action) {
        'register' => enforceRate($db, $secret, 'register-ip:' . $ip, 12, 3600),
        'login' => enforceRate($db, $secret, 'login-ip:' . $ip, 80, 900),
        'request-reset' => enforceRate($db, $secret, 'reset-mail-ip:' . $ip, 15, 3600),
        'reset' => enforceRate($db, $secret, 'reset-ip:' . $ip, 20, 900),
        'verify-email' => enforceRate($db, $secret, 'verify-email-ip:' . $ip, 40, 900),
        'send-verification', 'edit-account', 'delete-account' => enforceRate($db, $secret, 'edit-account-ip:' . $ip, 80, 900),
    };
    if ($action === 'request-reset') {
        requestPasswordReset($db, $data, $secret, $sender);
        return;
    }
    if ($action === 'verify-email') {
        confirmEmail($db, $data);
        reply(200, sessionPayload(accountForSession($db)) + ['message' => 'Адрес электронной почты подтверждён.']);
        return;
    }
    if (in_array($action, ['send-verification', 'edit-account', 'delete-account'], true)) {
        if ($account === null) {
            throw new AccountError(401, 'Войди в аккаунт.', sessionPayload(null));
        }
        enforceRate($db, $secret, "$action:" . $account['id'], $action === 'send-verification' ? 5 : 12, 900);
        $result = match ($action) {
            'send-verification' => sessionPayload($account) + ['message' => startEmailConfirmation($db, $account, $sender)],
            'edit-account' => editAccount($db, $account, $data, $sender),
            'delete-account' => deleteAccount($db, $account, $data),
        };
        reply(200, $result);
        return;
    }
    $result = match ($action) {
        'register' => registerAccount($db, $data, $sender),
        'login' => loginAccount($db, $data, $secret),
        'reset' => resetPassword($db, $data),
    };
    reply($action === 'register' ? 201 : 200, $result);
}

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

try {
    routeAccountRequest();
} catch (AccountError $error) {
    reply($error->status, ['error' => $error->getMessage()] + $error->data);
} catch (Throwable $error) {
    // Exception details may contain filesystem paths or request data.
    error_log('olympiads auth: account backend unavailable (' . $error::class . ')');
    reply(503, ['error' => 'Аккаунты временно недоступны. Попробуй позже.']);
}
