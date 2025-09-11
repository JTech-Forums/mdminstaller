

@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: version 2.4

Title MB Smart Installer version 2.4

::creating logs directory
if not exist "logs" mkdir logs
if not exist "logs/MB" (
cd logs
mkdir MB
cd ..
)



:checking for adb
adb devices>null
IF %errorlevel% equ 9009 goto :adb_not_found
cls


::starting adb
adb start-server
cls
echo Please enable USB debugging on the device,
echo then connect the device to the computer,
echo on device screen tap 'Allow USB Debugging' when prompted.
echo.
echo Waiting for device
adb wait-for-device
cls





::checking android version (if cmd disable/enable will work)
FOR /F "tokens=*" %%g IN ('adb shell getprop ro.build.version.release') do set _version=%%g

FOR /F "tokens=*" %%F IN ('adb shell pm list packages com.com.babor') do set var=%%F
::echo %var%


if "%var%" == "package:com.com.babor" (
echo "MB Smart is already installed want to reinstall?"
choice /c YN /m ""
if errorlevel 2 goto :disable

)

:download
:: Downloading apk
color 07
echo Downloading app from server.
curl.exe -L https://mbsmart.net/app.apk --ssl-no-revoke --output MBSmart.apk>logs/MB/mb_dl.txt
cls

:: Installing apk with all permissions granted
adb shell pm disable-user --user 0 com.android.vending>null
echo Installing app.
if %_version% LSS 6 (
call :and5install
goto :disable
)




adb shell pm disable-user --user 0 com.android.vending>>logs/MB/mbapplist.txt
adb -d install -g -r MBSmart.apk

::checking if app installed



FOR /F "tokens=*" %%F IN ('adb shell pm list packages com.com.babor') do set var=%%F
echo %var%
echo %ERRORLEVEL%

if NOT "%var%" == "package:com.com.babor" (
goto :notfound
)
echo "MB Smart correctly installed"



    goto :disable
	
    :notfound
	    adb shell pm enable com.android.vending>null
		cls
        echo app did not install correctly press any key to exit.
		pause.
		exit 
		
		
:: Disabling all accounts
:disable
if %_version% LSS 6 ( 
call :android5
goto :activate
 )
cls
color 07

::cheking for multiple users

:user_check

set "_users="

FOR /F %%R IN ('"adb shell pm list users ^|^ grep UserInfo | find /v /c """') do set _users=%%R >>logs/MB/logs.txt

if %_users% gtr 1 (

mshta javascript:alert^("Multiple users found on the device!\n Please ask customer if he is using any Dual app like two Whatsapp apps, Secure folder or any secondary user on the device as the installer will erase all data inside these Dual apps or users, please backup any Dual app or secondary user data. \n\nSe Han encontrado multiples usuarios o apps duplicadas como Dual Whatsapp o Carpeta Segura, porfavor consultar con el usuario ya que esta informacion sera borrada, favor hacer backup."^);close^(^);

call :active_user

)


Echo Disabling accounts, please wait...




::FOR /F "delims={=}/ tokens=5" %%F IN ('adb shell "dumpsys account|grep -A 100 RegisteredServicesCache:"') do ( echo %%F) 


::Disabling office apps
@adb shell pm disable-user --user 0 com.microsoft.office.officehubrow>>logs/MB/mbapplist.txt
@adb shell pm disable-user --user 0 com.microsoft.office.word>>logs/MB/mbapplist.txt
@adb shell pm disable-user --user 0 com.microsoft.office.excel>>logs/MB/mbapplist.txt
@adb shell pm disable-user --user 0 com.microsoft.office.outlook>>logs/MB/mbapplist.txt
@adb shell pm disable-user --user 0 com.microsoft.office.powerpoint>>logs/MB/mbapplist.txt


FOR /F "delims={=}/ tokens=5" %%F IN ('adb shell "dumpsys account|grep -A 100 RegisteredServicesCache:"') do adb shell pm disable-user --user 0 %%F >>logs/MB/mbapplist.txt


timeout 10

FOR /F "tokens=*" %%F IN ('adb shell "dumpsys account|grep -c -A1 ComponentInfo"') do set var=%%F
echo %var%

if %var% gtr 0 (
adb shell "am start -n 'com.android.settings/com.android.settings.Settings$AccountDashboardActivity'">null
ver > nul
adb shell "am start -n 'com.android.settings/com.android.settings.Settings$UserAndAccountDashboardActivity'">null

cls
color c0
echo.
echo We found some %var% apps from the following accounts wich could not be disabled, please Remove mannually.
echo.
adb shell "dumpsys account|grep -A1 type"
echo.
echo The active accounts have these package ids, please disable these apps or disable their accounts
FOR /F "delims={=}/ tokens=5" %%F IN ('adb shell "dumpsys account|grep -A 100 RegisteredServicesCache:"') do echo %%F

echo.
echo if you dont see any account in settings you should press any key to try again.

pause
) 

