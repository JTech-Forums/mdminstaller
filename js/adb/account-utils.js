export async function isDeviceRooted(adb) {
  if (!adb) return false;
  try {
    const outputs = [];
    try {
      const out = await adb.executeShellCommand('which su');
      if (out && out.trim().includes('/su') && !/not found|permission denied/i.test(out)) outputs.push(out);
    } catch {}
    try {
      const out = await adb.executeShellCommand('whoami');
      if (out && out.trim().toLowerCase() === 'root' && !/permission denied/i.test(out)) outputs.push(out);
    } catch {}
    try {
      const out = await adb.executeShellCommand('pm list packages');
      if (out && /com\.topjohnwu\.magisk|eu\.chainfire\.supersu/i.test(out)) outputs.push(out);
    } catch {}
    return outputs.length > 0;
  } catch {
    return false;
  }
}

export async function isAndroid14OrHigher(adb) {
  if (!adb) return false;
  try {
    const apiLevel = await adb.executeShellCommand('getprop ro.build.version.sdk');
    const level = parseInt(apiLevel.trim(), 10);
    return !isNaN(level) && level >= 34;
  } catch {
    return false;
  }
}

export async function deviceHasAccounts(adb) {
  if (!adb) return false;
  const outputs = [];
  const cmds = [
    'cmd account list --user 0',
    'cmd account list',
    'dumpsys account',
    'cmd accounts list',
  ];
  for (const cmd of cmds) {
    try {
      const out = await adb.executeShellCommand(cmd);
      if (out && out.trim()) outputs.push(out);
    } catch {}
  }
  const out = outputs.join('\n\n').trim();
  if (!out) return false;
  const lower = out.toLowerCase();
  if (/accounts?\s*:\s*(\d+)/.test(lower)) {
    const n = parseInt(RegExp.$1, 10);
    if (!isNaN(n)) return n > 0;
  }
  if (/account\s*\{?\s*name\s*=/.test(lower)) return true;
  if (/type=/.test(lower) && /name=/.test(lower)) return true;
  if (/@[a-z0-9._%+-]+(?:\.[a-z0-9._%+-]+)+/i.test(out)) return true;
  if (/com\.google|whatsapp|facebook|telegram|samsung|microsoft|work|exchange|corp/i.test(out)) return true;
  if (/no accounts/i.test(lower)) return false;
  if (/accounts?:/.test(out) && /accounts?:[^\n]*\n[ \t]+\S+/i.test(out)) return true;
  return false;
}

export async function disableAccountApps(adb) {
  if (!adb) return [];
  const disabled = new Set();
  const run = async pkg => {
    try {
      await adb.executeShellCommand(`pm disable-user --user 0 ${pkg}`);
      disabled.add(pkg);
      console.log('disabled', pkg);
    } catch (e) {
      console.log('failed to disable', pkg);
    }
  };
  const manualPkgs = [
    'com.microsoft.office.officehubrow',
    'com.microsoft.office.word',
    'com.microsoft.office.excel',
    'com.microsoft.office.outlook',
    'com.microsoft.office.powerpoint',
  ];
  for (const pkg of manualPkgs) {
    await run(pkg);
  }
  try {
    const out = await adb.executeShellCommand('dumpsys account');
    const re = /ComponentInfo\{([^\/}]+)\/[^}]+\}/g;
    let m;
    while ((m = re.exec(out))) {
      await run(m[1]);
    }
  } catch (e) {
    console.log('dumpsys account error', e?.message || e);
  }
  return Array.from(disabled);
}

export async function reenablePackages(adb, packages) {
  if (!adb || !packages?.length) return;
  console.log('reenablePackages', packages);
  for (const pkg of packages) {
    try {
      await adb.executeShellCommand(`pm enable ${pkg}`);
      console.log('reenabled', pkg);
    } catch (e) {
      console.log('failed to reenable', pkg);
    }
  }
}

export async function runShellCommand(adb, cmd) {
  const c = Array.isArray(cmd) ? cmd.join(' ') : cmd;
  return await adb.executeShellCommand(c);
}
