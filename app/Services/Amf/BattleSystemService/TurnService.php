<?php

namespace App\Services\Amf\BattleSystemService;

use App\Models\Character;
use App\Services\Amf\SessionValidator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

class TurnService
{
    public function getBattleState($charId, $missionId, $token, $sessionKey): array
    {
        $guard = SessionValidator::validateCharacter((int) $charId, $sessionKey);
        if ($guard) {
            return $guard;
        }

        $battle = $this->getBattle($charId, $missionId, $token);
        if (! $battle) {
            return ['status' => 0, 'error' => 'Invalid battle token'];
        }

        $character = Character::find((int) $charId);

        return [
            'status' => 1,
            'battle' => $this->presentState($battle['combat_state'], $character),
        ];
    }

    public function performTurn($charId, $missionId, $token, $action, $targetIndex, $skillId, $sessionKey): array
    {
        $guard = SessionValidator::validateCharacter((int) $charId, $sessionKey);
        if ($guard) {
            return $guard;
        }

        return Cache::lock("battle_lock_$charId", 10)->block(5, function () use (
            $charId,
            $missionId,
            $token,
            $action,
            $targetIndex,
            $skillId
        ) {
            $battle = $this->getBattle($charId, $missionId, $token);
            if (! $battle) {
                return ['status' => 0, 'error' => 'Invalid battle token'];
            }

            $state = $battle['combat_state'];
            if ($state['status'] !== 'ongoing') {
                return ['status' => 0, 'error' => 'The battle is already finished'];
            }

            $character = Character::find((int) $charId);
            if (! $character) {
                return ['status' => 0, 'error' => 'Character not found'];
            }

            $action = (string) $action;
            if ($action === 'guard') {
                $state['guarding'] = true;
                $state['log'][] = 'Your ninja braces for the incoming attacks.';
            } elseif ($action === 'attack' || $action === 'skill') {
                $targetIndex = filter_var($targetIndex, FILTER_VALIDATE_INT);
                if ($targetIndex === false || ! isset($state['enemies'][$targetIndex])) {
                    return ['status' => 0, 'error' => 'Invalid target'];
                }

                if ($state['enemies'][$targetIndex]['hp'] <= 0) {
                    return ['status' => 0, 'error' => 'That enemy has already been defeated'];
                }

                if ($action === 'attack') {
                    $damage = 12 + min(30, max(1, (int) $character->level) * 2);
                    $label = 'Basic attack';
                } else {
                    $skill = $this->getEquippedSkill($character, (string) $skillId);
                    if (! $skill) {
                        return ['status' => 0, 'error' => 'That skill is not equipped'];
                    }

                    if (($state['cooldowns'][$skill['id']] ?? 0) > 0) {
                        return ['status' => 0, 'error' => 'That skill is still on cooldown'];
                    }

                    if ($state['player']['cp'] < $skill['cp_cost']) {
                        return ['status' => 0, 'error' => 'Not enough chakra points'];
                    }

                    $state['player']['cp'] -= $skill['cp_cost'];
                    $damage = max(1, (int) $skill['damage']);
                    $label = $skill['name'];
                    $state['cooldowns'][$skill['id']] = max(0, (int) $skill['cooldown']);
                }

                $state['enemies'][$targetIndex]['hp'] = max(
                    0,
                    $state['enemies'][$targetIndex]['hp'] - $damage
                );
                $state['log'][] = "Your $label hits {$state['enemies'][$targetIndex]['name']} for $damage damage.";

                if ($state['enemies'][$targetIndex]['hp'] === 0) {
                    $state['log'][] = "{$state['enemies'][$targetIndex]['name']} is defeated.";
                }
            } else {
                return ['status' => 0, 'error' => 'Unknown battle action'];
            }

            foreach ($state['cooldowns'] as $id => $turns) {
                if ($action !== 'skill' || $id !== (string) $skillId) {
                    $state['cooldowns'][$id] = max(0, $turns - 1);
                }
            }

            if ($this->allEnemiesDefeated($state['enemies'])) {
                $state['status'] = 'victory';
                $state['log'][] = 'Victory! All enemies have been defeated.';
            } else {
                $this->enemyTurn($state);
                if ($state['player']['hp'] <= 0) {
                    $state['player']['hp'] = 0;
                    $state['status'] = 'defeat';
                    $state['log'][] = 'Defeat. Your ninja can no longer continue.';
                } else {
                    $state['player']['cp'] = min(
                        $state['player']['max_cp'],
                        $state['player']['cp'] + 5
                    );
                    $state['round']++;
                }
            }

            $battle['combat_state'] = $state;
            Cache::put("battle_token_$charId", $battle, 1800);

            return [
                'status' => 1,
                'battle' => $this->presentState($state, $character),
            ];
        });
    }

