<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use SabreAMF_InputStream;
use SabreAMF_Message;
use SabreAMF_OutputStream;
use Tests\TestCase;

class CharacterRegistrationAmfTest extends TestCase
{
    use RefreshDatabase;

    public function test_character_registration_accepts_the_account_session_before_a_character_exists(): void
    {
        $user = User::factory()->create();
        $sessionKey = str_repeat('s', 32);
        $user->session_key = $sessionKey;
        $user->save();

        $message = new SabreAMF_Message;
        $message->addBody([
            'target' => 'Character.characterRegister',
            'response' => '/3',
            'data' => [[
                $user->id,
                $sessionKey,
                'Kaito',
                0,
                1,
                '0|0',
                1,
            ]],
        ]);

        $stream = new SabreAMF_OutputStream;
        $message->serialize($stream);
        $response = $this->call(
            'POST',
            '/gateway.php',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/x-amf'],
            $stream->getRawData(),
        );

        $response->assertOk();
        $inputStream = new SabreAMF_InputStream($response->getContent());
        $responseMessage = new SabreAMF_Message;
        $responseMessage->deserialize($inputStream);

        $this->assertSame(1, $responseMessage->getBodies()[0]['data']['status']);
        $this->assertDatabaseHas('characters', [
            'user_id' => $user->id,
            'name' => 'Kaito',
        ]);
    }
}
