<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\Enemy;
use App\Models\Mission;
use App\Models\User;
use App\Services\Amf\BattleSystemService\FinishService;
use App\Services\Amf\BattleSystemService\StartService;
use App\Services\Amf\BattleSystemService\TurnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use SabreAMF_InputStream;
use SabreAMF_Message;
use SabreAMF_OutputStream;
use Tests\TestCase;

class TurnBasedCombatTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Character $character;

    private string $sessionKey;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        $this->sessionKey = str_repeat('s', 32);
        $this->user = User::factory()->create();
        $this->user->session_key = $this->sessionKey;
        $this->user->save();
        $this->character = Character::create([
            'user_id' => $this->user->id,
            'name' => 'Kaito',
            'equipment_skills' => 'skill_13',
        ]);
        Mission::create([
            'mission_id' => 'msn_1',
            'req_lvl' => 1,
            'xp' => 20,
            'gold' => 20,
        ]);
        Enemy::create([
            'enemy_id' => 'ene_01',
            'name' => 'Training Dummy',
            'level' => 1,
            'hp' => 20,
            'cp' => 0,
            'agility' => 1,
            'attacks' => [['dmg' => 1]],
        ]);
    }

    public function test_server_resolves_turns_and_only_grants_rewards_after_victory(): void
    {
        $token = $this->startMission();
        $turnService = new TurnService;
        $initial = $turnService->getBattleState(
            $this->character->id,
            'msn_1',
            $token,
            $this->sessionKey,
        );

        $this->assertSame('ongoing', $initial['battle']['status']);
        $this->assertSame(1, $initial['battle']['round']);

        $unequippedSkill = $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'skill',
            0,
            'skill_01',
            $this->sessionKey,
        );
        $this->assertSame(0, $unequippedSkill['status']);
        $this->assertSame(120, $initial['battle']['player']['hp']);

        $finishService = new FinishService;
        $earlyFinish = $finishService->finishMission(
            $this->character->id,
            'msn_1',
            $token,
            '',
            0,
            $this->sessionKey,
            '',
            '',
        );
        $this->assertSame('The battle has not been won', $earlyFinish['error']);
        $this->assertSame(1000, $this->character->fresh()->gold);

        $firstTurn = $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'attack',
            0,
            '',
            $this->sessionKey,
        );
        $this->assertSame('ongoing', $firstTurn['battle']['status']);
        $this->assertSame(6, $firstTurn['battle']['enemies'][0]['hp']);
        $this->assertSame(117, $firstTurn['battle']['player']['hp']);

        $lastTurn = $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'attack',
            0,
            '',
            $this->sessionKey,
        );
        $this->assertSame('victory', $lastTurn['battle']['status']);
        $this->assertSame(0, $lastTurn['battle']['enemies'][0]['hp']);

        $result = $finishService->finishMission(
            $this->character->id,
            'msn_1',
            $token,
            '',
            0,
            $this->sessionKey,
            '',
            '',
        );
        $this->assertSame(1, $result['status']);
        $this->assertSame([20, 20, []], $result['result']);
        $this->assertSame(1020, $this->character->fresh()->gold);
    }

    public function test_guard_reduces_the_next_enemy_attack(): void
    {
        $enemy = Enemy::where('enemy_id', 'ene_01')->firstOrFail();
        $enemy->attacks = [['dmg' => 20]];
        $enemy->save();
        $token = $this->startMission();

        $result = (new TurnService)->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'guard',
            0,
            '',
            $this->sessionKey,
        );

        $this->assertSame('ongoing', $result['battle']['status']);
        $this->assertSame(109, $result['battle']['player']['hp']);
    }

    public function test_equipped_skills_use_server_data_and_enforce_cooldowns(): void
    {
        $enemy = Enemy::where('enemy_id', 'ene_01')->firstOrFail();
        $enemy->hp = 80;
        $enemy->save();
        $token = $this->startMission();
        $turnService = new TurnService;

        $skillTurn = $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'skill',
            0,
            'skill_13',
            $this->sessionKey,
        );

        $this->assertSame('ongoing', $skillTurn['battle']['status']);
        $this->assertSame(60, $skillTurn['battle']['enemies'][0]['hp']);
        $this->assertSame(50, $skillTurn['battle']['player']['cp']);
        $this->assertSame(2, $skillTurn['battle']['skills'][0]['cooldown_remaining']);

        $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'attack',
            0,
            '',
            $this->sessionKey,
        );
        $cooldownSkill = $turnService->performTurn(
            $this->character->id,
            'msn_1',
            $token,
            'skill',
            0,
            'skill_13',
            $this->sessionKey,
        );
        $currentState = $turnService->getBattleState(
            $this->character->id,
            'msn_1',
            $token,
            $this->sessionKey,
        );

        $this->assertSame(0, $cooldownSkill['status']);
        $this->assertSame(46, $currentState['battle']['enemies'][0]['hp']);
        $this->assertSame(1, $currentState['battle']['skills'][0]['cooldown_remaining']);
    }

    public function test_combat_turns_are_exposed_through_the_amf_gateway(): void
    {
        $token = $this->startMission();
        $message = new SabreAMF_Message;
        $message->addBody([
            'target' => 'BattleSystem.performTurn',
            'response' => '/test',
            'data' => [
                $this->character->id,
                'msn_1',
                $token,
                'attack',
                0,
                '',
                $this->sessionKey,
            ],
        ]);
        $stream = new SabreAMF_OutputStream;
        $message->serialize($stream);

        $response = $this->call(
            'POST',
            '/amf',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/x-amf'],
            $stream->getRawData(),
        );
        $response->assertOk();

        $responseMessage = new SabreAMF_Message;
        $responseMessage->deserialize(new SabreAMF_InputStream($response->getContent()));
        $body = $responseMessage->getBodies()[0];

        $this->assertSame(
            '/test/onResult',
            $body['target'],
            'Gateway error: '.($body['data']['description'] ?? 'unknown error')
        );
        $this->assertSame('ongoing', $body['data']['battle']['status']);
        $this->assertEquals(6, $body['data']['battle']['enemies'][0]['hp']);
    }

    private function startMission(): string
    {
        $enemy = Enemy::where('enemy_id', 'ene_01')->firstOrFail();
        $token = (new StartService)->startMission(
            $this->character->id,
            'msn_1',
            'ene_01',
            "id:ene_01|hp:$enemy->hp|agility:$enemy->agility",
            '',
            '',
            $this->sessionKey,
        );

        $this->assertIsString($token);

        return $token;
    }
}