    private function getBattle($charId, $missionId, $token): ?array
    {
        $battle = Cache::get("battle_token_$charId");

        if (
            ! is_array($battle)
            || ! isset($battle['combat_state'])
            || ! hash_equals((string) $battle['token'], (string) $token)
            || (string) $battle['mission_id'] !== (string) $missionId
        ) {
            return null;
        }

        return $battle;
    }

    private function presentState(array $state, Character $character): array
    {
        return [
            'status' => $state['status'],
            'round' => $state['round'],
            'player' => $state['player'],
            'enemies' => array_map(static function (array $enemy): array {
                return [
                    'id' => $enemy['id'],
                    'name' => $enemy['name'],
                    'hp' => $enemy['hp'],
                    'max_hp' => $enemy['max_hp'],
                ];
            }, $state['enemies']),
            'skills' => $this->availableSkills($character, $state),
            'log' => array_slice($state['log'], -12),
        ];
    }

    private function availableSkills(Character $character, array $state): array
    {
        $definitions = $this->skillDefinitions();
        $equippedIds = array_filter(array_map('trim', explode(',', (string) $character->equipment_skills)));
        $skills = [];

        foreach ($equippedIds as $id) {
            $definition = $definitions[$id] ?? null;
            if (! $definition || ($definition['target'] ?? 'Single') !== 'Single') {
                continue;
            }

            $skills[] = [
                'id' => $id,
                'name' => $definition['name'] ?? $id,
                'damage' => max(1, (int) ($definition['damage'] ?? 0)),
                'cp_cost' => max(0, (int) ($definition['cp_cost'] ?? 0)),
                'cooldown' => max(0, (int) ($definition['cooldown'] ?? 0)),
                'cooldown_remaining' => (int) ($state['cooldowns'][$id] ?? 0),
            ];
        }

        return $skills;
    }

    private function getEquippedSkill(Character $character, string $skillId): ?array
    {
        foreach ($this->availableSkills($character, ['cooldowns' => []]) as $skill) {
            if ($skill['id'] === $skillId) {
                return $skill;
            }
        }

        return null;
    }

    private function skillDefinitions(): array
    {
        return Cache::remember('battle_skill_definitions', 3600, static function (): array {
            $path = base_path('public/game_data/skills.json');
            if (! File::exists($path)) {
                return [];
            }

            $entries = json_decode(File::get($path), true);
            if (! is_array($entries)) {
                return [];
            }

            $definitions = [];
            foreach ($entries as $entry) {
                if (isset($entry['id']) && is_array($entry)) {
                    $definitions[(string) $entry['id']] = $entry;
                }
            }

            return $definitions;
        });
    }

    private function enemyTurn(array &$state): void
    {
        foreach ($state['enemies'] as $enemy) {
            if ($enemy['hp'] <= 0 || $state['player']['hp'] <= 0) {
                continue;
            }

            $attack = $enemy['attacks'][0] ?? [];
            $damage = max(1, min(50, (int) ($attack['dmg'] ?? 1) + 2));
            if ($state['guarding']) {
                $damage = max(1, (int) ceil($damage / 2));
            }

            $state['player']['hp'] = max(0, $state['player']['hp'] - $damage);
            $state['log'][] = "{$enemy['name']} attacks for $damage damage.";
        }

        $state['guarding'] = false;
    }

    private function allEnemiesDefeated(array $enemies): bool
    {
        foreach ($enemies as $enemy) {
            if ($enemy['hp'] > 0) {
                return false;
            }
        }

        return true;
    }
}
