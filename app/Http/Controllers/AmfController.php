<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use SabreAMF_Message;
use SabreAMF_InputStream;
use SabreAMF_OutputStream;
use SabreAMF_Const;
use Illuminate\Support\Facades\Log;
use App\Models\Character;
use App\Models\User;

class AmfController extends Controller
{
    /**
     * Handle the AMF Gateway request.
     */
    public function handle(Request $request)
    {
        // 1. Get the raw POST data
        $content = $request->getContent();

        if (empty($content)) {
            return response('AMF Gateway Ready', 200);
        }

        try {
            // 2. Deserialize the request
            $stream = new SabreAMF_InputStream($content);
            $amfRequest = new SabreAMF_Message();
            $amfRequest->deserialize($stream);
        } catch (\Exception $e) {
            Log::error("AMF Deserialization Error: " . $e->getMessage());
            return response('Invalid AMF Data', 500);
        }

        // 3. Prepare the Response Message
        $amfResponse = new SabreAMF_Message();
        $amfResponse->setEncoding($amfRequest->getEncoding());

        // 4. Process each "Body"
        foreach ($amfRequest->getBodies() as $requestBody) {
            $responseBody = $this->handleBody($requestBody);
            $amfResponse->addBody($responseBody);
        }

        // 5. Serialize the response
        $outputStream = new SabreAMF_OutputStream();
        $amfResponse->serialize($outputStream);
        $output = $outputStream->getRawData();

        // 6. Return response
        return response($output)
            ->header('Content-Type', 'application/x-amf');
    }

    private function handleBody($requestBody)
    {
        $target = $requestBody['target'];
        $responseTarget = $requestBody['response'];
        $data = $requestBody['data'];

        Log::info("AMF Call: $target", ['args' => $data]);

        try {
            $sessionError = $this->validateSessionKey($target, $data);
            if ($sessionError) {
                return [
                    'target' => $responseTarget . '/onResult',
                    'response' => null,
                    'data' => $sessionError
                ];
            }

            $result = $this->dispatchService($target, $data);

            return [
                'target'   => $responseTarget . '/onResult',
                'response' => null,
                'data'     => $result
            ];
        } catch (\Exception $e) {
            Log::error("AMF Service Error [$target]: " . $e->getMessage());

            return [
                'target'   => $responseTarget . '/onStatus',
                'response' => null,
                'data'     => [
                    'description' => $e->getMessage(),
                    'details'     => $e->getTraceAsString(),
                    'level'       => 'error',
                    'code'        => $e->getCode()
                ]
            ];
        }
    }

    private function dispatchService($target, $data)
    {
        $parts = explode('.', $target);
        $baseName = ucfirst($parts[0]);

        // If the AMF target name already ends with 'Service', don't add it again.
        if (str_ends_with($baseName, 'Service')) {
            $serviceName = $baseName;
        } else {
            $serviceName = $baseName . 'Service';
        }

        $methodName = $parts[1] ?? 'index';

        $fullClassName = "App\\Services\\Amf\\" . $serviceName;
        if (!class_exists($fullClassName)) {
            $fullClassName = "App\\Services\\" . $serviceName;

            if (!class_exists($fullClassName)) {
                throw new \Exception("Service '$serviceName' not found.");
            }
        }

        $serviceInstance = app($fullClassName);

        if (!method_exists($serviceInstance, $methodName)) {
            throw new \Exception("Method '$methodName' not found on service '$serviceName'.");
        }

        return call_user_func_array([$serviceInstance, $methodName], is_array($data) ? $data : [$data]);
    }

    private function validateSessionKey(string $target, $data): ?array
    {
        if (!is_array($data)) {
            return null;
        }

        $sessionKeyInfo = $this->extractSessionKeyInfo($data);
        if (!$sessionKeyInfo) {
            return null;
        }
        $sessionKey = $sessionKeyInfo['value'];

        $user = User::where('session_key', $sessionKey)->first();
        if (!$user) {
            return ['status' => 0, 'error' => 'Invalid session key'];
        }

        if ($target === 'SystemLogin.getAllCharacters') {
            return null;
        }

        $numericIds = $this->extractNumericIds($data);
        if (empty($numericIds)) {
            return null;
        }

        $ownsCharacter = Character::whereIn('id', $numericIds)
            ->where('user_id', $user->id)
            ->exists();

        if ($ownsCharacter) {
            return null;
        }

        return ['status' => 0, 'error' => 'Invalid session key'];
    }

    private function extractSessionKeyInfo(array $data): ?array
    {
        foreach ($data as $index => $value) {
            if (is_string($value) && strlen($value) === 32) {
                return ['value' => $value, 'index' => $index];
            }
        }

        return null;
    }

    private function extractAdjacentNumericId(array $data, int $sessionIndex): ?int
    {
        $candidates = [];
        if (isset($data[$sessionIndex - 1])) {
            $candidates[] = $data[$sessionIndex - 1];
        }
        if (isset($data[$sessionIndex + 1])) {
            $candidates[] = $data[$sessionIndex + 1];
        }

        foreach ($candidates as $value) {
            if (is_numeric($value)) {
                $id = (int)$value;
                if ($id > 0) {
                    return $id;
                }
            }
        }

        return null;
    }

    private function extractNumericIds(array $data): array
    {
        $ids = [];
        foreach ($data as $value) {
            if (is_numeric($value)) {
                $id = (int)$value;
                if ($id > 0) {
                    $ids[] = $id;
                }
            }
        }

        return array_values(array_unique($ids));
    }
}
