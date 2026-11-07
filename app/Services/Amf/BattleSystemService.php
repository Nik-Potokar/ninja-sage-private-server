<?php

namespace App\Services\Amf;

use App\Services\Amf\BattleSystemService\DataService;
use App\Services\Amf\BattleSystemService\FinishService;
use App\Services\Amf\BattleSystemService\StartService;
use App\Services\Amf\BattleSystemService\TurnService;

class BattleSystemService
{
    private StartService $startService;

    private FinishService $finishService;

    private DataService $dataService;

    private TurnService $turnService;

    public function __construct()
    {
        $this->startService = new StartService;
        $this->finishService = new FinishService;
        $this->dataService = new DataService;
        $this->turnService = new TurnService;
    }

    /**
     * startMission
     */
    public function startMission($charId, $missionId, $enemyId, $enemyStats, $unknown, $hash, $sessionKey, $stage = null)
    {
        return $this->startService->startMission($charId, $missionId, $enemyId, $enemyStats, $unknown, $hash, $sessionKey);
    }

    /**
     * finishMission
     */
    public function finishMission($charId, $missionId, $token, $hash, $score, $sessionKey, $battleData, $unknown)
    {
        return $this->finishService->finishMission($charId, $missionId, $token, $hash, $score, $sessionKey, $battleData, $unknown);
    }

    /**
     * getMissionSData
     */
    public function getMissionSData($charId, $sessionKey)
    {
        return $this->dataService->getMissionSData($charId, $sessionKey);
    }

    public function getBattleState($charId, $missionId, $token, $sessionKey)
    {
        return $this->turnService->getBattleState($charId, $missionId, $token, $sessionKey);
    }

    public function performTurn($charId, $missionId, $token, $action, $targetIndex, $skillId, $sessionKey)
    {
        return $this->turnService->performTurn(
            $charId,
            $missionId,
            $token,
            $action,
            $targetIndex,
            $skillId,
            $sessionKey
        );
    }
}
