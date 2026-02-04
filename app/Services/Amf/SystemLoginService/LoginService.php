<?php

namespace App\Services\Amf\SystemLoginService;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LoginService
{
    /**
     * loginUser
     */
    public function loginUser($username, $encryptedPassword, $char_, $bl, $bt, $char__, $item, $seed, $passLen)
    {
        Log::info("AMF Login Attempt: $username");

        $user = User::where('username', $username)->first();

        if (!$user) {
            return ['status' => 2];
        }

        $decryptedPassword = $this->decryptPassword($encryptedPassword, $char__, $char_);

        if (!$decryptedPassword || !Hash::check($decryptedPassword, $user->password)) {
            return ['status' => 2];
        }

        $events = [
            'welcome_bonus',
            'mysterious-market',
            'chunin_package',
            'special-deals',
            'monster_hunter_2023',
            'dragon_hunt_2024',
            'justice-badge2024',
            'giveaway-center',
            'leaderboard',
            'tailedbeast',
            'dailygacha',
            'dragongacha',
            'exoticpackage',
            'confronting-death-2025',
            'thanksgiving2025',
            'elementalars',
            'xmass2025',
        ];

        $sessionKey = Str::random(32);
        $user->session_key = $sessionKey;
        $user->save();

        return [
            'status' => 1,
            'error' => 0,
            'uid' => $user->id,
            'sessionkey' => $sessionKey,
            '__' => $char__,
            'events' => $events,
            'clan_season' => 1,
            'crew_season' => 1,
            'sw_season' => 1,
            'banners' => [],
            'system_time' => base64_encode(time())
        ];
    }

    private function decryptPassword($encryptedBase64, $keyString, $ivString)
    {
        try {
            $key = $keyString;
            $iv = $this->pkcs5Pad($ivString, 16);
            $encryptedData = base64_decode($encryptedBase64);
            return openssl_decrypt($encryptedData, 'aes-128-cbc', $key, OPENSSL_RAW_DATA, $iv);
        } catch (\Exception $e) {
            Log::error("Decryption Exception: " . $e->getMessage());
            return false;
        }
    }

    private function pkcs5Pad($text, $blocksize)
    {
        $pad = $blocksize - (strlen($text) % $blocksize);
        return $text . str_repeat(chr($pad), $pad);
    }
}
