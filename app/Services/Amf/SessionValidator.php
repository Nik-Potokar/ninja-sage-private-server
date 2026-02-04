<?php

namespace App\Services\Amf;

use App\Models\Character;
use App\Models\User;

class SessionValidator
{
    public static function validateCharacter(?int $charId, ?string $sessionKey): ?array
    {
        if (!$charId || !$sessionKey) {
            return ['status' => 0, 'error' => 'Invalid session key'];
        }

        $char = Character::find($charId);
        if (!$char || !$char->user) {
            return ['status' => 0, 'error' => 'Character not found'];
        }

        if ($char->user->session_key !== $sessionKey) {
            return ['status' => 0, 'error' => 'Invalid session key'];
        }

        return null;
    }

    public static function validateUser(?int $userId, ?string $sessionKey): ?array
    {
        if (!$userId || !$sessionKey) {
            return ['status' => 0, 'error' => 'Invalid session key'];
        }

        $user = User::find($userId);
        if (!$user) {
            return ['status' => 0, 'error' => 'User not found'];
        }

        if ($user->session_key !== $sessionKey) {
            return ['status' => 0, 'error' => 'Invalid session key'];
        }

        return null;
    }
}