color 07

:activate
::setting up if will need to retry
cls
set /a "_runcount=%_runcount%+1"

:: Setting MDM as device owner
color 07
echo Setting device owner

:: Ensure there are no remaining accounts before attempting activation
FOR /F "tokens=*" %%F IN ('adb shell "dumpsys account|grep -c -A1 ComponentInfo"') do set acctCount=%%F
if NOT "!acctCount!"=="0" (
  echo Accounts still present: !acctCount!. Re-running disable step...
  timeout /t 3 >nul
  goto :disable
)

:: Try to trick setup flow to allow device-owner activation
adb shell settings put secure user_setup_complete 0 >nul 2>&1
adb shell settings put global device_provisioned 0 >nul 2>&1

:: Attempt device-owner activation and capture output
adb shell dpm set-device-owner com.com.babor/com.com.babor.AdminReceiver > "logs/MB/activation_result_MB.txt" 2>&1
findstr /C:"Success:" "logs/MB/activation_result_MB.txt" >nul
if %ERRORLEVEL% EQU 0 (
  call :enable_apps
  :: Restore setup flags
  adb shell settings put secure user_setup_complete 1 >nul 2>&1
  adb shell settings put global device_provisioned 1 >nul 2>&1
  goto :done
)


:failed
cls
set _runcount=1
call :enable_apps
cls


echo Device Owner Activation failed with folowing error
adb shell dpm set-device-owner com.com.babor/com.com.babor.AdminReceiver
echo .

color c0

:: Restore setup flags to avoid leaving device in an unprovisioned state
adb shell settings put secure user_setup_complete 1 >nul 2>&1
adb shell settings put global device_provisioned 1 >nul 2>&1

echo press:
echo 1. to try again
echo 2. to exit
echo.
CHOICE /C 12 /M "Please Select:"
IF ERRORLEVEL 2 exit
IF ERRORLEVEL 1 GOTO :disable

goto :disable

:callapps
call :enable_apps
goto :continueowner

:done
:: done
cls
color 2F
adb shell am start -n com.com.babor/com.com.babor.OpenClass>null
echo Installation completed, please continue on the device
echo.
echo Press any key to exit
pause >nul
exit

:enableapps
:enable_apps
:: Enabling all apps
echo Enabling apps, please wait...

@adb shell pm enable com.google.android.gms>>logs/MB/mbapplist_enable.txt
@adb shell pm enable com.microsoft.office.officehubrow>>logs/MB/mbapplist_enable.txt
@adb shell pm enable com.microsoft.office.word>>logs/MB/mbapplist_enable.txt
@adb shell pm enable com.microsoft.office.excel>>logs/MB/mbapplist_enable.txt
@adb shell pm enable com.microsoft.office.outlook>>logs/MB/mbapplist_enable.txt
@adb shell pm enable com.microsoft.office.powerpoint>>logs/MB/mbapplist_enable.txt


FOR /F "tokens=2 delims=:" %%F IN ('adb shell pm list packages -d') DO adb shell pm enable %%F >>logs/MB/mbapplist_enable.txt
adb shell pm enable com.android.vending>>logs/MB/mbapplist_enable.txt
EXIT /B
:android5
color 4e
cls
echo.
echo.
echo                        ***************************************************
echo                        ******** sign out of all signed in accounts********
echo                        ********   and press any key to continue   ********
echo                        ***************************************************
echo.
echo.
pause>null
EXIT /B
:and5install

adb -d install -g -r MBSmart.apk>>logs/MB/mbappinstallog.txt
::checking if app installed
FOR /F "tokens=*" %%F IN ('adb shell pm list packages com.com.babor') do set var=%%F
echo %var%
echo %ERRORLEVEL%

if NOT "%var%" == "package:com.com.babor" (
goto :notfound
)
echo "MB Smart correctly installed"
pause
    goto :activate
    :notfound
        echo app did not install correctly press any key to exit.
		pause.
		exit
EXIT /B


:adb_not_found
cls
echo adb not found please put the script in the same directory as your adb.
echo press any key to exit.
pause>null
exit

:active_user

echo multiple users detected

echo 1. we will try to disable them 

echo 2. remove them manuallys

CHOICE /C 12 /M "Please Select:"

IF ERRORLEVEL 2 (

echo please remove all Users inluding guest.

echo when done, press any key to continue

pause>null

goto :user_check

)

IF ERRORLEVEL 1 ( 

FOR /F "tokens=2 delims={:" %%F IN ('adb shell pm list users ') DO adb shell pm remove-user %%F >>logs/MB/logs

)

set "_users1="

FOR /F %%Q IN ('"adb shell pm list users ^|^ grep UserInfo | find /v /c """') do set _users1=%%Q >>logs/MB/logs

if %_users1% gtr 1 (

echo we were unable to remove all users

echo please remove them manually

echo when done press any key to continue

pause >null

goto :user_check

)

EXIT /B
