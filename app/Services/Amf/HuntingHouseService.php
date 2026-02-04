<?php

namespace App\Services\Amf;

use App\Services\Amf\HuntingHouseService\ClaimService;
use App\Services\Amf\HuntingHouseService\DataService;
use App\Services\Amf\HuntingHouseService\HuntService;
use App\Services\Amf\HuntingHouseService\PurchaseService;

class HuntingHouseService
{
    private DataService $dataService;
    private ClaimService $claimService;
    private PurchaseService $purchaseService;
    private HuntService $huntService;

    public function __construct()
    {
        $this->dataService = new DataService();
        $this->claimService = new ClaimService();
        $this->purchaseService = new PurchaseService();
        $this->huntService = new HuntService();
    }

    /**
     * getData
     * Params: [charId, sessionKey]
     */
    public function getData($charId, $sessionKey)
    {
        return $this->dataService->getData($charId, $sessionKey);
    }

    /**
     * dailyClaim
     */
    public function dailyClaim($charId, $sessionKey)
    {
        return $this->claimService->dailyClaim($charId, $sessionKey);
    }

    /**
     * buyMaterial
     */
    public function buyMaterial($charId, $sessionKey, $amount)
    {
        return $this->purchaseService->buyMaterial($charId, $sessionKey, $amount);
    }

    /**
     * startHunting
     */
    public function startHunting($charId, $zoneId, $sessionKey)
    {
        return $this->huntService->startHunting($charId, $zoneId, $sessionKey);
    }

    /**
     * finishHunting
     */
    public function finishHunting($charId, $zoneId, $battleCode, $hash, $sessionKey, $unknown)
    {
        return $this->huntService->finishHunting($charId, $zoneId, $battleCode, $hash, $sessionKey, $unknown);
    }
}
