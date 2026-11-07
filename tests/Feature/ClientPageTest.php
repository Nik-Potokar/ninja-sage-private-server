<?php

namespace Tests\Feature;

use Tests\TestCase;

class ClientPageTest extends TestCase
{
    public function test_home_page_displays_the_web_client(): void
    {
        $this->withoutVite();

        $this->get('/')
            ->assertOk()
            ->assertSee('Ninja Sage — Cliente web')
            ->assertSee('game-client');
    }
}
