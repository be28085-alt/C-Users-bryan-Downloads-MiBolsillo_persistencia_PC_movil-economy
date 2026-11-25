param(
    [string]$QtRoot = 'C:\Qt',
    [string]$QtVersion = '6.12.0',
    [string]$MinGWDirectory = 'mingw1310_64',
    [string]$BuildDirectory = (Join-Path $PSScriptRoot 'build/windows')
)

$ErrorActionPreference = 'Stop'
$ctest = Join-Path $QtRoot 'Tools/CMake_64/bin/ctest.exe'
$qtBin = Join-Path $QtRoot "$QtVersion/mingw_64/bin"
$compilerBin = Join-Path $QtRoot "Tools/$MinGWDirectory/bin"
if (-not (Test-Path -LiteralPath $ctest)) { throw "No se encuentra CTest: $ctest" }
if (-not (Test-Path -LiteralPath (Join-Path $BuildDirectory 'CTestTestfile.cmake'))) {
    throw 'Primero ejecute build-windows.ps1 con las pruebas habilitadas.'
}
$env:PATH = "$compilerBin;$qtBin;$env:PATH"
& $ctest --test-dir $BuildDirectory --output-on-failure --no-tests=error
if ($LASTEXITCODE -ne 0) { throw "Las pruebas Qt fallaron ($LASTEXITCODE)." }
