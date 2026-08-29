<#
.SYNOPSIS
    UUID v7 を生成する。Binder のエンティティ ID は全て UUID v7。
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File New-Uuid7.ps1 -Count 3
#>
param(
    [int]$Count = 1
)

$ErrorActionPreference = 'Stop'

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$baseMs = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

for ($i = 0; $i -lt $Count; $i++) {

    $bytes = New-Object byte[] 16
    $rng.GetBytes($bytes)

    # 先頭 48bit = Unix ミリ秒。バッチ内で生成順に単調増加させる
    $ms = $baseMs + $i
    $bytes[0] = [byte](($ms -shr 40) -band 0xFF)
    $bytes[1] = [byte](($ms -shr 32) -band 0xFF)
    $bytes[2] = [byte](($ms -shr 24) -band 0xFF)
    $bytes[3] = [byte](($ms -shr 16) -band 0xFF)
    $bytes[4] = [byte](($ms -shr 8)  -band 0xFF)
    $bytes[5] = [byte]( $ms          -band 0xFF)

    # version = 7
    $bytes[6] = [byte](0x70 -bor ($bytes[6] -band 0x0F))
    # variant = RFC 4122
    $bytes[8] = [byte](0x80 -bor ($bytes[8] -band 0x3F))

    $hex = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    '{0}-{1}-{2}-{3}-{4}' -f $hex.Substring(0,8), $hex.Substring(8,4), $hex.Substring(12,4), $hex.Substring(16,4), $hex.Substring(20,12)
}

$rng.Dispose()
