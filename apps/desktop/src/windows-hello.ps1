param(
  [Parameter(Mandatory = $true)]
  [string]$Action,

  [Parameter(Mandatory = $false)]
  [string]$MessageBase64 = "",

  [Parameter(Mandatory = $false)]
  [string]$WindowHandle = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime

function Await-WinRtOperation {
  param(
    [Parameter(Mandatory = $true)]
    $Operation
  )

  return [System.WindowsRuntimeSystemExtensions]::AsTask($Operation).GetAwaiter().GetResult()
}

function Write-JsonAndExit {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Payload
  )

  $Payload | ConvertTo-Json -Compress -Depth 6
  exit 0
}

$verifier = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]
$availability = Await-WinRtOperation ($verifier::CheckAvailabilityAsync())
$availabilityName = $availability.ToString()

if ($Action -eq "check") {
  Write-JsonAndExit @{
    ok = $true
    availability = $availabilityName
    available = ($availabilityName -eq "Available")
  }
}

$message = ""
if ($MessageBase64) {
  $message = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($MessageBase64))
}

$resultName = ""
$method = ""
$errors = @()
$buildNumber = [Environment]::OSVersion.Version.Build

if (($buildNumber -ge 22000) -and $WindowHandle) {
  try {
    $interop = [Windows.Security.Credentials.UI.UserConsentVerifierInterop]
    $operation = $interop::RequestVerificationForWindowAsync([IntPtr]::new([Int64]$WindowHandle), $message)
    $resultName = (Await-WinRtOperation $operation).ToString()
    $method = "windows-hello-hwnd"
  } catch {
    $errors += $_.Exception.Message
  }
}

if (-not $resultName) {
  try {
    $operation = $verifier::RequestVerificationAsync($message)
    $resultName = (Await-WinRtOperation $operation).ToString()
    $method = "windows-hello"
  } catch {
    $errors += $_.Exception.Message
    throw
  }
}

Write-JsonAndExit @{
  ok = $true
  availability = $availabilityName
  available = ($availabilityName -eq "Available")
  result = $resultName
  approved = ($resultName -eq "Verified")
  method = $method
  errors = $errors
}
